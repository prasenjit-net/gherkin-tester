package api

import (
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/prasenjit-net/gherkin-tester/internal/config"
	"github.com/prasenjit-net/gherkin-tester/internal/events"
	"github.com/prasenjit-net/gherkin-tester/internal/queue"
	"github.com/prasenjit-net/gherkin-tester/internal/storage"
	"github.com/prasenjit-net/gherkin-tester/internal/testclient"
	"github.com/prasenjit-net/gherkin-tester/internal/version"
)

type Handler struct {
	config     config.Config
	configFile string
	version    version.Info
	storage    *storage.Storage
	executor   testclient.Executor
	queue      *queue.Queue
	bus        *events.Bus
}

type healthResponse struct {
	Status    string       `json:"status"`
	Service   string       `json:"service"`
	Env       string       `json:"env"`
	Time      time.Time    `json:"time"`
	Version   version.Info `json:"version"`
	Documents []string     `json:"documents"`
}

type exampleResponse struct {
	Title       string   `json:"title"`
	Summary     string   `json:"summary"`
	Features    []string `json:"features"`
	Quickstart  []string `json:"quickstart"`
	Repository  string   `json:"repository"`
	FrontendDir string   `json:"frontendDir"`
}

type metaResponse struct {
	Name        string       `json:"name"`
	Description string       `json:"description"`
	Environment string       `json:"environment"`
	URL         string       `json:"url"`
	UIProxy     string       `json:"uiProxy"`
	Version     version.Info `json:"version"`
}

func NewHandler(cfg config.Config, configFile string, build version.Info, st *storage.Storage, exec testclient.Executor, q *queue.Queue, bus *events.Bus) *Handler {
	return &Handler{config: cfg, configFile: configFile, version: build, storage: st, executor: exec, queue: q, bus: bus}
}

// EventStream upgrades to WebSocket and proxies to the global event bus.
func (h *Handler) EventStream(w http.ResponseWriter, r *http.Request) {
	// Send a queue.snapshot immediately so the client has initial state.
	h.bus.Publish("queue.snapshot", map[string]any{"items": h.queue.Items()})
	h.bus.ServeWS(w, r)
}

func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, healthResponse{
		Status:  "ok",
		Service: h.config.App.Name,
		Env:     h.config.App.Env,
		Time:    time.Now().UTC(),
		Version: h.version,
		Documents: []string{
			"README.md",
			"config.yaml",
			"ui/src/pages",
		},
	})
}

func (h *Handler) Example(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, exampleResponse{
		Title:       "Go + React starter template",
		Summary:     "Embed a Vite-generated React application directly into the Go binary with one production build.",
		Features:    []string{"Cobra CLI commands", "Viper config + .env support", "Chi API router", "Embedded SPA serving", "React Query + Tailwind UI"},
		Quickstart:  []string{"make install-deps", "make dev-all", "make build", "./build/<binary> serve"},
		Repository:  "Template repository",
		FrontendDir: "ui",
	})
}

func (h *Handler) Meta(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, metaResponse{
		Name:        h.config.App.Name,
		Description: h.config.App.Description,
		Environment: h.config.App.Env,
		URL:         h.config.App.URL,
		UIProxy:     h.config.UI.DevProxyURL,
		Version:     h.version,
	})
}

// ─── Config Endpoints ─────────────────────────────────────────────────────────

type configPayload struct {
	AppName        string `json:"appName"`
	AppDescription string `json:"appDescription"`
	AppURL         string `json:"appURL"`
	AppEnv         string `json:"appEnv"`
	ServerPort     int    `json:"serverPort"`
	LogLevel       string `json:"logLevel"`
	LogFormat      string `json:"logFormat"`
	DataDir        string `json:"dataDir"`
	MaxExecutors   int    `json:"maxExecutors"`
	ConfigFile     string `json:"configFile"`
}

func (h *Handler) GetConfig(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, configPayload{
		AppName:        h.config.App.Name,
		AppDescription: h.config.App.Description,
		AppURL:         h.config.App.URL,
		AppEnv:         h.config.App.Env,
		ServerPort:     h.config.Server.Port,
		LogLevel:       h.config.Logging.Level,
		LogFormat:      h.config.Logging.Format,
		DataDir:        h.config.Tests.DataDir,
		MaxExecutors:   h.config.Tests.MaxExecutors,
		ConfigFile:     h.configFile,
	})
}

func (h *Handler) UpdateConfig(w http.ResponseWriter, r *http.Request) {
	var req configPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	updated := h.config
	updated.App.Name = req.AppName
	updated.App.Description = req.AppDescription
	updated.App.URL = req.AppURL
	updated.App.Env = req.AppEnv
	updated.Server.Port = req.ServerPort
	updated.Logging.Level = req.LogLevel
	updated.Logging.Format = req.LogFormat
	updated.Tests.DataDir = req.DataDir
	updated.Tests.MaxExecutors = req.MaxExecutors

	if err := config.WriteConfig(updated, h.configFile); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to write config: "+err.Error())
		return
	}

	// Update in-memory config and the stored file path (in case it was just created).
	h.config = updated
	if h.configFile == "" {
		h.configFile = "config.yaml"
	}

	respondJSON(w, http.StatusOK, map[string]string{"status": "ok", "configFile": h.configFile})
}

// ─── Project Endpoints ───────────────────────────────────────────────────────

func (h *Handler) CreateProject(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ID          string `json:"id"`
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	project := &storage.Project{
		ID:          req.ID,
		Name:        req.Name,
		Description: req.Description,
	}

	if err := h.storage.CreateProject(project); err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, project)
}

func (h *Handler) ListProjects(w http.ResponseWriter, r *http.Request) {
	projects, err := h.storage.ListProjects()
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if projects == nil {
		projects = []storage.Project{}
	}
	respondJSON(w, http.StatusOK, projects)
}

func (h *Handler) GetProject(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "projectID")
	project, err := h.storage.GetProject(projectID)
	if err != nil {
		respondError(w, http.StatusNotFound, "project not found")
		return
	}
	respondJSON(w, http.StatusOK, project)
}

func (h *Handler) DeleteProject(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "projectID")
	if err := h.storage.DeleteProject(projectID); err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"message": "project deleted"})
}

func (h *Handler) ImportProject(w http.ResponseWriter, r *http.Request) {
	var req struct {
		RepoURL       string `json:"repoUrl"`
		Branch        string `json:"branch"`
		Name          string `json:"name"`
		Description   string `json:"description"`
		KarateVersion string `json:"karateVersion"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.RepoURL == "" {
		respondError(w, http.StatusBadRequest, "repoUrl is required")
		return
	}
	project, err := h.storage.ImportProjectFromGit(req.RepoURL, req.Branch, req.Name, req.Description, req.KarateVersion)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respondJSON(w, http.StatusCreated, project)
}

func (h *Handler) GetGitStatus(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "projectID")
	status, err := h.storage.GitStatus(projectID)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, status)
}

func (h *Handler) GitCommitPush(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "projectID")
	var req struct {
		Message string `json:"message"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := h.storage.GitCommitAndPush(projectID, req.Message); err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "pushed"})
}

func (h *Handler) GitPull(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "projectID")
	if err := h.storage.GitPull(projectID); err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "pulled"})
}

func (h *Handler) GitForcePull(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "projectID")
	if err := h.storage.GitForcePull(projectID); err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "force-pulled"})
}

// ─── Test Endpoints (project-scoped) ────────────────────────────────────────

func (h *Handler) CreateProjectTest(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "projectID")
	var req struct {
		ID          string   `json:"id"`
		Name        string   `json:"name"`
		Description string   `json:"description"`
		Content     string   `json:"content"`
		Tags        []string `json:"tags"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	test := &storage.Test{
		ID:          req.ID,
		ProjectID:   projectID,
		Name:        req.Name,
		Description: req.Description,
		Content:     req.Content,
		Tags:        req.Tags,
	}
	if err := h.storage.CreateTest(test); err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respondJSON(w, http.StatusCreated, test)
}

func (h *Handler) ListProjectTests(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "projectID")
	tests, err := h.storage.ListTestsByProject(projectID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if tests == nil {
		tests = []storage.Test{}
	}
	respondJSON(w, http.StatusOK, tests)
}

func (h *Handler) RunProjectTest(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "projectID")
	testID := chi.URLParam(r, "testID")
	test, err := h.storage.GetTest(projectID, testID)
	if err != nil {
		respondError(w, http.StatusNotFound, "test not found")
		return
	}

	result, err := h.executor.Execute("", test, nil, nil)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	result.ProjectID = projectID

	if err := h.storage.SaveTestResult(result); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to save result")
		return
	}

	respondJSON(w, http.StatusOK, result)
}

func (h *Handler) UpdateProjectTest(w http.ResponseWriter, r *http.Request) {
	testID := chi.URLParam(r, "testID")
	projectID := chi.URLParam(r, "projectID")
	test, err := h.storage.GetTest(projectID, testID)
	if err != nil {
		respondError(w, http.StatusNotFound, "test not found")
		return
	}
	var req struct {
		Name        string   `json:"name"`
		Description string   `json:"description"`
		Content     string   `json:"content"`
		Tags        []string `json:"tags"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	test.ProjectID = projectID
	test.Name = req.Name
	test.Description = req.Description
	test.Content = req.Content
	test.Tags = req.Tags
	if err := h.storage.UpdateTest(test); err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, test)
}

// ─── Test Endpoints (global, for backward compat) ───────────────────────────

func (h *Handler) CreateTest(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ID          string   `json:"id"`
		Name        string   `json:"name"`
		Description string   `json:"description"`
		Content     string   `json:"content"`
		Tags        []string `json:"tags"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	test := &storage.Test{
		ID:          req.ID,
		Name:        req.Name,
		Description: req.Description,
		Content:     req.Content,
		Tags:        req.Tags,
	}

	if err := h.storage.CreateTest(test); err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, test)
}

func (h *Handler) ListTests(w http.ResponseWriter, r *http.Request) {
	tests, err := h.storage.ListTests()
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if tests == nil {
		tests = []storage.Test{}
	}

	respondJSON(w, http.StatusOK, tests)
}

func (h *Handler) GetTest(w http.ResponseWriter, r *http.Request) {
	testID := chi.URLParam(r, "testID")
	projectID := chi.URLParam(r, "projectID")
	var test *storage.Test
	var err error
	if projectID != "" {
		test, err = h.storage.GetTest(projectID, testID)
	} else {
		test, err = h.storage.FindTest(testID)
	}
	if err != nil {
		respondError(w, http.StatusNotFound, "test not found")
		return
	}
	respondJSON(w, http.StatusOK, test)
}

func (h *Handler) DeleteTest(w http.ResponseWriter, r *http.Request) {
	testID := chi.URLParam(r, "testID")
	projectID := chi.URLParam(r, "projectID")
	if projectID == "" {
		test, err := h.storage.FindTest(testID)
		if err != nil {
			respondError(w, http.StatusNotFound, "test not found")
			return
		}
		projectID = test.ProjectID
	}
	if err := h.storage.DeleteTest(projectID, testID); err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"message": "test deleted"})
}

func (h *Handler) RunTest(w http.ResponseWriter, r *http.Request) {
	testID := chi.URLParam(r, "testID")
	test, err := h.storage.FindTest(testID)
	if err != nil {
		respondError(w, http.StatusNotFound, "test not found")
		return
	}

	result, err := h.executor.Execute("", test, nil, nil)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	result.ProjectID = test.ProjectID

	if err := h.storage.SaveTestResult(result); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to save result")
		return
	}
	respondJSON(w, http.StatusOK, result)
}

func (h *Handler) GetTestResult(w http.ResponseWriter, r *http.Request) {
	testID := chi.URLParam(r, "testID")
	projectID := chi.URLParam(r, "projectID")
	if projectID == "" {
		if test, err := h.storage.FindTest(testID); err == nil {
			projectID = test.ProjectID
		}
	}
	results, err := h.storage.ListTestResults(projectID, testID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if len(results) == 0 {
		respondError(w, http.StatusNotFound, "no results found")
		return
	}
	respondJSON(w, http.StatusOK, results[0])
}

func (h *Handler) GetTestHistory(w http.ResponseWriter, r *http.Request) {
	testID := chi.URLParam(r, "testID")
	projectID := chi.URLParam(r, "projectID")
	if projectID == "" {
		if test, err := h.storage.FindTest(testID); err == nil {
			projectID = test.ProjectID
		}
	}
	results, err := h.storage.ListTestResults(projectID, testID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if results == nil {
		results = []storage.TestResult{}
	}
	respondJSON(w, http.StatusOK, results)
}

func respondError(w http.ResponseWriter, status int, message string) {
	respondJSON(w, status, map[string]string{"error": message})
}

func respondJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

// ─── Queue handlers ───────────────────────────────────────────────────────────

func (h *Handler) QueueList(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, h.queue.Items())
}

func (h *Handler) QueueAdd(w http.ResponseWriter, r *http.Request) {
	var body struct {
		TestID        string   `json:"testId"`
		ProjectID     string   `json:"projectId"`
		TestName      string   `json:"testName"`
		EnvironmentID string   `json:"environmentId"`
		Tags          []string `json:"tags"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if body.TestID == "" {
		respondError(w, http.StatusBadRequest, "testId is required")
		return
	}
	item := h.queue.Enqueue(body.TestID, body.ProjectID, body.TestName, body.EnvironmentID, body.Tags)
	respondJSON(w, http.StatusCreated, item)
}

func (h *Handler) QueueCancel(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if h.queue.Cancel(id) {
		respondJSON(w, http.StatusOK, map[string]string{"status": "cancelled"})
	} else {
		respondError(w, http.StatusNotFound, "item not found or already running")
	}
}

func (h *Handler) QueueClear(w http.ResponseWriter, r *http.Request) {
	h.queue.ClearCompleted()
	respondJSON(w, http.StatusOK, map[string]string{"status": "cleared"})
}

// ─── Dashboard stats ──────────────────────────────────────────────────────────

type dashboardStats struct {
	ProjectCount     int                  `json:"projectCount"`
	TestCount        int                  `json:"testCount"`
	TotalExecutions  int                  `json:"totalExecutions"`
	PassedCount      int                  `json:"passedCount"`
	FailedCount      int                  `json:"failedCount"`
	ErrorCount       int                  `json:"errorCount"`
	RecentExecutions []storage.TestResult `json:"recentExecutions"`
}

func (h *Handler) GetStats(w http.ResponseWriter, r *http.Request) {
	projects, _ := h.storage.ListProjects()
	tests, _ := h.storage.ListTests()
	executions, _ := h.storage.ListAllExecutions()

	stats := dashboardStats{
		ProjectCount:    len(projects),
		TestCount:       len(tests),
		TotalExecutions: len(executions),
	}
	for _, e := range executions {
		switch e.Status {
		case "passed":
			stats.PassedCount++
		case "failed":
			stats.FailedCount++
		default:
			stats.ErrorCount++
		}
	}
	if len(executions) > 5 {
		stats.RecentExecutions = executions[:5]
	} else {
		stats.RecentExecutions = executions
	}
	if stats.RecentExecutions == nil {
		stats.RecentExecutions = []storage.TestResult{}
	}
	respondJSON(w, http.StatusOK, stats)
}

// ─── Karate version handlers ─────────────────────────────────────────────────

func (h *Handler) KarateVersionsList(w http.ResponseWriter, r *http.Request) {
	versions, err := h.storage.ListKarateVersions()
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if versions == nil {
		versions = []storage.KarateVersion{}
	}
	respondJSON(w, http.StatusOK, versions)
}

func (h *Handler) KarateVersionsAdd(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Version string `json:"version"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Version == "" {
		respondError(w, http.StatusBadRequest, "version is required")
		return
	}
	if err := h.storage.AddKarateVersion(body.Version); err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	// Kick off download in background, publishing progress events to the bus.
	go func(ver string) {
		jarPath := h.storage.KarateJARPath(ver)
		if _, err := storage.StatFile(jarPath); err == nil {
			return // already downloaded
		}
		h.bus.Publish("karate.download.started", map[string]string{"version": ver})
		if err := storage.DownloadKarateJAR(ver, jarPath, h.storage.Logger()); err != nil {
			h.bus.Publish("karate.download.error", map[string]string{"version": ver, "error": err.Error()})
		} else {
			h.bus.Publish("karate.download.complete", map[string]string{"version": ver})
		}
	}(body.Version)
	respondJSON(w, http.StatusCreated, map[string]string{"version": body.Version, "status": "added"})
}

func (h *Handler) KarateVersionsRemove(w http.ResponseWriter, r *http.Request) {
	ver := chi.URLParam(r, "version")
	if err := h.storage.RemoveKarateVersion(ver); err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.bus.Publish("karate.version.removed", map[string]string{"version": ver})
	respondJSON(w, http.StatusOK, map[string]string{"status": "removed"})
}

func (h *Handler) KarateReleasesProxy(w http.ResponseWriter, r *http.Request) {
	versions, err := storage.FetchKarateReleases()
	if err != nil {
		respondError(w, http.StatusBadGateway, "failed to fetch releases: "+err.Error())
		return
	}
	respondJSON(w, http.StatusOK, versions)
}

// KarateVersionStatus returns whether a version's JAR is present on disk.
func (h *Handler) KarateVersionStatus(w http.ResponseWriter, r *http.Request) {
	version := chi.URLParam(r, "version")
	jarPath := h.storage.KarateJARPath(version)
	_, err := storage.StatFile(jarPath)
	respondJSON(w, http.StatusOK, map[string]any{
		"version":    version,
		"downloaded": err == nil,
	})
}

// UpdateProject updates project metadata including karate version.
func (h *Handler) UpdateProject(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "projectID")
	project, err := h.storage.GetProject(projectID)
	if err != nil {
		respondError(w, http.StatusNotFound, "project not found")
		return
	}
	var req struct {
		Name          string `json:"name"`
		Description   string `json:"description"`
		KarateVersion string `json:"karateVersion"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name != "" {
		project.Name = req.Name
	}
	project.Description = req.Description
	project.KarateVersion = req.KarateVersion
	if err := h.storage.UpdateProject(project); err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, project)
}

// ─── Environment CRUD ─────────────────────────────────────────────────────────

type environmentMTLSPayload struct {
	PrivateKeyPassword      string `json:"privateKeyPassword,omitempty"`
	Clear                   bool   `json:"clear,omitempty"`
	ClearPrivateKeyPassword bool   `json:"clearPrivateKeyPassword,omitempty"`
}

type environmentPayload struct {
	Name        string                  `json:"name"`
	Description string                  `json:"description"`
	HTTPProxy   string                  `json:"httpProxy"`
	Properties  map[string]string       `json:"properties"`
	MTLS        *environmentMTLSPayload `json:"mtls,omitempty"`
}

type environmentRequest struct {
	environmentPayload
	CertificateFile *multipart.FileHeader
	PrivateKeyFile  *multipart.FileHeader
}

func sanitizeEnvironmentResponse(env *storage.Environment) *storage.Environment {
	if env == nil {
		return nil
	}
	copyEnv := *env
	if env.Properties != nil {
		copyEnv.Properties = make(map[string]string, len(env.Properties))
		for key, value := range env.Properties {
			copyEnv.Properties[key] = value
		}
	}
	if env.MTLS != nil {
		copyMTLS := *env.MTLS
		copyMTLS.PrivateKeyPassword = ""
		copyMTLS.HasPrivateKeyPassword = env.MTLS.PrivateKeyPassword != ""
		copyEnv.MTLS = &copyMTLS
	}
	return &copyEnv
}

func parseEnvironmentRequest(r *http.Request) (*environmentRequest, error) {
	contentType := r.Header.Get("Content-Type")
	if strings.HasPrefix(contentType, "multipart/form-data") {
		if err := r.ParseMultipartForm(16 << 20); err != nil {
			return nil, fmt.Errorf("parse multipart form: %w", err)
		}
		properties := map[string]string{}
		rawProperties := strings.TrimSpace(r.FormValue("properties"))
		if rawProperties != "" {
			if err := json.Unmarshal([]byte(rawProperties), &properties); err != nil {
				return nil, fmt.Errorf("parse properties: %w", err)
			}
		}
		req := &environmentRequest{
			environmentPayload: environmentPayload{
				Name:        r.FormValue("name"),
				Description: r.FormValue("description"),
				HTTPProxy:   r.FormValue("httpProxy"),
				Properties:  properties,
			},
		}
		if password, ok := r.MultipartForm.Value["mtlsPrivateKeyPassword"]; ok && len(password) > 0 {
			if req.MTLS == nil {
				req.MTLS = &environmentMTLSPayload{}
			}
			req.MTLS.PrivateKeyPassword = password[0]
		}
		if clear, ok := r.MultipartForm.Value["mtlsClear"]; ok && len(clear) > 0 && clear[0] == "true" {
			if req.MTLS == nil {
				req.MTLS = &environmentMTLSPayload{}
			}
			req.MTLS.Clear = true
		}
		if clearPassword, ok := r.MultipartForm.Value["mtlsClearPrivateKeyPassword"]; ok && len(clearPassword) > 0 && clearPassword[0] == "true" {
			if req.MTLS == nil {
				req.MTLS = &environmentMTLSPayload{}
			}
			req.MTLS.ClearPrivateKeyPassword = true
		}
		certFile, certHeader, certErr := r.FormFile("mtlsCertificate")
		if certErr == nil {
			_ = certFile.Close()
			req.CertificateFile = certHeader
		}
		keyFile, keyHeader, keyErr := r.FormFile("mtlsPrivateKey")
		if keyErr == nil {
			_ = keyFile.Close()
			req.PrivateKeyFile = keyHeader
		}
		return req, nil
	}

	var req environmentRequest
	if err := json.NewDecoder(r.Body).Decode(&req.environmentPayload); err != nil {
		return nil, err
	}
	return &req, nil
}

func (h *Handler) ListEnvironments(w http.ResponseWriter, r *http.Request) {
	envs, err := h.storage.ListEnvironments()
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if envs == nil {
		envs = []*storage.Environment{}
	}
	response := make([]*storage.Environment, 0, len(envs))
	for _, env := range envs {
		response = append(response, sanitizeEnvironmentResponse(env))
	}
	respondJSON(w, http.StatusOK, response)
}

func (h *Handler) CreateEnvironment(w http.ResponseWriter, r *http.Request) {
	req, err := parseEnvironmentRequest(r)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if strings.TrimSpace(req.Name) == "" {
		respondError(w, http.StatusBadRequest, "name is required")
		return
	}
	env := &storage.Environment{
		Name:        strings.TrimSpace(req.Name),
		Description: req.Description,
		HTTPProxy:   req.HTTPProxy,
		Properties:  req.Properties,
	}
	if env.Properties == nil {
		env.Properties = map[string]string{}
	}
	if err := h.storage.CreateEnvironment(env); err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	hasMTLSUpload := req.CertificateFile != nil || req.PrivateKeyFile != nil
	if hasMTLSUpload || req.MTLS != nil {
		if req.MTLS != nil && req.MTLS.Clear {
			_ = h.storage.DeleteEnvironment(env.ID)
			respondError(w, http.StatusBadRequest, "cannot clear mTLS while creating an environment")
			return
		}
		if req.CertificateFile == nil || req.PrivateKeyFile == nil {
			_ = h.storage.DeleteEnvironment(env.ID)
			respondError(w, http.StatusBadRequest, "both mTLS certificate and private key files are required")
			return
		}
		mtls, err := h.storage.SaveEnvironmentMTLSFiles(env.ID, req.CertificateFile, req.PrivateKeyFile)
		if err != nil {
			_ = h.storage.DeleteEnvironment(env.ID)
			respondError(w, http.StatusInternalServerError, err.Error())
			return
		}
		if req.MTLS != nil {
			mtls.PrivateKeyPassword = req.MTLS.PrivateKeyPassword
			mtls.HasPrivateKeyPassword = req.MTLS.PrivateKeyPassword != ""
		}
		env.MTLS = mtls
		if err := h.storage.UpdateEnvironment(env); err != nil {
			_ = h.storage.DeleteEnvironment(env.ID)
			respondError(w, http.StatusInternalServerError, err.Error())
			return
		}
	}
	respondJSON(w, http.StatusCreated, sanitizeEnvironmentResponse(env))
}

func (h *Handler) GetEnvironment(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	env, err := h.storage.GetEnvironment(id)
	if err != nil {
		respondError(w, http.StatusNotFound, "environment not found")
		return
	}
	respondJSON(w, http.StatusOK, sanitizeEnvironmentResponse(env))
}

func (h *Handler) UpdateEnvironment(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	env, err := h.storage.GetEnvironment(id)
	if err != nil {
		respondError(w, http.StatusNotFound, "environment not found")
		return
	}
	req, err := parseEnvironmentRequest(r)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if strings.TrimSpace(req.Name) != "" {
		env.Name = strings.TrimSpace(req.Name)
	}
	env.Description = req.Description
	env.HTTPProxy = req.HTTPProxy
	if req.Properties != nil {
		env.Properties = req.Properties
	}
	hasMTLSUpload := req.CertificateFile != nil || req.PrivateKeyFile != nil
	switch {
	case req.MTLS != nil && req.MTLS.Clear:
		if err := h.storage.ClearEnvironmentMTLSFiles(env.ID); err != nil {
			respondError(w, http.StatusInternalServerError, err.Error())
			return
		}
		env.MTLS = nil
	case hasMTLSUpload:
		if req.CertificateFile == nil || req.PrivateKeyFile == nil {
			respondError(w, http.StatusBadRequest, "both mTLS certificate and private key files are required")
			return
		}
		mtls, err := h.storage.SaveEnvironmentMTLSFiles(env.ID, req.CertificateFile, req.PrivateKeyFile)
		if err != nil {
			respondError(w, http.StatusInternalServerError, err.Error())
			return
		}
		if env.MTLS != nil {
			mtls.PrivateKeyPassword = env.MTLS.PrivateKeyPassword
		}
		if req.MTLS != nil {
			if req.MTLS.PrivateKeyPassword != "" {
				mtls.PrivateKeyPassword = req.MTLS.PrivateKeyPassword
			}
			if req.MTLS.ClearPrivateKeyPassword {
				mtls.PrivateKeyPassword = ""
			}
		}
		mtls.HasPrivateKeyPassword = mtls.PrivateKeyPassword != ""
		env.MTLS = mtls
	case req.MTLS != nil:
		if env.MTLS == nil {
			respondError(w, http.StatusBadRequest, "upload mTLS certificate and private key files before configuring mTLS settings")
			return
		}
		if req.MTLS.PrivateKeyPassword != "" {
			env.MTLS.PrivateKeyPassword = req.MTLS.PrivateKeyPassword
		}
		if req.MTLS.ClearPrivateKeyPassword {
			env.MTLS.PrivateKeyPassword = ""
		}
		env.MTLS.HasPrivateKeyPassword = env.MTLS.PrivateKeyPassword != ""
	}
	if err := h.storage.UpdateEnvironment(env); err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, sanitizeEnvironmentResponse(env))
}

func (h *Handler) DeleteEnvironment(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.storage.DeleteEnvironment(id); err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
