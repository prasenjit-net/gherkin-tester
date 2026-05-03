package api

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/prasenjit-net/gherkin-tester/internal/config"
	"github.com/prasenjit-net/gherkin-tester/internal/events"
	"github.com/prasenjit-net/gherkin-tester/internal/queue"
	"github.com/prasenjit-net/gherkin-tester/internal/storage"
	"github.com/prasenjit-net/gherkin-tester/internal/testclient"
	"github.com/prasenjit-net/gherkin-tester/internal/version"
)

func NewRouter(cfg config.Config, configFile string, logger *slog.Logger, build version.Info, st *storage.Storage, exec testclient.Executor, q *queue.Queue, bus *events.Bus) http.Handler {
	r := chi.NewRouter()

	h := NewHandler(cfg, configFile, build, st, exec, q, bus)

	// SSE endpoints must NOT be under the timeout middleware
	r.Get("/events/stream", h.EventStream)
	r.Get("/queue/stream", h.EventStream) // backward-compat alias

	// All other routes run under the 30-second request timeout
	r.Group(func(r chi.Router) {
		r.Use(middleware.Timeout(30 * time.Second))

		r.Get("/health", h.Health)
		r.Get("/example", h.Example)
		r.Get("/meta", h.Meta)
		r.Get("/stats", h.GetStats)
		r.Get("/config", h.GetConfig)
		r.Put("/config", h.UpdateConfig)

		// Queue management
		r.Get("/queue", h.QueueList)
		r.Post("/queue", h.QueueAdd)
		r.Delete("/queue/completed", h.QueueClear)
		r.Delete("/queue/{id}", h.QueueCancel)

		// Project routes
		r.Post("/projects", h.CreateProject)
		r.Get("/projects", h.ListProjects)
		r.Get("/projects/{projectID}", h.GetProject)
		r.Put("/projects/{projectID}", h.UpdateProject)
		r.Delete("/projects/{projectID}", h.DeleteProject)

		// Karate version management
		r.Get("/karate-versions", h.KarateVersionsList)
		r.Post("/karate-versions", h.KarateVersionsAdd)
		r.Delete("/karate-versions/{version}", h.KarateVersionsRemove)
		r.Get("/karate-versions/{version}/status", h.KarateVersionStatus)
		r.Get("/karate-releases", h.KarateReleasesProxy)

		// Project-scoped test routes
		r.Post("/projects/{projectID}/tests", h.CreateProjectTest)
		r.Get("/projects/{projectID}/tests", h.ListProjectTests)
		r.Get("/projects/{projectID}/tests/{testID}", h.GetTest)
		r.Put("/projects/{projectID}/tests/{testID}", h.UpdateProjectTest)
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
				"routes":  []string{"/api/health", "/api/projects", "/api/queue", "/api/meta"},
			})
		})
	})

	logger.Debug("api router initialized")
	return r
}
