package storage

import (
	"log/slog"
	"path/filepath"
	"strings"
	"testing"
)

const sampleOpenAPISpec = `openapi: 3.0.3
info:
  title: Billing API
  version: 1.2.0
  description: Billing operations
servers:
  - url: https://api.example.com
    description: Production
tags:
  - name: invoices
paths:
  /invoices:
    get:
      operationId: listInvoices
      summary: List invoices
      tags: [invoices]
    post:
      operationId: createInvoice
      summary: Create invoice
      tags: [invoices]
  /invoices/{invoiceId}:
    get:
      operationId: getInvoice
      summary: Get invoice
      tags: [invoices]
`

func TestParseOpenAPISpec(t *testing.T) {
	parsed, err := ParseOpenAPISpec("billing.yaml", []byte(sampleOpenAPISpec))
	if err != nil {
		t.Fatalf("ParseOpenAPISpec returned error: %v", err)
	}

	if parsed.Summary.Title != "Billing API" {
		t.Fatalf("expected title Billing API, got %q", parsed.Summary.Title)
	}
	if parsed.Summary.PathsCount != 2 {
		t.Fatalf("expected 2 paths, got %d", parsed.Summary.PathsCount)
	}
	if parsed.Summary.OperationsCount != 3 {
		t.Fatalf("expected 3 operations, got %d", parsed.Summary.OperationsCount)
	}
	if len(parsed.Endpoints) != 3 {
		t.Fatalf("expected 3 endpoints, got %d", len(parsed.Endpoints))
	}
}

func TestCreateAndGetSpecDetail(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(testWriter{t}, nil))
	st, err := New(filepath.Join(t.TempDir(), "data"), logger)
	if err != nil {
		t.Fatalf("New returned error: %v", err)
	}
	if err := st.CreateProject(&Project{ID: "proj-1", Name: "Billing"}); err != nil {
		t.Fatalf("CreateProject returned error: %v", err)
	}

	spec, err := st.CreateSpec("proj-1", SpecUpload{
		FileName:    "billing.yaml",
		Description: "Customer billing API",
		Content:     []byte(sampleOpenAPISpec),
	})
	if err != nil {
		t.Fatalf("CreateSpec returned error: %v", err)
	}

	if spec.ProjectID != "proj-1" {
		t.Fatalf("expected projectId proj-1, got %q", spec.ProjectID)
	}
	if spec.Format != "yaml" {
		t.Fatalf("expected yaml format, got %q", spec.Format)
	}

	detail, err := st.GetSpecDetail("proj-1", spec.ID)
	if err != nil {
		t.Fatalf("GetSpecDetail returned error: %v", err)
	}
	if detail.Spec == nil || detail.Spec.ID != spec.ID {
		t.Fatalf("expected detail for spec %q", spec.ID)
	}
	if !strings.Contains(detail.Content, "Billing API") {
		t.Fatalf("expected raw content in detail, got %q", detail.Content)
	}
	if len(detail.Endpoints) != 3 {
		t.Fatalf("expected 3 endpoints in detail, got %d", len(detail.Endpoints))
	}
}

type testWriter struct {
	t *testing.T
}

func (w testWriter) Write(p []byte) (int, error) {
	w.t.Log(strings.TrimSpace(string(p)))
	return len(p), nil
}
