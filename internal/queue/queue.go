package queue

import (
	"sort"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/prasenjit-net/gherkin-tester/internal/events"
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
	Output    string     `json:"output,omitempty"`
}

type Queue struct {
	mu          sync.Mutex
	items       []*Item
	nextID      int64
	exec        testclient.Executor
	execFactory *testclient.ExecutorFactory
	st          *storage.Storage
	log         *slog.Logger
	bus         *events.Bus
	work        chan struct{}
}

func New(exec testclient.Executor, execFactory *testclient.ExecutorFactory, st *storage.Storage, log *slog.Logger, bus *events.Bus) *Queue {
	q := &Queue{
		exec:        exec,
		execFactory: execFactory,
		st:          st,
		log:         log,
		bus:         bus,
		work:        make(chan struct{}, 256),
	}
	q.loadHistory()
	go q.run()
	return q
}

// loadHistory pre-populates the queue with completed executions from disk.
func (q *Queue) loadHistory() {
	results, err := q.st.ListAllExecutions()
	if err != nil {
		q.log.Error("queue: failed to load execution history", "error", err)
		return
	}
	for _, r := range results {
		s := r.StartedAt
		e := r.EndedAt
		var status Status
		switch r.Status {
		case "passed":
			status = StatusPassed
		case "failed":
			status = StatusFailed
		default:
			status = StatusError
		}
		q.items = append(q.items, &Item{
			ID:        r.ID,
			TestID:    r.TestID,
			ProjectID: r.ProjectID,
			TestName:  r.TestName,
			Status:    status,
			QueuedAt:  s,
			StartedAt: &s,
			EndedAt:   &e,
			Duration:  r.Duration,
			Scenarios: r.Scenarios,
			Passed:    r.Passed,
			Failed:    r.Failed,
			Message:   r.Message,
			Output:    r.Output,
		})
	}
	q.log.Info("queue: loaded execution history", "count", len(results))
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

// Items returns a snapshot of all queue items sorted by QueuedAt descending.
func (q *Queue) Items() []Item {
	q.mu.Lock()
	defer q.mu.Unlock()
	out := make([]Item, len(q.items))
	for i, it := range q.items {
		out[i] = *it
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].QueuedAt.After(out[j].QueuedAt)
	})
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

// ClearCompleted removes all non-queued, non-running items from the list and deletes their execution directories from disk.
func (q *Queue) ClearCompleted() {
	q.mu.Lock()
	var active []*Item
	var toDelete []string
	for _, it := range q.items {
		if it.Status == StatusQueued || it.Status == StatusRunning {
			active = append(active, it)
		} else {
			toDelete = append(toDelete, it.ID)
		}
	}
	q.items = active
	q.mu.Unlock()

	for _, id := range toDelete {
		if err := q.st.DeleteExecution(id); err != nil {
			q.log.Error("queue: failed to delete execution", "id", id, "error", err)
		}
	}

	q.broadcastSnapshot()
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

	test, fetchErr := q.st.GetTest(item.ProjectID, testID)
	var result *storage.TestResult
	var execErr error
	if fetchErr == nil {
		exec := q.resolveExecutor(item.ProjectID)
		result, execErr = exec.Execute("", test)
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
		item.Output = result.Output
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
		result.ProjectID = item.ProjectID
		result.TestName = item.TestName
		if err := q.st.SaveTestResult(result); err != nil {
			q.log.Error("queue: failed to save result", "error", err)
		}
	}

	q.broadcastItem(item)
	q.log.Info("queue: test complete", "id", item.ID, "status", item.Status)
	return true
}

// resolveExecutor picks the right executor for a project's configured karate version.
// Falls back to the default executor if no version or factory is configured.
func (q *Queue) resolveExecutor(projectID string) testclient.Executor {
	if q.execFactory == nil {
		return q.exec
	}
	proj, err := q.st.GetProject(projectID)
	if err != nil || proj.KarateVersion == "" {
		// Try latest configured version
		if latest := q.st.LatestKarateVersion(); latest != "" {
			jarPath := q.st.KarateJARPath(latest)
			if exec, err := q.execFactory.GetExecutorForJAR(jarPath); err == nil {
				return exec
			}
		}
		return q.exec
	}
	jarPath := q.st.KarateJARPath(proj.KarateVersion)
	exec, err := q.execFactory.GetExecutorForJAR(jarPath)
	if err != nil {
		return q.exec
	}
	return exec
}

func (q *Queue) broadcastItem(item *Item) {
	q.mu.Lock()
	itemCopy := *item
	q.mu.Unlock()
	q.bus.Publish("queue.update", itemCopy)
}

func (q *Queue) broadcastSnapshot() {
	q.bus.Publish("queue.snapshot", map[string]any{"items": q.Items()})
}
