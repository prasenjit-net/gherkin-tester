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
	projectsDir string
	logger      *slog.Logger
}

func New(dataDir string, logger *slog.Logger) (*Storage, error) {
	projectsDir := filepath.Join(dataDir, "projects")
	if err := os.MkdirAll(projectsDir, 0o755); err != nil {
		return nil, fmt.Errorf("create projects dir: %w", err)
	}

	st := &Storage{projectsDir: projectsDir, logger: logger}
	st.migrate(dataDir)
	return st, nil
}

// ─── Path helpers ─────────────────────────────────────────────────────────────

func (s *Storage) projectDir(projectID string) string {
	return filepath.Join(s.projectsDir, projectID)
}

func (s *Storage) testDir(projectID, testID string) string {
	return filepath.Join(s.projectsDir, projectID, "tests", testID)
}

func (s *Storage) executionDir(projectID, testID, execID string) string {
	return filepath.Join(s.projectsDir, projectID, "tests", testID, "executions", execID)
}

// ─── Projects ─────────────────────────────────────────────────────────────────

func (s *Storage) CreateProject(project *Project) error {
	if project.ID == "" {
		project.ID = fmt.Sprintf("%d", time.Now().UnixNano())
	}
	project.CreatedAt = time.Now()
	project.UpdatedAt = time.Now()

	dir := s.projectDir(project.ID)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("create project dir: %w", err)
	}

	data, err := json.MarshalIndent(project, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal project: %w", err)
	}
	if err := os.WriteFile(filepath.Join(dir, "project.json"), data, 0o644); err != nil {
		return fmt.Errorf("write project: %w", err)
	}
	s.logger.Info("project created", "id", project.ID, "name", project.Name)
	return nil
}

func (s *Storage) GetProject(projectID string) (*Project, error) {
	data, err := os.ReadFile(filepath.Join(s.projectDir(projectID), "project.json"))
	if err != nil {
		return nil, fmt.Errorf("read project: %w", err)
	}
	var p Project
	if err := json.Unmarshal(data, &p); err != nil {
		return nil, fmt.Errorf("unmarshal project: %w", err)
	}
	return &p, nil
}

func (s *Storage) ListProjects() ([]Project, error) {
	entries, err := os.ReadDir(s.projectsDir)
	if err != nil {
		return nil, fmt.Errorf("read projects dir: %w", err)
	}
	var projects []Project
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		p, err := s.GetProject(e.Name())
		if err != nil {
			s.logger.Error("failed to load project", "id", e.Name(), "error", err)
			continue
		}
		projects = append(projects, *p)
	}
	return projects, nil
}

func (s *Storage) DeleteProject(projectID string) error {
	dir := s.projectDir(projectID)
	if err := os.RemoveAll(dir); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("delete project: %w", err)
	}
	s.logger.Info("project deleted", "id", projectID)
	return nil
}

// ─── Tests ────────────────────────────────────────────────────────────────────

func (s *Storage) CreateTest(test *Test) error {
	if test.ID == "" {
		test.ID = fmt.Sprintf("%d", time.Now().UnixNano())
	}
	test.CreatedAt = time.Now()
	test.UpdatedAt = time.Now()

	dir := s.testDir(test.ProjectID, test.ID)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("create test dir: %w", err)
	}

	if err := os.WriteFile(filepath.Join(dir, "test.feature"), []byte(test.Content), 0o644); err != nil {
		return fmt.Errorf("write feature file: %w", err)
	}

	meta := map[string]interface{}{
		"id":          test.ID,
		"projectId":   test.ProjectID,
		"name":        test.Name,
		"description": test.Description,
		"tags":        test.Tags,
		"createdAt":   test.CreatedAt,
		"updatedAt":   test.UpdatedAt,
	}
	metaData, err := json.MarshalIndent(meta, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal metadata: %w", err)
	}
	if err := os.WriteFile(filepath.Join(dir, "test.json"), metaData, 0o644); err != nil {
		return fmt.Errorf("write metadata: %w", err)
	}
	s.logger.Info("test created", "id", test.ID, "projectId", test.ProjectID)
	return nil
}

func (s *Storage) GetTest(projectID, testID string) (*Test, error) {
	dir := s.testDir(projectID, testID)
	metaData, err := os.ReadFile(filepath.Join(dir, "test.json"))
	if err != nil {
		return nil, fmt.Errorf("read metadata: %w", err)
	}
	var meta map[string]interface{}
	if err := json.Unmarshal(metaData, &meta); err != nil {
		return nil, fmt.Errorf("unmarshal metadata: %w", err)
	}
	content, err := os.ReadFile(filepath.Join(dir, "test.feature"))
	if err != nil {
		return nil, fmt.Errorf("read feature file: %w", err)
	}
	return &Test{
		ID:          testID,
		ProjectID:   projectID,
		Name:        getString(meta, "name"),
		Description: getString(meta, "description"),
		Content:     string(content),
		Tags:        getStringArray(meta, "tags"),
		CreatedAt:   getTime(meta, "createdAt"),
		UpdatedAt:   getTime(meta, "updatedAt"),
	}, nil
}

// FindTest scans all projects to locate a test by ID alone.
// Used by legacy handlers where projectID is not available.
func (s *Storage) FindTest(testID string) (*Test, error) {
	projects, err := s.ListProjects()
	if err != nil {
		return nil, err
	}
	for _, p := range projects {
		test, err := s.GetTest(p.ID, testID)
		if err == nil {
			return test, nil
		}
	}
	return nil, fmt.Errorf("test %s not found", testID)
}

func (s *Storage) ListTests() ([]Test, error) {
	projects, err := s.ListProjects()
	if err != nil {
		return nil, err
	}
	var all []Test
	for _, p := range projects {
		tests, err := s.ListTestsByProject(p.ID)
		if err != nil {
			s.logger.Error("failed to list tests", "projectId", p.ID, "error", err)
			continue
		}
		all = append(all, tests...)
	}
	return all, nil
}

func (s *Storage) ListTestsByProject(projectID string) ([]Test, error) {
	testsRoot := filepath.Join(s.projectDir(projectID), "tests")
	entries, err := os.ReadDir(testsRoot)
	if os.IsNotExist(err) {
		return []Test{}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read tests dir: %w", err)
	}
	var tests []Test
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		test, err := s.GetTest(projectID, e.Name())
		if err != nil {
			s.logger.Error("failed to load test", "id", e.Name(), "error", err)
			continue
		}
		tests = append(tests, *test)
	}
	return tests, nil
}

func (s *Storage) DeleteTest(projectID, testID string) error {
	dir := s.testDir(projectID, testID)
	if err := os.RemoveAll(dir); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("delete test: %w", err)
	}
	s.logger.Info("test deleted", "id", testID)
	return nil
}

func (s *Storage) UpdateTest(test *Test) error {
	test.UpdatedAt = time.Now()
	dir := s.testDir(test.ProjectID, test.ID)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("create test dir: %w", err)
	}
	if err := os.WriteFile(filepath.Join(dir, "test.feature"), []byte(test.Content), 0o644); err != nil {
		return fmt.Errorf("write feature file: %w", err)
	}
	meta := map[string]interface{}{
		"id":          test.ID,
		"projectId":   test.ProjectID,
		"name":        test.Name,
		"description": test.Description,
		"tags":        test.Tags,
		"createdAt":   test.CreatedAt,
		"updatedAt":   test.UpdatedAt,
	}
	metaData, err := json.MarshalIndent(meta, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal metadata: %w", err)
	}
	if err := os.WriteFile(filepath.Join(dir, "test.json"), metaData, 0o644); err != nil {
		return fmt.Errorf("write metadata: %w", err)
	}
	s.logger.Info("test updated", "id", test.ID, "projectId", test.ProjectID)
	return nil
}

// ─── Executions (Results) ─────────────────────────────────────────────────────

func (s *Storage) SaveTestResult(result *TestResult) error {
	if result.ID == "" {
		result.ID = fmt.Sprintf("%d", time.Now().UnixNano())
	}

	dir := s.executionDir(result.ProjectID, result.TestID, result.ID)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("create execution dir: %w", err)
	}

	// Snapshot the current feature file into the execution directory.
	featureSrc := filepath.Join(s.testDir(result.ProjectID, result.TestID), "test.feature")
	if content, err := os.ReadFile(featureSrc); err == nil {
		_ = os.WriteFile(filepath.Join(dir, "test.feature"), content, 0o644)
	}

	// Write execution output separately.
	if result.Output != "" {
		if err := os.WriteFile(filepath.Join(dir, "output.log"), []byte(result.Output), 0o644); err != nil {
			return fmt.Errorf("write output log: %w", err)
		}
	}

	// Write report.json without the raw output embedded.
	report := *result
	report.Output = ""
	data, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal result: %w", err)
	}
	if err := os.WriteFile(filepath.Join(dir, "report.json"), data, 0o644); err != nil {
		return fmt.Errorf("write report: %w", err)
	}

	s.logger.Info("result saved", "testId", result.TestID, "resultId", result.ID, "status", result.Status)
	return nil
}

func (s *Storage) GetTestResult(projectID, testID, resultID string) (*TestResult, error) {
	dir := s.executionDir(projectID, testID, resultID)
	data, err := os.ReadFile(filepath.Join(dir, "report.json"))
	if err != nil {
		return nil, fmt.Errorf("read report: %w", err)
	}
	var result TestResult
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("unmarshal report: %w", err)
	}
	if out, err := os.ReadFile(filepath.Join(dir, "output.log")); err == nil {
		result.Output = string(out)
	}
	return &result, nil
}

func (s *Storage) ListTestResults(projectID, testID string) ([]TestResult, error) {
	execRoot := filepath.Join(s.testDir(projectID, testID), "executions")
	entries, err := os.ReadDir(execRoot)
	if os.IsNotExist(err) {
		return []TestResult{}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read executions dir: %w", err)
	}

	var results []TestResult
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		result, err := s.GetTestResult(projectID, testID, e.Name())
		if err != nil {
			s.logger.Error("failed to load result", "execId", e.Name(), "error", err)
			continue
		}
		results = append(results, *result)
	}

	// Sort by StartedAt descending.
	for i := 0; i < len(results)-1; i++ {
		for j := i + 1; j < len(results); j++ {
			if results[j].StartedAt.After(results[i].StartedAt) {
				results[i], results[j] = results[j], results[i]
			}
		}
	}
	return results, nil
}

// ─── Migration ────────────────────────────────────────────────────────────────

// migrate moves data from the old flat layout to the new hierarchical layout.
// It is safe to call multiple times (idempotent).
func (s *Storage) migrate(dataDir string) {
	oldTestsDir := filepath.Join(dataDir, "tests")
	oldResultsDir := filepath.Join(dataDir, "results")

	// Step 1: migrate flat project JSONs → project subdirectories.
	if entries, err := os.ReadDir(s.projectsDir); err == nil {
		for _, e := range entries {
			if e.IsDir() || !strings.HasSuffix(e.Name(), ".json") {
				continue
			}
			id := strings.TrimSuffix(e.Name(), ".json")
			oldPath := filepath.Join(s.projectsDir, e.Name())
			newDir := filepath.Join(s.projectsDir, id)
			newPath := filepath.Join(newDir, "project.json")
			if _, err := os.Stat(newPath); err == nil {
				os.Remove(oldPath)
				continue
			}
			if err := os.MkdirAll(newDir, 0o755); err != nil {
				continue
			}
			data, err := os.ReadFile(oldPath)
			if err != nil {
				continue
			}
			if err := os.WriteFile(newPath, data, 0o644); err != nil {
				continue
			}
			os.Remove(oldPath)
			s.logger.Info("migrated project", "id", id)
		}
	}

	// Step 2: migrate flat tests → project/tests/{id}/ directories.
	if entries, err := os.ReadDir(oldTestsDir); err == nil {
		for _, e := range entries {
			if e.IsDir() || !strings.HasSuffix(e.Name(), ".json") {
				continue
			}
			testID := strings.TrimSuffix(e.Name(), ".json")
			metaPath := filepath.Join(oldTestsDir, e.Name())
			featurePath := filepath.Join(oldTestsDir, testID+".feature")

			metaData, err := os.ReadFile(metaPath)
			if err != nil {
				continue
			}
			var meta map[string]interface{}
			if err := json.Unmarshal(metaData, &meta); err != nil {
				continue
			}
			projectID := getString(meta, "projectId")
			if projectID == "" {
				continue
			}

			newDir := s.testDir(projectID, testID)
			if _, err := os.Stat(filepath.Join(newDir, "test.json")); err == nil {
				os.Remove(metaPath)
				os.Remove(featurePath)
				continue
			}
			if err := os.MkdirAll(newDir, 0o755); err != nil {
				continue
			}
			if err := os.WriteFile(filepath.Join(newDir, "test.json"), metaData, 0o644); err != nil {
				continue
			}
			if content, err := os.ReadFile(featurePath); err == nil {
				_ = os.WriteFile(filepath.Join(newDir, "test.feature"), content, 0o644)
			}
			os.Remove(metaPath)
			os.Remove(featurePath)
			s.logger.Info("migrated test", "id", testID, "projectId", projectID)
		}
		// Clean up empty old tests dir.
		if entries2, err := os.ReadDir(oldTestsDir); err == nil && len(entries2) == 0 {
			os.Remove(oldTestsDir)
		}
	}

	// Step 3: migrate flat results → project/tests/{testID}/executions/{execID}/.
	if entries, err := os.ReadDir(oldResultsDir); err == nil {
		for _, e := range entries {
			if e.IsDir() || !strings.HasSuffix(e.Name(), ".json") {
				continue
			}
			resultPath := filepath.Join(oldResultsDir, e.Name())
			data, err := os.ReadFile(resultPath)
			if err != nil {
				continue
			}
			var result TestResult
			if err := json.Unmarshal(data, &result); err != nil {
				continue
			}
			if result.TestID == "" {
				continue
			}

			// Find projectID by scanning migrated tests.
			projectID := result.ProjectID
			if projectID == "" {
				test, err := s.FindTest(result.TestID)
				if err != nil {
					continue
				}
				projectID = test.ProjectID
			}

			if result.ID == "" {
				// Derive from filename: {testID}_{execID}.json or {execID}.json
				name := strings.TrimSuffix(e.Name(), ".json")
				parts := strings.SplitN(name, "_", 2)
				if len(parts) == 2 {
					result.ID = parts[1]
				} else {
					result.ID = name
				}
			}

			execDir := s.executionDir(projectID, result.TestID, result.ID)
			if _, err := os.Stat(filepath.Join(execDir, "report.json")); err == nil {
				os.Remove(resultPath)
				continue
			}
			if err := os.MkdirAll(execDir, 0o755); err != nil {
				continue
			}

			// Write output.log separately.
			if result.Output != "" {
				_ = os.WriteFile(filepath.Join(execDir, "output.log"), []byte(result.Output), 0o644)
			}
			// Write report.json without output.
			result.ProjectID = projectID
			result.Output = ""
			reportData, err := json.MarshalIndent(result, "", "  ")
			if err != nil {
				continue
			}
			if err := os.WriteFile(filepath.Join(execDir, "report.json"), reportData, 0o644); err != nil {
				continue
			}
			os.Remove(resultPath)
			s.logger.Info("migrated result", "testId", result.TestID, "execId", result.ID)
		}
		// Clean up empty old results dir.
		if entries2, err := os.ReadDir(oldResultsDir); err == nil && len(entries2) == 0 {
			os.Remove(oldResultsDir)
		}
	}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
			t, err := time.Parse(time.RFC3339Nano, s)
			if err == nil {
				return t
			}
			t, err = time.Parse(time.RFC3339, s)
			if err == nil {
				return t
			}
		}
	}
	return time.Time{}
}

