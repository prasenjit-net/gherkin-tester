package storage

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type Storage struct {
	testDir    string
	resultsDir string
	logger     *slog.Logger
}

func New(dataDir string, logger *slog.Logger) (*Storage, error) {
	testDir := filepath.Join(dataDir, "tests")
	resultsDir := filepath.Join(dataDir, "results")

	if err := os.MkdirAll(testDir, 0o755); err != nil {
		return nil, fmt.Errorf("create tests dir: %w", err)
	}
	if err := os.MkdirAll(resultsDir, 0o755); err != nil {
		return nil, fmt.Errorf("create results dir: %w", err)
	}

	return &Storage{
		testDir:    testDir,
		resultsDir: resultsDir,
		logger:     logger,
	}, nil
}

func (s *Storage) CreateTest(test *Test) error {
	if test.ID == "" {
		return fmt.Errorf("test ID is required")
	}

	test.CreatedAt = time.Now()
	test.UpdatedAt = time.Now()

	// Save feature file
	featurePath := filepath.Join(s.testDir, test.ID+".feature")
	if err := os.WriteFile(featurePath, []byte(test.Content), 0o644); err != nil {
		return fmt.Errorf("write feature file: %w", err)
	}

	// Save metadata
	metadata := map[string]interface{}{
		"id":          test.ID,
		"name":        test.Name,
		"description": test.Description,
		"tags":        test.Tags,
		"createdAt":   test.CreatedAt,
		"updatedAt":   test.UpdatedAt,
	}
	metaPath := filepath.Join(s.testDir, test.ID+".json")
	metaData, err := json.MarshalIndent(metadata, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal metadata: %w", err)
	}
	if err := os.WriteFile(metaPath, metaData, 0o644); err != nil {
		return fmt.Errorf("write metadata: %w", err)
	}

	s.logger.Info("test created", "id", test.ID, "name", test.Name)
	return nil
}

func (s *Storage) GetTest(testID string) (*Test, error) {
	metaPath := filepath.Join(s.testDir, testID+".json")
	metaData, err := os.ReadFile(metaPath)
	if err != nil {
		return nil, fmt.Errorf("read metadata: %w", err)
	}

	var metadata map[string]interface{}
	if err := json.Unmarshal(metaData, &metadata); err != nil {
		return nil, fmt.Errorf("unmarshal metadata: %w", err)
	}

	featurePath := filepath.Join(s.testDir, testID+".feature")
	content, err := os.ReadFile(featurePath)
	if err != nil {
		return nil, fmt.Errorf("read feature file: %w", err)
	}

	test := &Test{
		ID:          testID,
		Name:        getString(metadata, "name"),
		Description: getString(metadata, "description"),
		Content:     string(content),
		Tags:        getStringArray(metadata, "tags"),
		CreatedAt:   getTime(metadata, "createdAt"),
		UpdatedAt:   getTime(metadata, "updatedAt"),
	}

	return test, nil
}

func (s *Storage) ListTests() ([]Test, error) {
	entries, err := os.ReadDir(s.testDir)
	if err != nil {
		return nil, fmt.Errorf("read tests dir: %w", err)
	}

	var tests []Test
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		if strings.HasSuffix(entry.Name(), ".json") {
			testID := strings.TrimSuffix(entry.Name(), ".json")
			test, err := s.GetTest(testID)
			if err != nil {
				s.logger.Error("failed to load test", "id", testID, "error", err)
				continue
			}
			tests = append(tests, *test)
		}
	}

	return tests, nil
}

func (s *Storage) DeleteTest(testID string) error {
	featurePath := filepath.Join(s.testDir, testID+".feature")
	metaPath := filepath.Join(s.testDir, testID+".json")

	if err := os.Remove(featurePath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("delete feature file: %w", err)
	}
	if err := os.Remove(metaPath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("delete metadata: %w", err)
	}

	s.logger.Info("test deleted", "id", testID)
	return nil
}

func (s *Storage) UpdateTest(test *Test) error {
	test.UpdatedAt = time.Now()
	return s.CreateTest(test)
}

func (s *Storage) SaveTestResult(result *TestResult) error {
	if result.ID == "" {
		result.ID = fmt.Sprintf("%d", time.Now().UnixNano())
	}

	resultPath := filepath.Join(s.resultsDir, result.TestID+"_"+result.ID+".json")
	data, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal result: %w", err)
	}

	if err := os.WriteFile(resultPath, data, 0o644); err != nil {
		return fmt.Errorf("write result: %w", err)
	}

	s.logger.Info("result saved", "testId", result.TestID, "resultId", result.ID, "status", result.Status)
	return nil
}

func (s *Storage) GetTestResult(testID, resultID string) (*TestResult, error) {
	resultPath := filepath.Join(s.resultsDir, testID+"_"+resultID+".json")
	data, err := os.ReadFile(resultPath)
	if err != nil {
		return nil, fmt.Errorf("read result: %w", err)
	}

	var result TestResult
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("unmarshal result: %w", err)
	}

	return &result, nil
}

func (s *Storage) ListTestResults(testID string) ([]TestResult, error) {
	entries, err := os.ReadDir(s.resultsDir)
	if err != nil {
		return nil, fmt.Errorf("read results dir: %w", err)
	}

	var results []TestResult
	prefix := testID + "_"

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasPrefix(entry.Name(), prefix) {
			continue
		}

		data, err := os.ReadFile(filepath.Join(s.resultsDir, entry.Name()))
		if err != nil {
			s.logger.Error("failed to read result", "file", entry.Name(), "error", err)
			continue
		}

		var result TestResult
		if err := json.Unmarshal(data, &result); err != nil {
			s.logger.Error("failed to unmarshal result", "file", entry.Name(), "error", err)
			continue
		}

		results = append(results, result)
	}

	// Sort by StartedAt descending
	for i := 0; i < len(results)-1; i++ {
		for j := i + 1; j < len(results); j++ {
			if results[j].StartedAt.After(results[i].StartedAt) {
				results[i], results[j] = results[j], results[i]
			}
		}
	}

	return results, nil
}

// Helper functions
func getString(m map[string]interface{}, key string) string {
	if v, ok := m[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

func getStringArray(m map[string]interface{}, key string) []string {
	if v, ok := m[key]; ok {
		if arr, ok := v.([]interface{}); ok {
			result := make([]string, 0, len(arr))
			for _, item := range arr {
				if s, ok := item.(string); ok {
					result = append(result, s)
				}
			}
			return result
		}
	}
	return []string{}
}

func getTime(m map[string]interface{}, key string) time.Time {
	if v, ok := m[key]; ok {
		if s, ok := v.(string); ok {
			t, err := time.Parse(time.RFC3339, s)
			if err == nil {
				return t
			}
		}
	}
	return time.Time{}
}
