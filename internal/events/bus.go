package events

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// Event is the envelope published on the bus and sent to WebSocket clients.
type Event struct {
	Type    string `json:"type"`
	Payload any    `json:"payload"`
}

type wsClient struct {
	send chan []byte
}

// Bus is a thread-safe WebSocket event bus. Multiple HTTP clients can subscribe
// via ServeWS; any goroutine can Publish events to all of them.
type Bus struct {
	mu       sync.Mutex
	clients  map[*wsClient]struct{}
	upgrader websocket.Upgrader
}

func New() *Bus {
	return &Bus{
		clients: make(map[*wsClient]struct{}),
		upgrader: websocket.Upgrader{
			CheckOrigin:     func(r *http.Request) bool { return true },
			ReadBufferSize:  512,
			WriteBufferSize: 4096,
		},
	}
}

// Publish broadcasts an event to every connected WebSocket client.
func (b *Bus) Publish(eventType string, payload any) {
	data, err := json.Marshal(Event{Type: eventType, Payload: payload})
	if err != nil {
		return
	}
	b.mu.Lock()
	clients := make([]*wsClient, 0, len(b.clients))
	for c := range b.clients {
		clients = append(clients, c)
	}
	b.mu.Unlock()

	for _, c := range clients {
		select {
		case c.send <- data:
		default: // slow client — drop message
		}
	}
}

// ServeWS upgrades the HTTP connection to WebSocket, registers it as a bus
// client, and blocks until the connection closes or the request is cancelled.
func (b *Bus) ServeWS(w http.ResponseWriter, r *http.Request) {
	conn, err := b.upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}

	client := &wsClient{send: make(chan []byte, 64)}
	b.mu.Lock()
	b.clients[client] = struct{}{}
	b.mu.Unlock()

	// done is closed by the readPump goroutine when the remote side disconnects.
	done := make(chan struct{})

	// readPump drains incoming messages (clients only send pong frames) and
	// refreshes the read deadline on each pong so the ping/pong keepalive works.
	go func() {
		defer close(done)
		conn.SetReadLimit(512)
		conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		conn.SetPongHandler(func(string) error {
			conn.SetReadDeadline(time.Now().Add(60 * time.Second))
			return nil
		})
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				return
			}
		}
	}()

	// writePump — runs on the calling goroutine.
	pingTicker := time.NewTicker(30 * time.Second)
	defer func() {
		pingTicker.Stop()
		b.mu.Lock()
		delete(b.clients, client)
		b.mu.Unlock()
		conn.Close()
		<-done // wait for readPump to finish
	}()

	for {
		select {
		case <-done:
			return
		case <-r.Context().Done():
			return
		case <-pingTicker.C:
			conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		case data, ok := <-client.send:
			if !ok {
				return
			}
			conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
				return
			}
		}
	}
}
