package storage

import "time"

type Project struct {
	ID            string    `json:"id"`
	Name          string    `json:"name"`
	Description   string    `json:"description"`
	KarateVersion string    `json:"karateVersion,omitempty"`
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

type TestResult struct {
	ID        string    `json:"id"`
	TestID    string    `json:"testId"`
	ProjectID string    `json:"projectId"`
	TestName  string    `json:"testName,omitempty"`
	Status    string    `json:"status"` // passed, failed, error
	Duration  int64     `json:"duration"` // milliseconds
	Message   string    `json:"message"`
	Output    string    `json:"output,omitempty"`
	StartedAt time.Time `json:"startedAt"`
	EndedAt   time.Time `json:"endedAt"`
	Scenarios int       `json:"scenarios"`
	Passed    int       `json:"passed"`
	Failed    int       `json:"failed"`
}

// KarateVersion represents a configured Karate JAR version.
type KarateVersion struct {
	Version string    `json:"version"`
	AddedAt time.Time `json:"addedAt"`
}

