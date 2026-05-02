package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/prasenjit-net/gherkin-tester/internal/config"
	"github.com/prasenjit-net/gherkin-tester/internal/storage"
	"github.com/prasenjit-net/gherkin-tester/internal/testclient"
	"github.com/prasenjit-net/gherkin-tester/internal/version"
)

type Handler struct {
	config   config.Config
	version  version.Info
	storage  *storage.Storage
	executor testclient.Executor
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

func NewHandler(cfg config.Config, build version.Info, st *storage.Storage, exec testclient.Executor) *Handler {
	return &Handler{config: cfg, version: build, storage: st, executor: exec}
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
	testID := chi.URLParam(r, "testID")
	test, err := h.storage.GetTest(testID)
	if err != nil {
		respondError(w, http.StatusNotFound, "test not found")
		return
	}

	result, err := h.executor.Execute("", test)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if err := h.storage.SaveTestResult(result); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to save result")
		return
	}

	respondJSON(w, http.StatusOK, result)
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
	test, err := h.storage.GetTest(testID)
	if err != nil {
		respondError(w, http.StatusNotFound, "test not found")
		return
	}

	respondJSON(w, http.StatusOK, test)
}

func (h *Handler) DeleteTest(w http.ResponseWriter, r *http.Request) {
	testID := chi.URLParam(r, "testID")
	if err := h.storage.DeleteTest(testID); err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "test deleted"})
}

func (h *Handler) RunTest(w http.ResponseWriter, r *http.Request) {
	testID := chi.URLParam(r, "testID")
	test, err := h.storage.GetTest(testID)
	if err != nil {
		respondError(w, http.StatusNotFound, "test not found")
		return
	}

	result, err := h.executor.Execute("", test)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if err := h.storage.SaveTestResult(result); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to save result")
		return
	}

	respondJSON(w, http.StatusOK, result)
}

func (h *Handler) GetTestResult(w http.ResponseWriter, r *http.Request) {
	testID := chi.URLParam(r, "testID")
	results, err := h.storage.ListTestResults(testID)
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
	results, err := h.storage.ListTestResults(testID)
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
