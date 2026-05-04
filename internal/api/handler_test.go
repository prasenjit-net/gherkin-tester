package api

import (
	"bytes"
	"encoding/json"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/prasenjit-net/gherkin-tester/internal/config"
	"github.com/prasenjit-net/gherkin-tester/internal/events"
	"github.com/prasenjit-net/gherkin-tester/internal/queue"
	"github.com/prasenjit-net/gherkin-tester/internal/storage"
	"github.com/prasenjit-net/gherkin-tester/internal/testclient"
	"github.com/prasenjit-net/gherkin-tester/internal/version"
)

func TestHealthEndpoint(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	st, err := storage.New(filepath.Join(t.TempDir(), "data"), logger)
	if err != nil {
		t.Fatalf("failed to create storage: %v", err)
	}

	executor := &testclient.MockExecutor{}
	var q *queue.Queue // nil is OK — health endpoint doesn't use queue
	router := NewRouter(config.Default(), "", logger, version.Current(), st, executor, q, events.New())
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

func TestProjectSpecUploadAndDetail(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	st, err := storage.New(filepath.Join(t.TempDir(), "data"), logger)
	if err != nil {
		t.Fatalf("failed to create storage: %v", err)
	}
	if err := st.CreateProject(&storage.Project{ID: "proj-1", Name: "Billing"}); err != nil {
		t.Fatalf("failed to create project: %v", err)
	}

	executor := &testclient.MockExecutor{}
	var q *queue.Queue
	router := NewRouter(config.Default(), "", logger, version.Current(), st, executor, q, events.New())

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	if err := writer.WriteField("description", "Billing service contract"); err != nil {
		t.Fatalf("failed to write form field: %v", err)
	}
	fileWriter, err := writer.CreateFormFile("file", "billing.yaml")
	if err != nil {
		t.Fatalf("failed to create form file: %v", err)
	}
	if _, err := io.WriteString(fileWriter, `openapi: 3.0.3
info:
  title: Billing API
  version: 1.0.0
paths:
  /invoices:
    get:
      operationId: listInvoices
      summary: List invoices
`); err != nil {
		t.Fatalf("failed to write spec file: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("failed to close multipart writer: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/projects/proj-1/specs", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", res.Code, res.Body.String())
	}

	var spec storage.Spec
	if err := json.Unmarshal(res.Body.Bytes(), &spec); err != nil {
		t.Fatalf("failed to decode created spec: %v", err)
	}
	if spec.Summary.OperationsCount != 1 {
		t.Fatalf("expected 1 operation, got %d", spec.Summary.OperationsCount)
	}

	detailReq := httptest.NewRequest(http.MethodGet, "/projects/proj-1/specs/"+spec.ID, nil)
	detailRes := httptest.NewRecorder()
	router.ServeHTTP(detailRes, detailReq)

	if detailRes.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", detailRes.Code, detailRes.Body.String())
	}

	var detail storage.SpecDetail
	if err := json.Unmarshal(detailRes.Body.Bytes(), &detail); err != nil {
		t.Fatalf("failed to decode spec detail: %v", err)
	}
	if detail.Spec == nil || detail.Spec.ID != spec.ID {
		t.Fatalf("expected detail for spec %q", spec.ID)
	}
	if len(detail.Endpoints) != 1 {
		t.Fatalf("expected 1 endpoint, got %d", len(detail.Endpoints))
	}
}

func TestConfigEndpointStoresAPIKeyWithoutEchoingIt(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	st, err := storage.New(filepath.Join(t.TempDir(), "data"), logger)
	if err != nil {
		t.Fatalf("failed to create storage: %v", err)
	}

	configFile := filepath.Join(t.TempDir(), "config.yaml")
	cfg := config.Default()
	executor := &testclient.MockExecutor{}
	var q *queue.Queue
	router := NewRouter(cfg, configFile, logger, version.Current(), st, executor, q, events.New())

	updateBody := strings.NewReader(`{
		"appName":"Gherkin Tester",
		"appDescription":"Karate test execution agent for API testing.",
		"appURL":"http://localhost:8080",
		"appEnv":"development",
		"serverPort":8080,
		"logLevel":"info",
		"logFormat":"text",
		"dataDir":"./data",
		"maxExecutors":4,
		"aiProvider":"openai",
		"aiModel":"gpt-5-mini",
		"aiBaseURL":"https://api.openai.com/v1",
		"aiApiKey":"sk-test-secret"
	}`)
	updateReq := httptest.NewRequest(http.MethodPut, "/config", updateBody)
	updateReq.Header.Set("Content-Type", "application/json")
	updateRes := httptest.NewRecorder()
	router.ServeHTTP(updateRes, updateReq)

	if updateRes.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", updateRes.Code, updateRes.Body.String())
	}

	configData, err := os.ReadFile(configFile)
	if err != nil {
		t.Fatalf("failed to read config file: %v", err)
	}
	if !strings.Contains(string(configData), "apiKey: sk-test-secret") {
		t.Fatalf("expected api key to be written to config file, got %s", string(configData))
	}

	getReq := httptest.NewRequest(http.MethodGet, "/config", nil)
	getRes := httptest.NewRecorder()
	router.ServeHTTP(getRes, getReq)

	if getRes.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", getRes.Code, getRes.Body.String())
	}

	var payload map[string]any
	if err := json.Unmarshal(getRes.Body.Bytes(), &payload); err != nil {
		t.Fatalf("failed to decode config response: %v", err)
	}
	if payload["hasAiApiKey"] != true {
		t.Fatalf("expected hasAiApiKey=true, got %#v", payload["hasAiApiKey"])
	}
	if _, ok := payload["aiApiKey"]; ok {
		t.Fatalf("did not expect aiApiKey in config response")
	}
}

func TestGenerateProjectSpecTestsCreatesProjectTests(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	st, err := storage.New(filepath.Join(t.TempDir(), "data"), logger)
	if err != nil {
		t.Fatalf("failed to create storage: %v", err)
	}
	if err := st.CreateProject(&storage.Project{ID: "proj-1", Name: "Billing"}); err != nil {
		t.Fatalf("failed to create project: %v", err)
	}

	spec, err := st.CreateSpec("proj-1", storage.SpecUpload{
		FileName: "billing.yaml",
		Content: []byte(`openapi: 3.0.3
info:
  title: Billing API
  version: 1.0.0
paths:
  /invoices:
    get:
      operationId: listInvoices
      summary: List invoices
`),
	})
	if err != nil {
		t.Fatalf("failed to create spec: %v", err)
	}

	aiServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/chat/completions" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{
				{
					"message": map[string]any{
						"role":    "assistant",
						"content": `{"files":[{"name":"Billing smoke coverage","description":"Covers invoice listing from the uploaded spec","tags":["billing"],"content":"@billing\nFeature: Billing smoke coverage\n\n  Scenario: List invoices\n    Given path '/invoices'\n    When method get\n    Then status 200"}]}`,
					},
				},
			},
		})
	}))
	defer aiServer.Close()

	cfg := config.Default()
	cfg.AI.BaseURL = aiServer.URL
	cfg.AI.APIKey = "sk-test"
	executor := &testclient.MockExecutor{}
	var q *queue.Queue
	router := NewRouter(cfg, "", logger, version.Current(), st, executor, q, events.New())

	req := httptest.NewRequest(http.MethodPost, "/projects/proj-1/specs/"+spec.ID+"/generate", strings.NewReader(`{"prompt":"Focus on a basic smoke test."}`))
	req.Header.Set("Content-Type", "application/json")
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", res.Code, res.Body.String())
	}

	var result storage.SpecGenerationResult
	if err := json.Unmarshal(res.Body.Bytes(), &result); err != nil {
		t.Fatalf("failed to decode generation result: %v", err)
	}
	if result.Provider != "openai" {
		t.Fatalf("expected provider openai, got %q", result.Provider)
	}
	if len(result.Tests) != 1 {
		t.Fatalf("expected 1 created test, got %d", len(result.Tests))
	}
	if result.Tests[0].Name != "Billing smoke coverage" {
		t.Fatalf("unexpected test name %q", result.Tests[0].Name)
	}
	if len(result.Tests[0].Tags) != 1 || result.Tests[0].Tags[0] != "billing" {
		t.Fatalf("expected billing tag, got %#v", result.Tests[0].Tags)
	}

	saved, err := st.GetTest("proj-1", result.Tests[0].ID)
	if err != nil {
		t.Fatalf("failed to load saved test: %v", err)
	}
	if !strings.Contains(saved.Content, "Scenario: List invoices") {
		t.Fatalf("expected generated feature content to be saved, got %s", saved.Content)
	}
}
