package testclient

import (
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/prasenjit-net/gherkin-tester/internal/storage"
)

type Executor interface {
	Execute(testPath string, testFeature *storage.Test) (*storage.TestResult, error)
	IsAvailable() bool
}

type ExecutionConfig struct {
	KarateJAR    string
	MaxExecutors int
	JavaOpts     string
}

type ExecutorFactory struct {
	config ExecutionConfig
	logger *slog.Logger
}

func NewExecutorFactory(config ExecutionConfig, logger *slog.Logger) *ExecutorFactory {
	return &ExecutorFactory{config: config, logger: logger}
}

// GetExecutor returns a KarateExecutor when the JAR is configured and java is in PATH.
// Falls back to MockExecutor with a warning otherwise.
func (f *ExecutorFactory) GetExecutor() (Executor, error) {
	javaPath, err := resolveJava()
	if err != nil {
		f.logger.Warn("java not found in PATH, using mock executor", "error", err)
		return &MockExecutor{}, nil
	}

	if f.config.KarateJAR == "" {
		f.logger.Warn("karate JAR not configured (tests.karateJar), using mock executor")
		return &MockExecutor{}, nil
	}

	if _, err := os.Stat(f.config.KarateJAR); err != nil {
		f.logger.Warn("karate JAR not found, using mock executor", "path", f.config.KarateJAR, "error", err)
		return &MockExecutor{}, nil
	}

	absJAR, err := filepath.Abs(f.config.KarateJAR)
	if err != nil {
		f.logger.Warn("could not resolve karate JAR path, using mock executor", "path", f.config.KarateJAR, "error", err)
		return &MockExecutor{}, nil
	}

	f.logger.Info("using Karate executor", "jar", absJAR, "java", javaPath)
	return &KarateExecutor{
		jarPath:  absJAR,
		javaPath: javaPath,
		logger:   f.logger,
	}, nil
}

func resolveJava() (string, error) {
	if path, err := exec.LookPath("java"); err == nil {
		return path, nil
	}
	return "", fmt.Errorf("java not found in PATH")
}
