package storage

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"

	"go.yaml.in/yaml/v3"
)

var specNonAlpha = regexp.MustCompile(`[^a-zA-Z0-9_-]+`)
var specFileSafe = regexp.MustCompile(`[^a-zA-Z0-9._-]+`)

type SpecUpload struct {
	Name        string
	Description string
	FileName    string
	Content     []byte
}

type parsedSpec struct {
	Summary   OpenAPISummary
	Endpoints []OpenAPIEndpoint
}

type openAPIDocument struct {
	OpenAPI string                 `json:"openapi" yaml:"openapi"`
	Info    openAPIInfo            `json:"info" yaml:"info"`
	Servers []openAPIServer        `json:"servers" yaml:"servers"`
	Tags    []openAPITag           `json:"tags" yaml:"tags"`
	Paths   map[string]openAPIPath `json:"paths" yaml:"paths"`
}

type openAPIInfo struct {
	Title       string `json:"title" yaml:"title"`
	Version     string `json:"version" yaml:"version"`
	Description string `json:"description" yaml:"description"`
}

type openAPIServer struct {
	URL         string `json:"url" yaml:"url"`
	Description string `json:"description" yaml:"description"`
}

type openAPITag struct {
	Name string `json:"name" yaml:"name"`
}

type openAPIPath map[string]openAPIOperation

type openAPIOperation struct {
	OperationID string   `json:"operationId" yaml:"operationId"`
	Summary     string   `json:"summary" yaml:"summary"`
	Description string   `json:"description" yaml:"description"`
	Tags        []string `json:"tags" yaml:"tags"`
	Deprecated  bool     `json:"deprecated" yaml:"deprecated"`
}

func (s *Storage) specsDir(projectID string) string {
	return filepath.Join(s.projectDir(projectID), "specs")
}

func (s *Storage) specDir(projectID, specID string) string {
	return filepath.Join(s.specsDir(projectID), specID)
}

func (s *Storage) specMetaFile(projectID, specID string) string {
	return filepath.Join(s.specDir(projectID, specID), "spec.json")
}

func (s *Storage) specContentFile(projectID, specID, fileName string) string {
	return filepath.Join(s.specDir(projectID, specID), fileName)
}

func deriveSpecID(name string) string {
	id := strings.ToLower(specNonAlpha.ReplaceAllString(name, "-"))
	id = strings.Trim(id, "-")
	if id == "" {
		id = fmt.Sprintf("spec-%d", time.Now().UnixNano())
	}
	return id
}

func sanitizeSpecFileName(name string) string {
	base := filepath.Base(strings.TrimSpace(name))
	base = specFileSafe.ReplaceAllString(base, "-")
	base = strings.Trim(base, "-.")
	if base == "" {
		base = fmt.Sprintf("spec-%d.yaml", time.Now().UnixNano())
	}
	return base
}

func specFormatFromFileName(name string) (string, error) {
	switch strings.ToLower(filepath.Ext(name)) {
	case ".yaml", ".yml":
		return "yaml", nil
	case ".json":
		return "json", nil
	default:
		return "", fmt.Errorf("unsupported spec file type %q", filepath.Ext(name))
	}
}

func ParseOpenAPISpec(fileName string, content []byte) (*parsedSpec, error) {
	if len(content) == 0 {
		return nil, fmt.Errorf("spec file is empty")
	}
	if _, err := specFormatFromFileName(fileName); err != nil {
		return nil, err
	}

	var doc openAPIDocument
	if err := yaml.Unmarshal(content, &doc); err != nil {
		return nil, fmt.Errorf("parse spec: %w", err)
	}
	if !strings.HasPrefix(strings.TrimSpace(doc.OpenAPI), "3.") {
		return nil, fmt.Errorf("only OpenAPI 3.x specs are supported")
	}

	summary := OpenAPISummary{
		OpenAPIVersion: strings.TrimSpace(doc.OpenAPI),
		Title:          strings.TrimSpace(doc.Info.Title),
		Version:        strings.TrimSpace(doc.Info.Version),
		Description:    strings.TrimSpace(doc.Info.Description),
	}
	for _, server := range doc.Servers {
		if strings.TrimSpace(server.URL) == "" {
			continue
		}
		summary.Servers = append(summary.Servers, OpenAPIServer{
			URL:         strings.TrimSpace(server.URL),
			Description: strings.TrimSpace(server.Description),
		})
	}

	tagSet := map[string]struct{}{}
	for _, tag := range doc.Tags {
		if trimmed := strings.TrimSpace(tag.Name); trimmed != "" {
			tagSet[trimmed] = struct{}{}
		}
	}

	methods := []string{"get", "post", "put", "delete", "patch", "head", "options", "trace"}
	paths := make([]string, 0, len(doc.Paths))
	for path := range doc.Paths {
		paths = append(paths, path)
	}
	sort.Strings(paths)

	endpoints := make([]OpenAPIEndpoint, 0)
	summary.PathsCount = len(paths)
	for _, path := range paths {
		pathItem := doc.Paths[path]
		for _, method := range methods {
			op, ok := pathItem[method]
			if !ok {
				continue
			}
			trimmedTags := make([]string, 0, len(op.Tags))
			for _, tag := range op.Tags {
				if trimmed := strings.TrimSpace(tag); trimmed != "" {
					trimmedTags = append(trimmedTags, trimmed)
					tagSet[trimmed] = struct{}{}
				}
			}
			endpoints = append(endpoints, OpenAPIEndpoint{
				Path:        path,
				Method:      strings.ToUpper(method),
				OperationID: strings.TrimSpace(op.OperationID),
				Summary:     strings.TrimSpace(op.Summary),
				Description: strings.TrimSpace(op.Description),
				Tags:        trimmedTags,
				Deprecated:  op.Deprecated,
			})
			summary.OperationsCount++
		}
	}

	if len(tagSet) > 0 {
		summary.Tags = make([]string, 0, len(tagSet))
		for tag := range tagSet {
			summary.Tags = append(summary.Tags, tag)
		}
		sort.Strings(summary.Tags)
	}

	return &parsedSpec{
		Summary:   summary,
		Endpoints: endpoints,
	}, nil
}

func (s *Storage) CreateSpec(projectID string, upload SpecUpload) (*Spec, error) {
	if _, err := s.GetProject(projectID); err != nil {
		return nil, err
	}
	fileName := sanitizeSpecFileName(upload.FileName)
	format, err := specFormatFromFileName(fileName)
	if err != nil {
		return nil, err
	}
	parsed, err := ParseOpenAPISpec(fileName, upload.Content)
	if err != nil {
		return nil, err
	}

	name := strings.TrimSpace(upload.Name)
	if name == "" {
		if parsed.Summary.Title != "" {
			name = parsed.Summary.Title
		} else {
			name = strings.TrimSuffix(fileName, filepath.Ext(fileName))
		}
	}

	spec := &Spec{
		ProjectID:   projectID,
		Name:        name,
		Description: strings.TrimSpace(upload.Description),
		FileName:    fileName,
		Format:      format,
		Summary:     parsed.Summary,
	}

	baseID := deriveSpecID(name)
	spec.ID = baseID
	for i := 2; ; i++ {
		if _, err := os.Stat(s.specDir(projectID, spec.ID)); os.IsNotExist(err) {
			break
		}
		spec.ID = fmt.Sprintf("%s-%d", baseID, i)
	}

	now := time.Now()
	spec.CreatedAt = now
	spec.UpdatedAt = now

	if err := os.MkdirAll(s.specDir(projectID, spec.ID), 0o755); err != nil {
		return nil, fmt.Errorf("create spec dir: %w", err)
	}
	if err := os.WriteFile(s.specContentFile(projectID, spec.ID, spec.FileName), upload.Content, 0o644); err != nil {
		return nil, fmt.Errorf("write spec content: %w", err)
	}
	meta, err := json.MarshalIndent(spec, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("marshal spec metadata: %w", err)
	}
	if err := os.WriteFile(s.specMetaFile(projectID, spec.ID), meta, 0o644); err != nil {
		return nil, fmt.Errorf("write spec metadata: %w", err)
	}

	s.logger.Info("spec saved", "id", spec.ID, "projectId", projectID, "file", spec.FileName)
	return spec, nil
}

func (s *Storage) GetSpec(projectID, specID string) (*Spec, error) {
	data, err := os.ReadFile(s.specMetaFile(projectID, specID))
	if err != nil {
		return nil, fmt.Errorf("read spec metadata: %w", err)
	}
	var spec Spec
	if err := json.Unmarshal(data, &spec); err != nil {
		return nil, fmt.Errorf("unmarshal spec metadata: %w", err)
	}
	return &spec, nil
}

func (s *Storage) GetSpecDetail(projectID, specID string) (*SpecDetail, error) {
	spec, err := s.GetSpec(projectID, specID)
	if err != nil {
		return nil, err
	}
	content, err := os.ReadFile(s.specContentFile(projectID, specID, spec.FileName))
	if err != nil {
		return nil, fmt.Errorf("read spec content: %w", err)
	}
	parsed, err := ParseOpenAPISpec(spec.FileName, content)
	if err != nil {
		return nil, err
	}
	return &SpecDetail{
		Spec:      spec,
		Endpoints: parsed.Endpoints,
		Content:   string(content),
	}, nil
}

func (s *Storage) ListSpecsByProject(projectID string) ([]Spec, error) {
	entries, err := os.ReadDir(s.specsDir(projectID))
	if os.IsNotExist(err) {
		return []Spec{}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read specs dir: %w", err)
	}
	specs := make([]Spec, 0)
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		spec, err := s.GetSpec(projectID, entry.Name())
		if err != nil {
			s.logger.Error("failed to load spec", "projectId", projectID, "id", entry.Name(), "error", err)
			continue
		}
		specs = append(specs, *spec)
	}
	sort.Slice(specs, func(i, j int) bool {
		return specs[i].UpdatedAt.After(specs[j].UpdatedAt)
	})
	return specs, nil
}

func (s *Storage) DeleteSpec(projectID, specID string) error {
	if err := os.RemoveAll(s.specDir(projectID, specID)); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("delete spec: %w", err)
	}
	s.logger.Info("spec deleted", "id", specID, "projectId", projectID)
	return nil
}
