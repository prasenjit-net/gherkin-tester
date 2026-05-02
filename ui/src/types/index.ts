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

export interface Test {
  id: string
  name: string
  description: string
  content: string
  tags: string[]
  createdAt: string
  updatedAt: string
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

