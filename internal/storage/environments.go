package storage

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

var envNonAlpha = regexp.MustCompile(`[^a-zA-Z0-9_-]+`)

func (s *Storage) envDir(envID string) string {
	return filepath.Join(s.environmentsDir, envID)
}

func (s *Storage) envFile(envID string) string {
	return filepath.Join(s.envDir(envID), "env.json")
}

// deriveEnvID produces a filesystem-safe ID from an environment name.
func deriveEnvID(name string) string {
	id := strings.ToLower(envNonAlpha.ReplaceAllString(name, "-"))
	id = strings.Trim(id, "-")
	if id == "" {
		id = fmt.Sprintf("env-%d", time.Now().UnixNano())
	}
	return id
}

// ListEnvironments returns all environments sorted by name.
func (s *Storage) ListEnvironments() ([]*Environment, error) {
	entries, err := os.ReadDir(s.environmentsDir)
	if err != nil {
		return nil, fmt.Errorf("list environments: %w", err)
	}
	var envs []*Environment
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		env, err := s.GetEnvironment(e.Name())
		if err != nil {
			s.logger.Warn("skip invalid environment", "id", e.Name(), "error", err)
			continue
		}
		envs = append(envs, env)
	}
	return envs, nil
}

// GetEnvironment loads a single environment by ID.
func (s *Storage) GetEnvironment(id string) (*Environment, error) {
	data, err := os.ReadFile(s.envFile(id))
	if err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("environment %q not found", id)
		}
		return nil, fmt.Errorf("read environment: %w", err)
	}
	var env Environment
	if err := json.Unmarshal(data, &env); err != nil {
		return nil, fmt.Errorf("parse environment %q: %w", id, err)
	}
	return &env, nil
}

// CreateEnvironment persists a new environment. If env.ID is empty it is
// derived from env.Name. Returns an error if the ID already exists.
func (s *Storage) CreateEnvironment(env *Environment) error {
	if env.ID == "" {
		base := deriveEnvID(env.Name)
		id := base
		for i := 2; ; i++ {
			if _, err := os.Stat(s.envDir(id)); os.IsNotExist(err) {
				break
			}
			id = fmt.Sprintf("%s-%d", base, i)
		}
		env.ID = id
	}
	if env.Properties == nil {
		env.Properties = map[string]string{}
	}
	now := time.Now()
	env.CreatedAt = now
	env.UpdatedAt = now

	if err := os.MkdirAll(s.envDir(env.ID), 0o755); err != nil {
		return fmt.Errorf("create environment dir: %w", err)
	}
	data, err := json.MarshalIndent(env, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal environment: %w", err)
	}
	return os.WriteFile(s.envFile(env.ID), data, 0o644)
}

// UpdateEnvironment overwrites an existing environment. The ID must match an
// existing directory; CreatedAt is preserved from the stored record.
func (s *Storage) UpdateEnvironment(env *Environment) error {
	existing, err := s.GetEnvironment(env.ID)
	if err != nil {
		return err
	}
	env.CreatedAt = existing.CreatedAt
	env.UpdatedAt = time.Now()
	if env.Properties == nil {
		env.Properties = map[string]string{}
	}
	data, err := json.MarshalIndent(env, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal environment: %w", err)
	}
	return os.WriteFile(s.envFile(env.ID), data, 0o644)
}

// DeleteEnvironment removes the environment directory and all its contents.
func (s *Storage) DeleteEnvironment(id string) error {
	if _, err := s.GetEnvironment(id); err != nil {
		return err
	}
	return os.RemoveAll(s.envDir(id))
}
