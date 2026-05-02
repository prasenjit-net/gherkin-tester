package api

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/prasenjit-net/gherkin-tester/internal/config"
	"github.com/prasenjit-net/gherkin-tester/internal/storage"
	"github.com/prasenjit-net/gherkin-tester/internal/testclient"
	"github.com/prasenjit-net/gherkin-tester/internal/version"
)

func NewRouter(cfg config.Config, logger *slog.Logger, build version.Info, st *storage.Storage, exec testclient.Executor) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.Timeout(30 * time.Second))

	h := NewHandler(cfg, build, st, exec)
	r.Get("/health", h.Health)
	r.Get("/example", h.Example)
	r.Get("/meta", h.Meta)

	// Project routes
	r.Post("/projects", h.CreateProject)
	r.Get("/projects", h.ListProjects)
	r.Get("/projects/{projectID}", h.GetProject)
	r.Delete("/projects/{projectID}", h.DeleteProject)

	// Project-scoped test routes
	r.Post("/projects/{projectID}/tests", h.CreateProjectTest)
	r.Get("/projects/{projectID}/tests", h.ListProjectTests)
	r.Get("/projects/{projectID}/tests/{testID}", h.GetTest)
	r.Delete("/projects/{projectID}/tests/{testID}", h.DeleteTest)
	r.Post("/projects/{projectID}/tests/{testID}/run", h.RunProjectTest)
	r.Get("/projects/{projectID}/tests/{testID}/results", h.GetTestResult)
	r.Get("/projects/{projectID}/tests/{testID}/history", h.GetTestHistory)

	// Legacy flat test routes (backward compat)
	r.Post("/tests", h.CreateTest)
	r.Get("/tests", h.ListTests)
	r.Get("/tests/{testID}", h.GetTest)
	r.Delete("/tests/{testID}", h.DeleteTest)
	r.Post("/tests/{testID}/run", h.RunTest)
	r.Get("/tests/{testID}/results", h.GetTestResult)
	r.Get("/tests/{testID}/history", h.GetTestHistory)

	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		respondJSON(w, http.StatusOK, map[string]any{
			"service": cfg.App.Name,
			"message": "API ready",
			"routes":  []string{"/api/health", "/api/projects", "/api/tests", "/api/meta"},
		})
	})

	logger.Debug("api router initialized")
	return r
}
