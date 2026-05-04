package testclient

import (
	"strings"
	"testing"

	"github.com/prasenjit-net/gherkin-tester/internal/storage"
)

func TestRenderKarateConfigIncludesProxyAndProperties(t *testing.T) {
	config, err := RenderKarateConfig(&storage.Environment{
		HTTPProxy: "http://proxy.internal:8080",
		Properties: map[string]string{
			"baseUrl": "https://api.example.test",
		},
	})
	if err != nil {
		t.Fatalf("RenderKarateConfig returned error: %v", err)
	}

	if !strings.Contains(config, "'baseUrl': 'https://api.example.test'") {
		t.Fatalf("expected properties in karate-config.js, got %s", config)
	}
	if !strings.Contains(config, "config.httpProxy = 'http://proxy.internal:8080'") {
		t.Fatalf("expected proxy variable in karate-config.js, got %s", config)
	}
	if !strings.Contains(config, "karate.configure('proxy', 'http://proxy.internal:8080')") {
		t.Fatalf("expected karate proxy configuration in karate-config.js, got %s", config)
	}
}

func TestRenderKarateConfigOmitsProxyWhenEmpty(t *testing.T) {
	config, err := RenderKarateConfig(&storage.Environment{
		Properties: map[string]string{
			"tenant": "demo",
		},
	})
	if err != nil {
		t.Fatalf("RenderKarateConfig returned error: %v", err)
	}

	if strings.Contains(config, "karate.configure('proxy'") {
		t.Fatalf("expected no proxy configuration, got %s", config)
	}
}

func TestRenderKarateConfigIncludesMTLS(t *testing.T) {
	config, err := RenderKarateConfig(&storage.Environment{
		MTLS: &storage.EnvironmentMTLS{
			CertificatePath:    "/tmp/envs/dev/assets/mtls/client.crt",
			PrivateKeyPath:     "/tmp/envs/dev/assets/mtls/client.key",
			PrivateKeyPassword: "super-secret",
		},
	})
	if err != nil {
		t.Fatalf("RenderKarateConfig returned error: %v", err)
	}

	if !strings.Contains(config, "config['ssl.cert'] = '/tmp/envs/dev/assets/mtls/client.crt'") {
		t.Fatalf("expected mTLS certificate path in karate-config.js, got %s", config)
	}
	if !strings.Contains(config, "config['ssl.key'] = '/tmp/envs/dev/assets/mtls/client.key'") {
		t.Fatalf("expected mTLS private key path in karate-config.js, got %s", config)
	}
	if !strings.Contains(config, "config['ssl.keyPassword'] = 'super-secret'") {
		t.Fatalf("expected mTLS private key password in karate-config.js, got %s", config)
	}
}

func TestRenderKarateConfigSnapshotRedactsMTLSPassword(t *testing.T) {
	config, err := RenderKarateConfigSnapshot(&storage.Environment{
		MTLS: &storage.EnvironmentMTLS{
			CertificatePath:    "/tmp/envs/dev/assets/mtls/client.crt",
			PrivateKeyPath:     "/tmp/envs/dev/assets/mtls/client.key",
			PrivateKeyPassword: "super-secret",
		},
	})
	if err != nil {
		t.Fatalf("RenderKarateConfigSnapshot returned error: %v", err)
	}

	if strings.Contains(config, "super-secret") {
		t.Fatalf("expected redacted snapshot config, got %s", config)
	}
	if !strings.Contains(config, "ssl.keyPassword configured via environment (redacted)") {
		t.Fatalf("expected redaction marker in snapshot config, got %s", config)
	}
}
