package ai

import (
	"bytes"
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"text/template"
	"time"

	"github.com/prasenjit-net/gherkin-tester/internal/config"
	"github.com/prasenjit-net/gherkin-tester/internal/storage"
)

//go:embed spec-generation-system.tmpl
var specGenerationSystemPromptText string

var specGenerationSystemPromptTmpl = template.Must(template.New("spec-generation-system").Parse(specGenerationSystemPromptText))

type Client struct {
	provider   string
	model      string
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

type chatCompletionRequest struct {
	Model          string        `json:"model"`
	Messages       []chatMessage `json:"messages"`
	Temperature    float64       `json:"temperature"`
	ResponseFormat *struct {
		Type string `json:"type"`
	} `json:"response_format,omitempty"`
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatCompletionResponse struct {
	Choices []struct {
		Message chatMessage `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

type generatedFilesEnvelope struct {
	Files []storage.GeneratedFeatureFile `json:"files"`
}

func NewClient(cfg config.AIConfig, httpClient *http.Client) *Client {
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 90 * time.Second}
	}
	return &Client{
		provider:   strings.TrimSpace(cfg.Provider),
		model:      strings.TrimSpace(cfg.Model),
		baseURL:    strings.TrimRight(strings.TrimSpace(cfg.BaseURL), "/"),
		apiKey:     strings.TrimSpace(cfg.APIKey),
		httpClient: httpClient,
	}
}

func (c *Client) Provider() string {
	return c.provider
}

func (c *Client) Model() string {
	return c.model
}

func (c *Client) Validate() error {
	missing := make([]string, 0, 4)
	if c.provider == "" {
		missing = append(missing, "provider")
	}
	if c.model == "" {
		missing = append(missing, "model")
	}
	if c.baseURL == "" {
		missing = append(missing, "baseURL")
	}
	if c.apiKey == "" {
		missing = append(missing, "apiKey")
	}
	if len(missing) > 0 {
		return fmt.Errorf("AI settings incomplete: %s", strings.Join(missing, ", "))
	}
	return nil
}

func (c *Client) GenerateSpecTests(ctx context.Context, project *storage.Project, detail *storage.SpecDetail, userPrompt string) ([]storage.GeneratedFeatureFile, error) {
	if err := c.Validate(); err != nil {
		return nil, err
	}
	if project == nil {
		return nil, fmt.Errorf("project is required")
	}
	if detail == nil || detail.Spec == nil {
		return nil, fmt.Errorf("spec detail is required")
	}

	systemPrompt, err := renderSystemPrompt(project, detail, userPrompt)
	if err != nil {
		return nil, err
	}
	payload := chatCompletionRequest{
		Model: c.model,
		Messages: []chatMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: buildUserPrompt(project, detail, userPrompt)},
		},
		Temperature: 0.2,
	}
	if strings.EqualFold(c.provider, "openai") {
		payload.ResponseFormat = &struct {
			Type string `json:"type"`
		}{Type: "json_object"}
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal ai request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("build ai request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("call ai provider: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read ai response: %w", err)
	}

	var completion chatCompletionResponse
	if err := json.Unmarshal(respBody, &completion); err != nil {
		return nil, fmt.Errorf("decode ai response: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		if completion.Error != nil && strings.TrimSpace(completion.Error.Message) != "" {
			return nil, fmt.Errorf("ai provider error: %s", completion.Error.Message)
		}
		return nil, fmt.Errorf("ai provider error: HTTP %d", resp.StatusCode)
	}
	if len(completion.Choices) == 0 {
		return nil, fmt.Errorf("ai provider returned no choices")
	}

	files, err := parseGeneratedFiles(completion.Choices[0].Message.Content)
	if err != nil {
		return nil, err
	}
	return files, nil
}

func renderSystemPrompt(project *storage.Project, detail *storage.SpecDetail, userPrompt string) (string, error) {
	var buf bytes.Buffer
	if err := specGenerationSystemPromptTmpl.Execute(&buf, map[string]any{
		"ProjectName":        strings.TrimSpace(project.Name),
		"SpecName":           strings.TrimSpace(detail.Spec.Name),
		"UserPromptProvided": strings.TrimSpace(userPrompt) != "",
	}); err != nil {
		return "", fmt.Errorf("render system prompt: %w", err)
	}
	return buf.String(), nil
}

func buildUserPrompt(project *storage.Project, detail *storage.SpecDetail, userPrompt string) string {
	var endpoints strings.Builder
	for _, endpoint := range detail.Endpoints {
		line := fmt.Sprintf("- %s %s", endpoint.Method, endpoint.Path)
		if endpoint.OperationID != "" {
			line += " (" + endpoint.OperationID + ")"
		}
		if endpoint.Summary != "" {
			line += ": " + endpoint.Summary
		}
		endpoints.WriteString(line + "\n")
	}

	effectiveUserPrompt := strings.TrimSpace(userPrompt)
	if effectiveUserPrompt == "" {
		effectiveUserPrompt = "Generate balanced, high-value coverage grounded in the spec, including happy-path and negative-path behavior where supported."
	}

	return strings.TrimSpace(fmt.Sprintf(`
Project:
- Name: %s
- Description: %s

Spec:
- Name: %s
- File: %s
- OpenAPI version: %s
- API title: %s
- API version: %s
- Paths: %d
- Operations: %d

Known endpoints:
%s

User prompt:
%s

OpenAPI spec document:
<openapi_spec>
%s
</openapi_spec>
`, strings.TrimSpace(project.Name),
		strings.TrimSpace(project.Description),
		strings.TrimSpace(detail.Spec.Name),
		strings.TrimSpace(detail.Spec.FileName),
		strings.TrimSpace(detail.Spec.Summary.OpenAPIVersion),
		strings.TrimSpace(detail.Spec.Summary.Title),
		strings.TrimSpace(detail.Spec.Summary.Version),
		detail.Spec.Summary.PathsCount,
		detail.Spec.Summary.OperationsCount,
		strings.TrimSpace(endpoints.String()),
		effectiveUserPrompt,
		strings.TrimSpace(detail.Content)))
}

func parseGeneratedFiles(content string) ([]storage.GeneratedFeatureFile, error) {
	trimmed := strings.TrimSpace(content)
	trimmed = strings.TrimPrefix(trimmed, "```json")
	trimmed = strings.TrimPrefix(trimmed, "```")
	trimmed = strings.TrimSuffix(trimmed, "```")
	trimmed = strings.TrimSpace(trimmed)

	var envelope generatedFilesEnvelope
	if err := json.Unmarshal([]byte(trimmed), &envelope); err != nil {
		return nil, fmt.Errorf("decode generated feature files: %w", err)
	}
	if len(envelope.Files) == 0 {
		return nil, fmt.Errorf("ai provider returned no feature files")
	}

	files := make([]storage.GeneratedFeatureFile, 0, len(envelope.Files))
	for i, file := range envelope.Files {
		file.Name = strings.TrimSpace(file.Name)
		file.Description = strings.TrimSpace(file.Description)
		file.Content = strings.TrimSpace(file.Content)
		if file.Name == "" {
			return nil, fmt.Errorf("generated feature file %d is missing a name", i+1)
		}
		if file.Content == "" {
			return nil, fmt.Errorf("generated feature file %q is missing content", file.Name)
		}
		normalizedTags := make([]string, 0, len(file.Tags))
		for _, tag := range file.Tags {
			trimmedTag := strings.TrimSpace(strings.TrimPrefix(tag, "@"))
			if trimmedTag != "" {
				normalizedTags = append(normalizedTags, trimmedTag)
			}
		}
		file.Tags = normalizedTags
		files = append(files, file)
	}
	return files, nil
}
