package storage

import "time"

type Project struct {
	ID            string    `json:"id"`
	Name          string    `json:"name"`
	Description   string    `json:"description"`
	KarateVersion string    `json:"karateVersion,omitempty"`
	GitURL        string    `json:"gitUrl,omitempty"`
	GitBranch     string    `json:"gitBranch,omitempty"`
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

type Test struct {
	ID          string    `json:"id"`
	ProjectID   string    `json:"projectId"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Content     string    `json:"content"`
	Tags        []string  `json:"tags"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type OpenAPIServer struct {
	URL         string `json:"url"`
	Description string `json:"description,omitempty"`
}

type OpenAPISummary struct {
	OpenAPIVersion  string          `json:"openapiVersion,omitempty"`
	Title           string          `json:"title,omitempty"`
	Version         string          `json:"version,omitempty"`
	Description     string          `json:"description,omitempty"`
	Servers         []OpenAPIServer `json:"servers,omitempty"`
	Tags            []string        `json:"tags,omitempty"`
	PathsCount      int             `json:"pathsCount"`
	OperationsCount int             `json:"operationsCount"`
}

type OpenAPIEndpoint struct {
	Path        string   `json:"path"`
	Method      string   `json:"method"`
	OperationID string   `json:"operationId,omitempty"`
	Summary     string   `json:"summary,omitempty"`
	Description string   `json:"description,omitempty"`
	Tags        []string `json:"tags,omitempty"`
	Deprecated  bool     `json:"deprecated,omitempty"`
}

type Spec struct {
	ID          string         `json:"id"`
	ProjectID   string         `json:"projectId"`
	Name        string         `json:"name"`
	Description string         `json:"description,omitempty"`
	FileName    string         `json:"fileName"`
	Format      string         `json:"format"`
	Summary     OpenAPISummary `json:"summary"`
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`
}

type SpecDetail struct {
	Spec      *Spec             `json:"spec"`
	Endpoints []OpenAPIEndpoint `json:"endpoints"`
	Content   string            `json:"content"`
}

type SpecGenerationRequest struct {
	Prompt string `json:"prompt"`
}

type GeneratedFeatureFile struct {
	Name        string   `json:"name"`
	Description string   `json:"description,omitempty"`
	Tags        []string `json:"tags,omitempty"`
	Content     string   `json:"content"`
}

type SpecGenerationResult struct {
	Provider string `json:"provider"`
	Model    string `json:"model"`
	Tests    []Test `json:"tests"`
}

type TestResult struct {
	ID            string    `json:"id"`
	TestID        string    `json:"testId"`
	ProjectID     string    `json:"projectId"`
	TestName      string    `json:"testName,omitempty"`
	EnvironmentID string    `json:"environmentId,omitempty"`
	Tags          []string  `json:"tags,omitempty"`
	KarateConfig  string    `json:"karateConfig,omitempty"`
	Status        string    `json:"status"`   // passed, failed, error
	Duration      int64     `json:"duration"` // milliseconds
	Message       string    `json:"message"`
	Output        string    `json:"output,omitempty"`
	StartedAt     time.Time `json:"startedAt"`
	EndedAt       time.Time `json:"endedAt"`
	Scenarios     int       `json:"scenarios"`
	Passed        int       `json:"passed"`
	Failed        int       `json:"failed"`
}

// KarateVersion represents a configured Karate JAR version.
type KarateVersion struct {
	Version string    `json:"version"`
	AddedAt time.Time `json:"addedAt"`
}

type EnvironmentMTLS struct {
	CertificateFileName   string `json:"certificateFileName,omitempty"`
	PrivateKeyFileName    string `json:"privateKeyFileName,omitempty"`
	PrivateKeyPassword    string `json:"privateKeyPassword,omitempty"`
	HasPrivateKeyPassword bool   `json:"hasPrivateKeyPassword,omitempty"`
	CertificatePath       string `json:"-"`
	PrivateKeyPath        string `json:"-"`
}

// Environment is a named collection of key-value properties used to
// parameterise test executions (e.g. "dev", "uat", "prod").
type Environment struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Description string            `json:"description,omitempty"`
	HTTPProxy   string            `json:"httpProxy,omitempty"`
	MTLS        *EnvironmentMTLS  `json:"mtls,omitempty"`
	Properties  map[string]string `json:"properties"`
	CreatedAt   time.Time         `json:"createdAt"`
	UpdatedAt   time.Time         `json:"updatedAt"`
}
