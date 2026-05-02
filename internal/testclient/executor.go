package testclient

import (
	"fmt"
	"time"

	"github.com/prasenjit-net/gherkin-tester/internal/storage"
)

type MockExecutor struct{}

func (m *MockExecutor) Execute(testPath string, testFeature *storage.Test) (*storage.TestResult, error) {
	result := &storage.TestResult{
		TestID:    testFeature.ID,
		Status:    "passed",
		Message:   "Mock execution completed",
		Output:    fmt.Sprintf("Executed test: %s", testFeature.Name),
		StartedAt: time.Now().Add(-2 * time.Second),
		EndedAt:   time.Now(),
		Duration:  2000,
		Scenarios: 1,
		Passed:    1,
		Failed:    0,
	}
	return result, nil
}

func (m *MockExecutor) IsAvailable() bool {
	return true
}
