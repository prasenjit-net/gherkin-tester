package storage

import "time"

type Test struct {
	ID          string    `json:"id"`
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
	Status    string    `json:"status"` // passed, failed, error
	Duration  int64     `json:"duration"` // milliseconds
	Message   string    `json:"message"`
	Output    string    `json:"output"`
	StartedAt time.Time `json:"startedAt"`
	EndedAt   time.Time `json:"endedAt"`
	Scenarios int       `json:"scenarios"`
	Passed    int       `json:"passed"`
	Failed    int       `json:"failed"`
}
