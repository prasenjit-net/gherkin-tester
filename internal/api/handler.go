package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/prasenjit-net/gherkin-tester/internal/config"
	"github.com/prasenjit-net/gherkin-tester/internal/queue"
	"github.com/prasenjit-net/gherkin-tester/internal/storage"
	"github.com/prasenjit-net/gherkin-tester/internal/testclient"
	"github.com/prasenjit-net/gherkin-tester/internal/version"
)

type Handler struct {
	config     config.Config
	configFile string // path to config.yaml on disk; empty if none found at startup
	version    version.Info
	storage    *storage.Storage
	executor   testclient.Executor
	queue      *queue.Queue
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

func NewHandler(cfg config.Config, configFile string, build version.Info, st *storage.Storage, exec testclient.Executor, q *queue.Queue) *Handler {
	return &Handler{config: cfg, configFile: configFile, version: build, storage: st, executor: exec, queue: q}
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

	result, err := h.executor.Execute("", test)
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

	result, err := h.executor.Execute("", test)
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
		TestID    string `json:"testId"`
		ProjectID string `json:"projectId"`
		TestName  string `json:"testName"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if body.TestID == "" {
		respondError(w, http.StatusBadRequest, "testId is required")
		return
	}
	item := h.queue.Enqueue(body.TestID, body.ProjectID, body.TestName)
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

func (h *Handler) QueueStream(w http.ResponseWriter, r *http.Request) {
	h.queue.ServeSSE(w, r)
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
	// Kick off download in background
	go func() {
		jarPath := h.storage.KarateJARPath(body.Version)
		if _, err := storage.StatFile(jarPath); err != nil {
			_ = storage.DownloadKarateJAR(body.Version, jarPath, h.storage.Logger())
		}
	}()
	respondJSON(w, http.StatusCreated, map[string]string{"version": body.Version, "status": "added"})
}

func (h *Handler) KarateVersionsRemove(w http.ResponseWriter, r *http.Request) {
	version := chi.URLParam(r, "version")
	if err := h.storage.RemoveKarateVersion(version); err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
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
