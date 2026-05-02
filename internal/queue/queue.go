package queue

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/prasenjit-net/gherkin-tester/internal/storage"
	"github.com/prasenjit-net/gherkin-tester/internal/testclient"
)

type Status string

const (
	StatusQueued  Status = "queued"
	StatusRunning Status = "running"
	StatusPassed  Status = "passed"
	StatusFailed  Status = "failed"
	StatusError   Status = "error"
)

type Item struct {
	ID        string     `json:"id"`
	TestID    string     `json:"testId"`
	ProjectID string     `json:"projectId"`
	TestName  string     `json:"testName"`
	Status    Status     `json:"status"`
	QueuedAt  time.Time  `json:"queuedAt"`
	StartedAt *time.Time `json:"startedAt,omitempty"`
	EndedAt   *time.Time `json:"endedAt,omitempty"`
	Duration  int64      `json:"duration,omitempty"`
	Scenarios int        `json:"scenarios,omitempty"`
	Passed    int        `json:"passed,omitempty"`
	Failed    int        `json:"failed,omitempty"`
	Message   string     `json:"message,omitempty"`
}

type Queue struct {
	mu      sync.Mutex
	items   []*Item
	nextID  int64
	exec    testclient.Executor
	st      *storage.Storage
	log     *slog.Logger
	clients map[chan []byte]struct{}
	work    chan struct{}
}

func New(exec testclient.Executor, st *storage.Storage, log *slog.Logger) *Queue {
	q := &Queue{
		exec:    exec,
		st:      st,
		log:     log,
		clients: make(map[chan []byte]struct{}),
		work:    make(chan struct{}, 256),
	}
	go q.run()
	return q
}

// Enqueue adds a test run to the queue and signals the worker.
func (q *Queue) Enqueue(testID, projectID, testName string) *Item {
	q.mu.Lock()
	q.nextID++
	item := &Item{
		ID:        fmt.Sprintf("%d", q.nextID),
		TestID:    testID,
		ProjectID: projectID,
		TestName:  testName,
		Status:    StatusQueued,
		QueuedAt:  time.Now(),
	}
	q.items = append(q.items, item)
	q.mu.Unlock()

	q.broadcastItem(item)
	q.signal()
	return item
}

// Items returns a snapshot of all current queue items.
func (q *Queue) Items() []Item {
	q.mu.Lock()
	defer q.mu.Unlock()
	out := make([]Item, len(q.items))
	for i, it := range q.items {
		out[i] = *it
	}
	return out
}

// Cancel marks a queued (not yet running) item as cancelled.
func (q *Queue) Cancel(id string) bool {
	q.mu.Lock()
	var found *Item
	for _, it := range q.items {
		if it.ID == id && it.Status == StatusQueued {
			it.Status = StatusError
			it.Message = "Cancelled"
			found = it
			break
		}
	}
	q.mu.Unlock()
	if found != nil {
		q.broadcastItem(found)
		return true
	}
	return false
}

// ClearCompleted removes all non-queued, non-running items from the list.
func (q *Queue) ClearCompleted() {
	q.mu.Lock()
	var active []*Item
	for _, it := range q.items {
		if it.Status == StatusQueued || it.Status == StatusRunning {
			active = append(active, it)
		}
	}
	q.items = active
	q.mu.Unlock()
	q.broadcastSnapshot()
}

// ServeSSE streams queue updates to a connected HTTP client via Server-Sent Events.
func (q *Queue) ServeSSE(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	ch := make(chan []byte, 64)

	q.mu.Lock()
	q.clients[ch] = struct{}{}
	snapshot := q.Items()
	q.mu.Unlock()

	// Send initial snapshot
	if data, err := json.Marshal(map[string]any{"type": "snapshot", "items": snapshot}); err == nil {
		fmt.Fprintf(w, "data: %s\n\n", data)
		flusher.Flush()
	}

	defer func() {
		q.mu.Lock()
		delete(q.clients, ch)
		q.mu.Unlock()
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

// ─── internal ─────────────────────────────────────────────────────────────────

func (q *Queue) signal() {
	select {
	case q.work <- struct{}{}:
	default:
	}
}

func (q *Queue) run() {
	for range q.work {
		for q.processOne() {
			// drain all queued items before waiting for next signal
		}
	}
}

func (q *Queue) processOne() bool {
	q.mu.Lock()
	var item *Item
	for _, it := range q.items {
		if it.Status == StatusQueued {
			item = it
			break
		}
	}
	if item == nil {
		q.mu.Unlock()
		return false
	}
	now := time.Now()
	item.Status = StatusRunning
	item.StartedAt = &now
	testID := item.TestID
	q.mu.Unlock()

	q.broadcastItem(item)

	q.log.Info("queue: running test", "id", item.ID, "testID", testID)

	test, fetchErr := q.st.GetTest(testID)
	var result *storage.TestResult
	var execErr error
	if fetchErr == nil {
		result, execErr = q.exec.Execute("", test)
	}

	q.mu.Lock()
	ended := time.Now()
	item.EndedAt = &ended
	switch {
	case fetchErr != nil:
		item.Status = StatusError
		item.Message = fmt.Sprintf("failed to load test: %v", fetchErr)
	case execErr != nil:
		item.Status = StatusError
		item.Message = execErr.Error()
	default:
		item.Duration = result.Duration
		item.Scenarios = result.Scenarios
		item.Passed = result.Passed
		item.Failed = result.Failed
		item.Message = result.Message
		switch result.Status {
		case "passed":
			item.Status = StatusPassed
		case "failed":
			item.Status = StatusFailed
		default:
			item.Status = StatusError
		}
	}
	q.mu.Unlock()

	if result != nil {
		if err := q.st.SaveTestResult(result); err != nil {
			q.log.Error("queue: failed to save result", "error", err)
		}
	}

	q.broadcastItem(item)
	q.log.Info("queue: test complete", "id", item.ID, "status", item.Status)
	return true
}

func (q *Queue) broadcastItem(item *Item) {
	q.mu.Lock()
	itemCopy := *item
	clients := make([]chan []byte, 0, len(q.clients))
	for ch := range q.clients {
		clients = append(clients, ch)
	}
	q.mu.Unlock()

	data, err := json.Marshal(map[string]any{"type": "update", "item": itemCopy})
	if err != nil {
		return
	}
	for _, ch := range clients {
		select {
		case ch <- data:
		default:
		}
	}
}

func (q *Queue) broadcastSnapshot() {
	items := q.Items()
	data, err := json.Marshal(map[string]any{"type": "snapshot", "items": items})
	if err != nil {
		return
	}
	q.mu.Lock()
	clients := make([]chan []byte, 0, len(q.clients))
	for ch := range q.clients {
		clients = append(clients, ch)
	}
	q.mu.Unlock()
	for _, ch := range clients {
		select {
		case ch <- data:
		default:
		}
	}
}
