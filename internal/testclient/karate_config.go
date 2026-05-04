package testclient

import (
	"bytes"
	_ "embed"
	"fmt"
	"strings"
	"text/template"

	"github.com/prasenjit-net/gherkin-tester/internal/storage"
)

//go:embed karate-config.js.tmpl
var karateConfigTemplateText string

// karateConfigTmpl is the Go template used to render karate-config.js.
// It produces a valid JS function that Karate auto-loads from the working
// directory before each feature run.
var karateConfigTmpl = template.Must(template.New("karate-config").Funcs(template.FuncMap{
	"escapeJS": func(s string) string {
		s = strings.ReplaceAll(s, `\`, `\\`)
		s = strings.ReplaceAll(s, `'`, `\'`)
		return s
	},
}).Parse(karateConfigTemplateText))

// RenderKarateConfig produces the text content of a karate-config.js file
// from the given environment definition.
// A nil environment produces a minimal valid config that returns {}.
func RenderKarateConfig(env *storage.Environment) (string, error) {
	return renderKarateConfig(env, false)
}

func RenderKarateConfigSnapshot(env *storage.Environment) (string, error) {
	return renderKarateConfig(env, true)
}

func renderKarateConfig(env *storage.Environment, redactSecrets bool) (string, error) {
	if env == nil {
		env = &storage.Environment{}
	}
	if env.Properties == nil {
		env.Properties = map[string]string{}
	}
	var mtls *struct {
		CertificatePath    string
		PrivateKeyPath     string
		PrivateKeyPassword string
		PasswordRedacted   bool
	}
	if env.MTLS != nil && env.MTLS.CertificatePath != "" && env.MTLS.PrivateKeyPath != "" {
		mtls = &struct {
			CertificatePath    string
			PrivateKeyPath     string
			PrivateKeyPassword string
			PasswordRedacted   bool
		}{
			CertificatePath:    env.MTLS.CertificatePath,
			PrivateKeyPath:     env.MTLS.PrivateKeyPath,
			PrivateKeyPassword: env.MTLS.PrivateKeyPassword,
		}
		if redactSecrets && mtls.PrivateKeyPassword != "" {
			mtls.PrivateKeyPassword = ""
			mtls.PasswordRedacted = true
		}
	}
	data := struct {
		Properties map[string]string
		HTTPProxy  string
		MTLS       *struct {
			CertificatePath    string
			PrivateKeyPath     string
			PrivateKeyPassword string
			PasswordRedacted   bool
		}
	}{
		Properties: env.Properties,
		HTTPProxy:  env.HTTPProxy,
		MTLS:       mtls,
	}
	var buf bytes.Buffer
	if err := karateConfigTmpl.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("render karate-config.js: %w", err)
	}
	return buf.String(), nil
}
