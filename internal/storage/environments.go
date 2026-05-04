package storage

import (
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

var envNonAlpha = regexp.MustCompile(`[^a-zA-Z0-9_-]+`)
var envFileNameSafe = regexp.MustCompile(`[^a-zA-Z0-9._-]+`)

func (s *Storage) envDir(envID string) string {
	return filepath.Join(s.environmentsDir, envID)
}

func (s *Storage) envFile(envID string) string {
	return filepath.Join(s.envDir(envID), "env.json")
}

func (s *Storage) envAssetsDir(envID string) string {
	return filepath.Join(s.envDir(envID), "assets")
}

func (s *Storage) envMTLSDir(envID string) string {
	return filepath.Join(s.envAssetsDir(envID), "mtls")
}

func (s *Storage) envMTLSFile(envID, fileName string) string {
	return filepath.Join(s.envMTLSDir(envID), fileName)
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

func sanitizeEnvFileName(name, fallback string) string {
	base := filepath.Base(strings.TrimSpace(name))
	base = envFileNameSafe.ReplaceAllString(base, "-")
	base = strings.Trim(base, "-.")
	if base == "" {
		return fallback
	}
	return base
}

func (s *Storage) hydrateEnvironment(env *Environment) {
	if env.Properties == nil {
		env.Properties = map[string]string{}
	}
	if env.MTLS == nil {
		return
	}
	if env.MTLS.CertificateFileName == "" || env.MTLS.PrivateKeyFileName == "" {
		env.MTLS = nil
		return
	}
	env.MTLS.HasPrivateKeyPassword = env.MTLS.PrivateKeyPassword != ""
	env.MTLS.CertificatePath = s.envMTLSFile(env.ID, env.MTLS.CertificateFileName)
	env.MTLS.PrivateKeyPath = s.envMTLSFile(env.ID, env.MTLS.PrivateKeyFileName)
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
	s.hydrateEnvironment(&env)
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
	s.hydrateEnvironment(env)
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
	s.hydrateEnvironment(env)
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

func (s *Storage) SaveEnvironmentMTLSFiles(envID string, certificateFile, privateKeyFile *multipart.FileHeader) (*EnvironmentMTLS, error) {
	if certificateFile == nil || privateKeyFile == nil {
		return nil, fmt.Errorf("both certificate and private key files are required")
	}
	if err := os.RemoveAll(s.envMTLSDir(envID)); err != nil && !os.IsNotExist(err) {
		return nil, fmt.Errorf("reset environment mTLS dir: %w", err)
	}
	if err := os.MkdirAll(s.envMTLSDir(envID), 0o700); err != nil {
		return nil, fmt.Errorf("create environment mTLS dir: %w", err)
	}

	certName := sanitizeEnvFileName(certificateFile.Filename, "client-cert.pem")
	keyName := sanitizeEnvFileName(privateKeyFile.Filename, "client-key.pem")
	if err := writeUploadedFile(s.envMTLSFile(envID, certName), certificateFile, 0o600); err != nil {
		return nil, err
	}
	if err := writeUploadedFile(s.envMTLSFile(envID, keyName), privateKeyFile, 0o600); err != nil {
		return nil, err
	}

	mtls := &EnvironmentMTLS{
		CertificateFileName: certName,
		PrivateKeyFileName:  keyName,
	}
	mtls.CertificatePath = s.envMTLSFile(envID, certName)
	mtls.PrivateKeyPath = s.envMTLSFile(envID, keyName)
	return mtls, nil
}

func (s *Storage) ClearEnvironmentMTLSFiles(envID string) error {
	if err := os.RemoveAll(s.envMTLSDir(envID)); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("remove environment mTLS files: %w", err)
	}
	return nil
}

func writeUploadedFile(dstPath string, header *multipart.FileHeader, mode os.FileMode) error {
	src, err := header.Open()
	if err != nil {
		return fmt.Errorf("open uploaded file %q: %w", header.Filename, err)
	}
	defer src.Close()

	dst, err := os.OpenFile(dstPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, mode)
	if err != nil {
		return fmt.Errorf("create uploaded file %q: %w", dstPath, err)
	}
	defer dst.Close()

	if _, err := io.Copy(dst, src); err != nil {
		return fmt.Errorf("write uploaded file %q: %w", dstPath, err)
	}
	return nil
}
