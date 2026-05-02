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

	// Test endpoints
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
			"routes":  []string{"/api/health", "/api/tests", "/api/meta"},
		})
	})

	logger.Debug("api router initialized")
	return r
}
