package events

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

// Event is the envelope published on the bus and sent to SSE clients.
type Event struct {
	Type    string `json:"type"`
	Payload any    `json:"payload"`
}

// Bus is a thread-safe SSE event bus. Multiple HTTP clients can subscribe via
// ServeSSE; any goroutine can Publish events to all of them.
type Bus struct {
	mu      sync.Mutex
	clients map[chan []byte]struct{}
}

func New() *Bus {
	return &Bus{clients: make(map[chan []byte]struct{})}
}

// Publish broadcasts an event to every connected SSE client.
func (b *Bus) Publish(eventType string, payload any) {
	data, err := json.Marshal(Event{Type: eventType, Payload: payload})
	if err != nil {
		return
	}
	b.mu.Lock()
	clients := make([]chan []byte, 0, len(b.clients))
	for ch := range b.clients {
		clients = append(clients, ch)
	}
	b.mu.Unlock()

	for _, ch := range clients {
		select {
		case ch <- data:
		default: // drop if client is slow
		}
	}
}

// ServeSSE registers the HTTP connection as an SSE client and blocks until
// the request context is done.
func (b *Bus) ServeSSE(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	ch := make(chan []byte, 64)
	b.mu.Lock()
	b.clients[ch] = struct{}{}
	b.mu.Unlock()

	defer func() {
		b.mu.Lock()
		delete(b.clients, ch)
		b.mu.Unlock()
	}()

	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case <-ticker.C:
			fmt.Fprintf(w, ": ping\n\n")
			flusher.Flush()
		case data, ok := <-ch:
			if !ok {
				return
			}
			fmt.Fprintf(w, "data: %s\n\n", data)
			flusher.Flush()
		}
	}
}
