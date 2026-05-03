package server

import (
	"fmt"
	"io/fs"
	"log/slog"
	"net/http"
	"net/http/httputil"
	"net/url"
	"path"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/prasenjit-net/gherkin-tester/internal/api"
	"github.com/prasenjit-net/gherkin-tester/internal/config"
	"github.com/prasenjit-net/gherkin-tester/internal/events"
	"github.com/prasenjit-net/gherkin-tester/internal/queue"
	"github.com/prasenjit-net/gherkin-tester/internal/storage"
	"github.com/prasenjit-net/gherkin-tester/internal/testclient"
	"github.com/prasenjit-net/gherkin-tester/internal/version"
)

type Options struct {
	DevMode    bool
	UIFS       fs.FS
	ConfigFile string // path to config.yaml; empty if not found at startup
}

type App struct {
	cfg      config.Config
	logger   *slog.Logger
	build    version.Info
	options  Options
	storage  *storage.Storage
	executor testclient.Executor
	queue    *queue.Queue
	bus      *events.Bus
}

func New(cfg config.Config, logger *slog.Logger, build version.Info, options Options) (*App, error) {
	st, err := storage.New(cfg.Tests.DataDir, logger)
	if err != nil {
		return nil, fmt.Errorf("init storage: %w", err)
	}

	executorFactory := testclient.NewExecutorFactory(testclient.ExecutionConfig{
		KarateJAR:    cfg.Tests.KarateJAR,
		MaxExecutors: cfg.Tests.MaxExecutors,
	}, logger)
	executor, err := executorFactory.GetExecutor()
	if err != nil {
		return nil, fmt.Errorf("init executor: %w", err)
	}

	bus := events.New()

	q := queue.New(executor, executorFactory, st, logger, bus)

	// Download any missing JARs for configured karate versions in the background.
	go st.EnsureJARsDownloaded(logger, bus.Publish)

	return &App{
		cfg:      cfg,
		logger:   logger,
		build:    build,
		options:  options,
		storage:  st,
		executor: executor,
		queue:    q,
		bus:      bus,
	}, nil
}

func (a *App) Handler() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Heartbeat("/livez"))
	r.Use(requestLogger(a.logger))

	r.Mount("/api", api.NewRouter(a.cfg, a.options.ConfigFile, a.logger, a.build, a.storage, a.executor, a.queue, a.bus))

	if a.options.DevMode && strings.TrimSpace(a.cfg.UI.DevProxyURL) != "" {
		r.Handle("/*", newDevProxy(a.cfg.UI.DevProxyURL, a.logger))
		return r
	}

	distFS, err := fs.Sub(a.options.UIFS, "ui/dist")
	if err != nil {
		a.logger.Error("embedded ui not available", "error", err)
		r.Get("/*", func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, "embedded UI missing; run `make build-ui` before building the binary", http.StatusServiceUnavailable)
		})
		return r
	}

	spa := newSPAHandler(distFS)
	r.Handle("/*", spa)

	return r
}

func newDevProxy(rawURL string, logger *slog.Logger) http.Handler {
	target, err := url.Parse(rawURL)
	if err != nil {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, fmt.Sprintf("invalid UI dev proxy URL: %v", err), http.StatusInternalServerError)
		})
	}

	proxy := httputil.NewSingleHostReverseProxy(target)
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, proxyErr error) {
		logger.Error("vite proxy error", "error", proxyErr)
		http.Error(w, "Vite dev server is unavailable. Start it with `make dev-ui` or `make dev-all`.", http.StatusBadGateway)
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		proxy.ServeHTTP(w, r)
	})
}

type spaHandler struct {
	fsys       fs.FS
	fileServer http.Handler
}

func newSPAHandler(fsys fs.FS) http.Handler {
	return &spaHandler{
		fsys:       fsys,
		fileServer: http.FileServer(http.FS(fsys)),
	}
}

func (h *spaHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	cleanPath := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
	if cleanPath == "." || cleanPath == "" {
		cleanPath = "index.html"
	}

	if fileExists(h.fsys, cleanPath) {
		h.fileServer.ServeHTTP(w, r)
		return
	}

	// Serve index.html directly — do NOT route through FileServer with path
	// "/index.html", because net/http.FileServer unconditionally redirects
	// requests ending in /index.html to "./" to avoid duplicate content.
	http.ServeFileFS(w, r, h.fsys, "index.html")
}

func fileExists(fsys fs.FS, name string) bool {
	file, err := fsys.Open(name)
	if err != nil {
		return false
	}
	defer file.Close()

	info, err := file.Stat()
	if err != nil {
		return false
	}

	return !info.IsDir()
}

func requestLogger(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
			next.ServeHTTP(ww, r)
			logger.Info("request complete",
				"method", r.Method,
				"path", r.URL.Path,
				"status", ww.Status(),
				"bytes", ww.BytesWritten(),
				"duration", time.Since(start).String(),
				"request_id", middleware.GetReqID(r.Context()),
			)
		})
	}
}
