package storage

import (
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"
)

const karateReleasesURL = "https://api.github.com/repos/karatelabs/karate/releases?per_page=20"

type GitHubRelease struct {
	TagName string `json:"tag_name"`
	Name    string `json:"name"`
	Assets  []struct {
		Name               string `json:"name"`
		BrowserDownloadURL string `json:"browser_download_url"`
	} `json:"assets"`
}

// FetchKarateReleases returns a list of available Karate versions from GitHub.
func FetchKarateReleases() ([]string, error) {
	client := &http.Client{Timeout: 15 * time.Second}
	req, _ := http.NewRequest(http.MethodGet, karateReleasesURL, nil)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "gherkin-tester")

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch releases: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("github releases returned %d", resp.StatusCode)
	}

	var releases []GitHubRelease
	if err := json.NewDecoder(resp.Body).Decode(&releases); err != nil {
		return nil, fmt.Errorf("decode releases: %w", err)
	}

	var versions []string
	for _, r := range releases {
		v := strings.TrimPrefix(r.TagName, "v")
		if v != "" {
			versions = append(versions, v)
		}
	}
	return versions, nil
}

// StatFile is a helper used by handlers to check JAR existence.
func StatFile(path string) (os.FileInfo, error) { return os.Stat(path) }
func DownloadKarateJAR(version, destPath string, logger *slog.Logger) error {
	// Try asset-based URL first (standard GitHub release asset name)
	url := fmt.Sprintf("https://github.com/karatelabs/karate/releases/download/v%s/karate-%s.jar", version, version)
	logger.Info("downloading karate JAR", "version", version, "url", url)

	client := &http.Client{Timeout: 5 * time.Minute}
	resp, err := client.Get(url)
	if err != nil {
		return fmt.Errorf("download JAR: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("download JAR returned %d for %s", resp.StatusCode, url)
	}

	tmpPath := destPath + ".tmp"
	f, err := os.Create(tmpPath)
	if err != nil {
		return fmt.Errorf("create JAR file: %w", err)
	}
	defer f.Close()

	if _, err := io.Copy(f, resp.Body); err != nil {
		os.Remove(tmpPath)
		return fmt.Errorf("write JAR: %w", err)
	}
	f.Close()

	if err := os.Rename(tmpPath, destPath); err != nil {
		os.Remove(tmpPath)
		return fmt.Errorf("rename JAR: %w", err)
	}

	logger.Info("karate JAR downloaded", "version", version, "path", destPath)
	return nil
}

// EnsureJARsDownloaded downloads any missing JARs for configured versions.
// Runs in the background; errors are logged but not fatal.
// publish is an optional callback to emit events; pass nil to skip.
func (s *Storage) EnsureJARsDownloaded(logger *slog.Logger, publish func(string, any)) {
	versions, err := s.ListKarateVersions()
	if err != nil || len(versions) == 0 {
		return
	}
	for _, v := range versions {
		jarPath := s.KarateJARPath(v.Version)
		if _, err := os.Stat(jarPath); err == nil {
			continue // already exists
		}
		if publish != nil {
			publish("karate.download.started", map[string]string{"version": v.Version})
		}
		if err := DownloadKarateJAR(v.Version, jarPath, logger); err != nil {
			logger.Error("failed to download karate JAR", "version", v.Version, "error", err)
			if publish != nil {
				publish("karate.download.error", map[string]string{"version": v.Version, "error": err.Error()})
			}
		} else if publish != nil {
			publish("karate.download.complete", map[string]string{"version": v.Version})
		}
	}
}
