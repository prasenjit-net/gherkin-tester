package storage

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// GitStatusResult contains the current git state for a project directory.
type GitStatusResult struct {
	Branch     string `json:"branch"`
	Ahead      int    `json:"ahead"`
	Behind     int    `json:"behind"`
	Dirty      bool   `json:"dirty"`
	LastCommit string `json:"lastCommit,omitempty"`
}

var nonAlphaNum = regexp.MustCompile(`[^a-zA-Z0-9_-]+`)

// deriveProjectID produces a filesystem-safe ID from a git URL.
// e.g. https://github.com/user/my-repo.git  →  my-repo
func deriveProjectID(rawURL string) string {
	u, err := url.Parse(rawURL)
	if err != nil {
		return fmt.Sprintf("git-%d", time.Now().UnixNano())
	}
	base := filepath.Base(u.Path)
	base = strings.TrimSuffix(base, ".git")
	base = nonAlphaNum.ReplaceAllString(base, "-")
	base = strings.Trim(base, "-")
	if base == "" {
		return fmt.Sprintf("git-%d", time.Now().UnixNano())
	}
	return base
}

// ensureUniqueID appends a numeric suffix if the directory already exists.
func (s *Storage) ensureUniqueID(base string) string {
	id := base
	for i := 2; ; i++ {
		if _, err := os.Stat(s.projectDir(id)); os.IsNotExist(err) {
			return id
		}
		id = fmt.Sprintf("%s-%d", base, i)
	}
}

// normalizeGitURL strips trailing slashes and a ".git" suffix so that
// https://github.com/user/repo and https://github.com/user/repo.git are
// treated as the same repository.
func normalizeGitURL(raw string) string {
	raw = strings.TrimRight(raw, "/")
	raw = strings.TrimSuffix(raw, ".git")
	return strings.ToLower(raw)
}

// ImportProjectFromGit clones a remote git repository into the projects
// directory and returns a Project ready to use. If project.json already
// exists in the cloned repo it is used; otherwise a new one is created.
func (s *Storage) ImportProjectFromGit(repoURL, branch, name, description, karateVersion string) (*Project, error) {
	// Guard: reject if a project with the same git URL already exists.
	if existing, err := s.ListProjects(); err == nil {
		norm := normalizeGitURL(repoURL)
		for _, p := range existing {
			if p.GitURL != "" && normalizeGitURL(p.GitURL) == norm {
				return nil, fmt.Errorf("project %q already imported from %s", p.Name, repoURL)
			}
		}
	}

	baseID := deriveProjectID(repoURL)
	projectID := s.ensureUniqueID(baseID)
	targetDir := s.projectDir(projectID)

	// git clone
	cloneArgs := []string{"clone", "--depth", "1"}
	if branch != "" {
		cloneArgs = append(cloneArgs, "--branch", branch)
	}
	cloneArgs = append(cloneArgs, repoURL, targetDir)

	if out, err := runGit("", cloneArgs...); err != nil {
		return nil, fmt.Errorf("git clone failed: %w\n%s", err, out)
	}

	// Determine effective branch
	effectiveBranch := branch
	if effectiveBranch == "" {
		if b, err := gitCurrentBranch(targetDir); err == nil {
			effectiveBranch = b
		}
	}

	// Check for existing project.json
	metaPath := filepath.Join(targetDir, "project.json")
	if data, err := os.ReadFile(metaPath); err == nil {
		var existing Project
		if jsonErr := json.Unmarshal(data, &existing); jsonErr == nil {
			// Overwrite the ID to match our chosen directory name,
			// and stamp git metadata.
			existing.ID = projectID
			existing.GitURL = repoURL
			existing.GitBranch = effectiveBranch
			if name != "" {
				existing.Name = name
			}
			if description != "" {
				existing.Description = description
			}
			if karateVersion != "" {
				existing.KarateVersion = karateVersion
			}
			if err := s.UpdateProject(&existing); err != nil {
				return nil, err
			}
			s.logger.Info("git project imported (existing metadata)", "id", projectID, "url", repoURL)
			return &existing, nil
		}
	}

	// No existing project.json — create one from scratch
	effectiveName := name
	if effectiveName == "" {
		effectiveName = projectID
	}
	project := &Project{
		ID:            projectID,
		Name:          effectiveName,
		Description:   description,
		KarateVersion: karateVersion,
		GitURL:        repoURL,
		GitBranch:     effectiveBranch,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}
	data, err := json.MarshalIndent(project, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("marshal project: %w", err)
	}
	if err := os.WriteFile(metaPath, data, 0o644); err != nil {
		return nil, fmt.Errorf("write project.json: %w", err)
	}
	s.logger.Info("git project imported (new metadata)", "id", projectID, "url", repoURL)
	return project, nil
}

// GitStatus returns the current git status for a project.
func (s *Storage) GitStatus(projectID string) (*GitStatusResult, error) {
	dir := s.projectDir(projectID)
	if !isGitRepo(dir) {
		return nil, fmt.Errorf("project %s is not a git repository", projectID)
	}

	result := &GitStatusResult{}

	result.Branch, _ = gitCurrentBranch(dir)

	// Check dirty (uncommitted changes)
	if out, err := runGit(dir, "status", "--porcelain"); err == nil {
		result.Dirty = strings.TrimSpace(out) != ""
	}

	// Ahead / behind relative to upstream
	if out, err := runGit(dir, "rev-list", "--count", "--left-right", "@{upstream}...HEAD"); err == nil {
		parts := strings.Fields(strings.TrimSpace(out))
		if len(parts) == 2 {
			result.Behind, _ = strconv.Atoi(parts[0])
			result.Ahead, _ = strconv.Atoi(parts[1])
		}
	}

	// Last commit subject
	if out, err := runGit(dir, "log", "-1", "--pretty=%s"); err == nil {
		result.LastCommit = strings.TrimSpace(out)
	}

	return result, nil
}

// GitCommitAndPush stages all changes, creates a commit, and pushes to the
// tracked remote branch.
func (s *Storage) GitCommitAndPush(projectID, message string) error {
	dir := s.projectDir(projectID)
	if !isGitRepo(dir) {
		return fmt.Errorf("project %s is not a git repository", projectID)
	}

	if message == "" {
		message = fmt.Sprintf("Update tests [%s]", time.Now().Format("2006-01-02 15:04:05"))
	}

	if out, err := runGit(dir, "add", "-A"); err != nil {
		return fmt.Errorf("git add failed: %w\n%s", err, out)
	}
	if out, err := runGit(dir, "commit", "-m", message); err != nil {
		return fmt.Errorf("git commit failed: %w\n%s", err, out)
	}
	if out, err := runGit(dir, "push"); err != nil {
		return fmt.Errorf("git push failed: %w\n%s", err, out)
	}
	s.logger.Info("git commit+push", "project", projectID, "message", message)
	return nil
}

// ─── helpers ─────────────────────────────────────────────────────────────────

func isGitRepo(dir string) bool {
	_, err := os.Stat(filepath.Join(dir, ".git"))
	return err == nil
}

func gitCurrentBranch(dir string) (string, error) {
	out, err := runGit(dir, "rev-parse", "--abbrev-ref", "HEAD")
	return strings.TrimSpace(out), err
}

// runGit executes a git sub-command, optionally in a working directory.
// Returns combined stdout+stderr and any error.
func runGit(dir string, args ...string) (string, error) {
	cmd := exec.Command("git", args...)
	if dir != "" {
		cmd.Dir = dir
	}
	var buf bytes.Buffer
	cmd.Stdout = &buf
	cmd.Stderr = &buf
	err := cmd.Run()
	return buf.String(), err
}
