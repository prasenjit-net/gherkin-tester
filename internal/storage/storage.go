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
projectsDir   string
executionsDir string
logger        *slog.Logger
}

func New(dataDir string, logger *slog.Logger) (*Storage, error) {
projectsDir := filepath.Join(dataDir, "projects")
executionsDir := filepath.Join(dataDir, "executions")

for _, dir := range []string{projectsDir, executionsDir} {
if err := os.MkdirAll(dir, 0o755); err != nil {
return nil, fmt.Errorf("create dir %s: %w", dir, err)
}
}

st := &Storage{
projectsDir:   projectsDir,
executionsDir: executionsDir,
logger:        logger,
}
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

func (s *Storage) execDir(execID string) string {
return filepath.Join(s.executionsDir, execID)
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
if err := os.RemoveAll(s.projectDir(projectID)); err != nil && !os.IsNotExist(err) {
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
return s.writeTest(test)
}

func (s *Storage) UpdateTest(test *Test) error {
test.UpdatedAt = time.Now()
return s.writeTest(test)
}

func (s *Storage) writeTest(test *Test) error {
dir := s.testDir(test.ProjectID, test.ID)
if err := os.MkdirAll(dir, 0o755); err != nil {
return fmt.Errorf("create test dir: %w", err)
}
if err := os.WriteFile(filepath.Join(dir, "test.feature"), []byte(test.Content), 0o644); err != nil {
return fmt.Errorf("write feature: %w", err)
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
data, err := json.MarshalIndent(meta, "", "  ")
if err != nil {
return fmt.Errorf("marshal test meta: %w", err)
}
if err := os.WriteFile(filepath.Join(dir, "test.json"), data, 0o644); err != nil {
return fmt.Errorf("write test meta: %w", err)
}
s.logger.Info("test saved", "id", test.ID, "projectId", test.ProjectID)
return nil
}

func (s *Storage) GetTest(projectID, testID string) (*Test, error) {
dir := s.testDir(projectID, testID)
metaData, err := os.ReadFile(filepath.Join(dir, "test.json"))
if err != nil {
return nil, fmt.Errorf("read test meta: %w", err)
}
var meta map[string]interface{}
if err := json.Unmarshal(metaData, &meta); err != nil {
return nil, fmt.Errorf("unmarshal test meta: %w", err)
}
content, err := os.ReadFile(filepath.Join(dir, "test.feature"))
if err != nil {
return nil, fmt.Errorf("read feature: %w", err)
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

// FindTest scans all projects to locate a test by ID alone (for legacy routes).
func (s *Storage) FindTest(testID string) (*Test, error) {
projects, err := s.ListProjects()
if err != nil {
return nil, err
}
for _, p := range projects {
if test, err := s.GetTest(p.ID, testID); err == nil {
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
if err := os.RemoveAll(s.testDir(projectID, testID)); err != nil && !os.IsNotExist(err) {
return fmt.Errorf("delete test: %w", err)
}
s.logger.Info("test deleted", "id", testID)
return nil
}

// ─── Executions ───────────────────────────────────────────────────────────────
//
// Each execution lives in executions/{execID}/ and contains:
//   execution.json  — metadata: id, projectId, testId, testName, status, timestamps, message
//   report.json     — karate results: scenarios, passed, failed, duration
//   test.feature    — snapshot of the feature file at execution time
//   output.log      — raw karate stdout/stderr

type executionMeta struct {
ID        string    `json:"id"`
ProjectID string    `json:"projectId"`
TestID    string    `json:"testId"`
TestName  string    `json:"testName,omitempty"`
Status    string    `json:"status"`
Message   string    `json:"message,omitempty"`
StartedAt time.Time `json:"startedAt"`
EndedAt   time.Time `json:"endedAt"`
}

type executionReport struct {
Scenarios int   `json:"scenarios"`
Passed    int   `json:"passed"`
Failed    int   `json:"failed"`
Duration  int64 `json:"duration"`
}

func (s *Storage) SaveTestResult(result *TestResult) error {
if result.ID == "" {
result.ID = fmt.Sprintf("%d", time.Now().UnixNano())
}

dir := s.execDir(result.ID)
if err := os.MkdirAll(dir, 0o755); err != nil {
return fmt.Errorf("create execution dir: %w", err)
}

// execution.json — identity + status
meta := executionMeta{
ID:        result.ID,
ProjectID: result.ProjectID,
TestID:    result.TestID,
TestName:  result.TestName,
Status:    result.Status,
Message:   result.Message,
StartedAt: result.StartedAt,
EndedAt:   result.EndedAt,
}
if data, err := json.MarshalIndent(meta, "", "  "); err == nil {
_ = os.WriteFile(filepath.Join(dir, "execution.json"), data, 0o644)
}

// report.json — karate result numbers
report := executionReport{
Scenarios: result.Scenarios,
Passed:    result.Passed,
Failed:    result.Failed,
Duration:  result.Duration,
}
if data, err := json.MarshalIndent(report, "", "  "); err == nil {
_ = os.WriteFile(filepath.Join(dir, "report.json"), data, 0o644)
}

// test.feature — snapshot of feature at execution time
featureSrc := filepath.Join(s.testDir(result.ProjectID, result.TestID), "test.feature")
if content, err := os.ReadFile(featureSrc); err == nil {
_ = os.WriteFile(filepath.Join(dir, "test.feature"), content, 0o644)
}

// output.log — raw karate output
if result.Output != "" {
_ = os.WriteFile(filepath.Join(dir, "output.log"), []byte(result.Output), 0o644)
}

s.logger.Info("execution saved", "id", result.ID, "testId", result.TestID, "status", result.Status)
return nil
}

func (s *Storage) GetExecution(execID string) (*TestResult, error) {
dir := s.execDir(execID)

metaData, err := os.ReadFile(filepath.Join(dir, "execution.json"))
if err != nil {
return nil, fmt.Errorf("read execution.json: %w", err)
}
var meta executionMeta
if err := json.Unmarshal(metaData, &meta); err != nil {
return nil, fmt.Errorf("unmarshal execution.json: %w", err)
}

result := &TestResult{
ID:        meta.ID,
ProjectID: meta.ProjectID,
TestID:    meta.TestID,
TestName:  meta.TestName,
Status:    meta.Status,
Message:   meta.Message,
StartedAt: meta.StartedAt,
EndedAt:   meta.EndedAt,
}

if reportData, err := os.ReadFile(filepath.Join(dir, "report.json")); err == nil {
var rep executionReport
if json.Unmarshal(reportData, &rep) == nil {
result.Scenarios = rep.Scenarios
result.Passed = rep.Passed
result.Failed = rep.Failed
result.Duration = rep.Duration
}
}

if out, err := os.ReadFile(filepath.Join(dir, "output.log")); err == nil {
result.Output = string(out)
}

return result, nil
}

// GetTestResult is an alias kept for handler compatibility.
func (s *Storage) GetTestResult(execID string) (*TestResult, error) {
return s.GetExecution(execID)
}

func (s *Storage) ListTestResults(projectID, testID string) ([]TestResult, error) {
entries, err := os.ReadDir(s.executionsDir)
if err != nil {
return nil, fmt.Errorf("read executions dir: %w", err)
}

var results []TestResult
for _, e := range entries {
if !e.IsDir() {
continue
}
// Read only execution.json to check projectId/testId before loading full result.
metaPath := filepath.Join(s.execDir(e.Name()), "execution.json")
metaData, err := os.ReadFile(metaPath)
if err != nil {
continue
}
var meta executionMeta
if err := json.Unmarshal(metaData, &meta); err != nil {
continue
}
if meta.ProjectID != projectID || meta.TestID != testID {
continue
}
result, err := s.GetExecution(e.Name())
if err != nil {
s.logger.Error("failed to load execution", "id", e.Name(), "error", err)
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

// migrate moves data from previous layouts to the current one (idempotent).
func (s *Storage) migrate(dataDir string) {
// Phase 1: flat projects/{id}.json → projects/{id}/project.json
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
data, _ := os.ReadFile(oldPath)
if len(data) > 0 {
if os.WriteFile(newPath, data, 0o644) == nil {
os.Remove(oldPath)
s.logger.Info("migrated project", "id", id)
}
}
}
}

// Phase 2: flat data/tests/{id}.json+feature → projects/{projectId}/tests/{id}/
oldTestsDir := filepath.Join(dataDir, "tests")
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
if json.Unmarshal(metaData, &meta) != nil {
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
if os.MkdirAll(newDir, 0o755) == nil {
os.WriteFile(filepath.Join(newDir, "test.json"), metaData, 0o644)
if content, err := os.ReadFile(featurePath); err == nil {
os.WriteFile(filepath.Join(newDir, "test.feature"), content, 0o644)
}
os.Remove(metaPath)
os.Remove(featurePath)
s.logger.Info("migrated test", "id", testID, "projectId", projectID)
}
}
if entries2, _ := os.ReadDir(oldTestsDir); len(entries2) == 0 {
os.Remove(oldTestsDir)
}
}

// Phase 3: flat data/results/{testID}_{execID}.json → executions/{execID}/
oldResultsDir := filepath.Join(dataDir, "results")
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
if json.Unmarshal(data, &result) != nil {
continue
}
if result.TestID == "" {
continue
}
projectID := result.ProjectID
if projectID == "" {
if test, err := s.FindTest(result.TestID); err == nil {
projectID = test.ProjectID
}
}
if result.ID == "" {
name := strings.TrimSuffix(e.Name(), ".json")
parts := strings.SplitN(name, "_", 2)
if len(parts) == 2 {
result.ID = parts[1]
} else {
result.ID = name
}
}
execDir := s.execDir(result.ID)
if _, err := os.Stat(filepath.Join(execDir, "execution.json")); err == nil {
os.Remove(resultPath)
continue
}
result.ProjectID = projectID
if os.MkdirAll(execDir, 0o755) == nil {
meta := executionMeta{
ID: result.ID, ProjectID: result.ProjectID,
TestID: result.TestID, TestName: result.TestName,
Status: result.Status, Message: result.Message,
StartedAt: result.StartedAt, EndedAt: result.EndedAt,
}
if metaBytes, err := json.MarshalIndent(meta, "", "  "); err == nil {
os.WriteFile(filepath.Join(execDir, "execution.json"), metaBytes, 0o644)
}
report := executionReport{
Scenarios: result.Scenarios, Passed: result.Passed,
Failed: result.Failed, Duration: result.Duration,
}
if repBytes, err := json.MarshalIndent(report, "", "  "); err == nil {
os.WriteFile(filepath.Join(execDir, "report.json"), repBytes, 0o644)
}
if result.Output != "" {
os.WriteFile(filepath.Join(execDir, "output.log"), []byte(result.Output), 0o644)
}
os.Remove(resultPath)
s.logger.Info("migrated result", "testId", result.TestID, "execId", result.ID)
}
}
if entries2, _ := os.ReadDir(oldResultsDir); len(entries2) == 0 {
os.Remove(oldResultsDir)
}
}

// Phase 4: projects/{p}/tests/{t}/executions/{e}/ → executions/{e}/
if projEntries, err := os.ReadDir(s.projectsDir); err == nil {
for _, pe := range projEntries {
if !pe.IsDir() {
continue
}
projectID := pe.Name()
testsRoot := filepath.Join(s.projectDir(projectID), "tests")
testEntries, err := os.ReadDir(testsRoot)
if err != nil {
continue
}
for _, te := range testEntries {
if !te.IsDir() {
continue
}
testID := te.Name()
execsRoot := filepath.Join(s.testDir(projectID, testID), "executions")
execEntries, err := os.ReadDir(execsRoot)
if err != nil {
continue
}
for _, ee := range execEntries {
if !ee.IsDir() {
continue
}
execID := ee.Name()
oldExecDir := filepath.Join(execsRoot, execID)
newExecDir := s.execDir(execID)

// Skip if already migrated.
if _, err := os.Stat(filepath.Join(newExecDir, "execution.json")); err == nil {
os.RemoveAll(oldExecDir)
continue
}

if os.MkdirAll(newExecDir, 0o755) != nil {
continue
}

// Try to read existing report.json from old location.
var rep executionReport
var metaStatus, metaMsg string
var metaStart, metaEnd time.Time

if repData, err := os.ReadFile(filepath.Join(oldExecDir, "report.json")); err == nil {
var old struct {
ID        string    `json:"id"`
Status    string    `json:"status"`
Message   string    `json:"message"`
Scenarios int       `json:"scenarios"`
Passed    int       `json:"passed"`
Failed    int       `json:"failed"`
Duration  int64     `json:"duration"`
StartedAt time.Time `json:"startedAt"`
EndedAt   time.Time `json:"endedAt"`
}
if json.Unmarshal(repData, &old) == nil {
rep = executionReport{
Scenarios: old.Scenarios, Passed: old.Passed,
Failed: old.Failed, Duration: old.Duration,
}
metaStatus = old.Status
metaMsg = old.Message
metaStart = old.StartedAt
metaEnd = old.EndedAt
}
}

meta := executionMeta{
ID: execID, ProjectID: projectID, TestID: testID,
Status: metaStatus, Message: metaMsg,
StartedAt: metaStart, EndedAt: metaEnd,
}
if metaBytes, err := json.MarshalIndent(meta, "", "  "); err == nil {
os.WriteFile(filepath.Join(newExecDir, "execution.json"), metaBytes, 0o644)
}
if repBytes, err := json.MarshalIndent(rep, "", "  "); err == nil {
os.WriteFile(filepath.Join(newExecDir, "report.json"), repBytes, 0o644)
}
// Copy output.log and test.feature if present.
for _, fname := range []string{"output.log", "test.feature"} {
if content, err := os.ReadFile(filepath.Join(oldExecDir, fname)); err == nil {
os.WriteFile(filepath.Join(newExecDir, fname), content, 0o644)
}
}
os.RemoveAll(oldExecDir)
s.logger.Info("migrated execution", "id", execID, "projectId", projectID, "testId", testID)
}
// Remove empty executions dir.
if ee2, _ := os.ReadDir(execsRoot); len(ee2) == 0 {
os.Remove(execsRoot)
}
}
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
out := make([]string, 0, len(arr))
for _, item := range arr {
if s, ok := item.(string); ok {
out = append(out, s)
}
}
return out
}
}
return []string{}
}

func getTime(m map[string]interface{}, key string) time.Time {
if v, ok := m[key]; ok {
if s, ok := v.(string); ok {
if t, err := time.Parse(time.RFC3339Nano, s); err == nil {
return t
}
if t, err := time.Parse(time.RFC3339, s); err == nil {
return t
}
}
}
return time.Time{}
}
