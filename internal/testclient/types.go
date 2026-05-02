package testclient

import (
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
}

func NewExecutorFactory(config ExecutionConfig) *ExecutorFactory {
	return &ExecutorFactory{config: config}
}

func (f *ExecutorFactory) GetExecutor() (Executor, error) {
	// Placeholder: we'll add actual executor implementations
	// For now, return a mock executor for testing
	return &MockExecutor{}, nil
}
