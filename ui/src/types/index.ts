export interface HealthResponse {
  status: string
  service: string
  env: string
  time: string
  version: {
    version: string
    commit: string
    buildDate: string
  }
  documents: string[]
}

export interface ExampleResponse {
  title: string
  summary: string
  features: string[]
  quickstart: string[]
  repository: string
  frontendDir: string
}

export interface MetaResponse {
  name: string
  description: string
  environment: string
  url: string
  uiProxy: string
  version: {
    version: string
    commit: string
    buildDate: string
  }
}

export interface Project {
  id: string
  name: string
  description: string
  karateVersion?: string
  createdAt: string
  updatedAt: string
}

export interface KarateVersion {
  version: string
  addedAt: string
}

export interface Test {
  id: string
  projectId: string
  name: string
  description: string
  content: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface QueueItem {
  id: string
  testId: string
  projectId: string
  testName: string
  status: 'queued' | 'running' | 'passed' | 'failed' | 'error'
  queuedAt: string
  startedAt?: string
  endedAt?: string
  duration?: number
  scenarios?: number
  passed?: number
  failed?: number
  message?: string
  output?: string
}

export interface TestResult {
  id: string
  testId: string
  status: 'passed' | 'failed' | 'error'
  duration: number
  message: string
  output: string
  startedAt: string
  endedAt: string
  scenarios: number
  passed: number
  failed: number
}

