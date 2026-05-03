package testclient

import (
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/prasenjit-net/gherkin-tester/internal/storage"
)

// MockExecutor returns hardcoded passed results without running anything.
type MockExecutor struct{}

func (m *MockExecutor) Execute(testPath string, testFeature *storage.Test, env map[string]string, tags []string) (*storage.TestResult, error) {
	karateConfig, _ := RenderKarateConfig(env)
	result := &storage.TestResult{
		TestID:       testFeature.ID,
		Status:       "passed",
		Message:      "Mock execution (no Karate JAR configured)",
		Output:       fmt.Sprintf("Executed test: %s", testFeature.Name),
		KarateConfig: karateConfig,
		StartedAt:    time.Now().Add(-2 * time.Second),
		EndedAt:      time.Now(),
		Duration:     2000,
		Scenarios:    1,
		Passed:       1,
		Failed:       0,
	}
	return result, nil
}

func (m *MockExecutor) IsAvailable() bool {
	return true
}

// KarateExecutor runs feature files using the Karate standalone JAR.
type KarateExecutor struct {
	jarPath  string
	javaPath string
	logger   *slog.Logger
}

func (k *KarateExecutor) IsAvailable() bool {
	return true
}

var (
	reANSI             = regexp.MustCompile(`\x1b\[[0-9;]*m`)
	reSummaryScenarios = regexp.MustCompile(`scenarios:\s+(\d+)\s*\|\s*passed:\s+(\d+)\s*\|[^|]*(\d+)?\s*fail`)
	reSummaryPassed    = regexp.MustCompile(`scenarios:\s+(\d+)\s*\|\s*passed:\s+(\d+)\s*\|\s*all passed`)
	reElapsed          = regexp.MustCompile(`elapsed:\s+([\d.]+)s`)
)

func (k *KarateExecutor) Execute(testPath string, testFeature *storage.Test, env map[string]string, tags []string) (*storage.TestResult, error) {
	// Write the feature file to a temp working directory so Karate can find it.
	workDir, err := os.MkdirTemp("", "karate-run-*")
	if err != nil {
		return nil, fmt.Errorf("create temp dir: %w", err)
	}
	defer os.RemoveAll(workDir)

	featurePath := filepath.Join(workDir, "test.feature")
	if err := os.WriteFile(featurePath, []byte(testFeature.Content), 0644); err != nil {
		return nil, fmt.Errorf("write feature file: %w", err)
	}

	// Generate and write karate-config.js to the work dir so Karate picks it up.
	karateConfig, err := RenderKarateConfig(env)
	if err != nil {
		return nil, fmt.Errorf("render karate-config.js: %w", err)
	}
	if err := os.WriteFile(filepath.Join(workDir, "karate-config.js"), []byte(karateConfig), 0644); err != nil {
		return nil, fmt.Errorf("write karate-config.js: %w", err)
	}

	startedAt := time.Now()

	// Build java args: JVM -D flags, then -jar, then feature path, then --tags.
	javaArgs := []string{}
	for k, v := range env {
		javaArgs = append(javaArgs, fmt.Sprintf("-D%s=%s", k, v))
	}
	javaArgs = append(javaArgs, "-jar", k.jarPath, featurePath)
	if len(tags) > 0 {
		// Prefix each tag with @ if not already present.
		tagged := make([]string, len(tags))
		for i, t := range tags {
			if !strings.HasPrefix(t, "@") {
				tagged[i] = "@" + t
			} else {
				tagged[i] = t
			}
		}
		javaArgs = append(javaArgs, "--tags", strings.Join(tagged, ","))
	}

	cmd := exec.Command(k.javaPath, javaArgs...)
	cmd.Dir = workDir

	out, execErr := cmd.CombinedOutput()
	endedAt := time.Now()
	output := string(out)
	// Strip ANSI color codes before parsing
	cleanOutput := reANSI.ReplaceAllString(output, "")

	duration := endedAt.Sub(startedAt).Milliseconds()
	result := &storage.TestResult{
		TestID:       testFeature.ID,
		Output:       cleanOutput,
		KarateConfig: karateConfig,
		StartedAt:    startedAt,
		EndedAt:      endedAt,
		Duration:     duration,
	}

	// Parse elapsed time from output if available.
	if m := reElapsed.FindStringSubmatch(cleanOutput); len(m) > 1 {
		if secs, err := strconv.ParseFloat(m[1], 64); err == nil {
			result.Duration = int64(secs * 1000)
		}
	}

	// Determine pass/fail from the summary line.
	if m := reSummaryPassed.FindStringSubmatch(cleanOutput); len(m) > 2 {
		result.Scenarios, _ = strconv.Atoi(m[1])
		result.Passed, _ = strconv.Atoi(m[2])
		result.Failed = 0
		result.Status = "passed"
		result.Message = fmt.Sprintf("%d/%d scenarios passed", result.Passed, result.Scenarios)
	} else if m := reSummaryScenarios.FindStringSubmatch(cleanOutput); len(m) > 2 {
		result.Scenarios, _ = strconv.Atoi(m[1])
		result.Passed, _ = strconv.Atoi(m[2])
		result.Failed = result.Scenarios - result.Passed
		result.Status = "failed"
		result.Message = fmt.Sprintf("%d/%d scenarios passed, %d failed", result.Passed, result.Scenarios, result.Failed)
	} else if execErr != nil {
		// Execution error — couldn't even run the scenarios.
		result.Status = "error"
		result.Message = extractErrorMessage(cleanOutput, execErr.Error())
	} else {
		result.Status = "passed"
		result.Message = "Completed (no summary found)"
	}

	k.logger.Info("karate execution complete",
		"testID", testFeature.ID,
		"status", result.Status,
		"duration_ms", result.Duration,
	)

	return result, nil
}

func extractErrorMessage(output, fallback string) string {
	lines := strings.Split(strings.TrimSpace(output), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.Contains(line, "ERROR") || strings.Contains(line, "Exception") {
			return line
		}
	}
	return fallback
}
