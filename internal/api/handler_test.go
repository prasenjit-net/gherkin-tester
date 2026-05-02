package api

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/prasenjit-net/gherkin-tester/internal/config"
	"github.com/prasenjit-net/gherkin-tester/internal/queue"
	"github.com/prasenjit-net/gherkin-tester/internal/storage"
	"github.com/prasenjit-net/gherkin-tester/internal/testclient"
	"github.com/prasenjit-net/gherkin-tester/internal/version"
)

func TestHealthEndpoint(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	st, err := storage.New("./data", logger)
	if err != nil {
		t.Fatalf("failed to create storage: %v", err)
	}
	
	executor := &testclient.MockExecutor{}
	var q *queue.Queue // nil is OK — health endpoint doesn't use queue
	router := NewRouter(config.Default(), logger, version.Current(), st, executor, q)
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	res := httptest.NewRecorder()

	router.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", res.Code)
	}
	if !strings.Contains(res.Body.String(), `"status":"ok"`) {
		t.Fatalf("expected ok payload, got %s", res.Body.String())
	}
}
