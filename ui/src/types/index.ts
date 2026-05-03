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
  gitUrl?: string
  gitBranch?: string
  createdAt: string
  updatedAt: string
}

export interface GitStatusResult {
  branch: string
  ahead: number
  behind: number
  dirty: boolean
  lastCommit?: string
}

export interface KarateVersion {
  version: string
  addedAt: string
}

export interface AppConfig {
  appName: string
  appDescription: string
  appURL: string
  appEnv: string
  serverPort: number
  logLevel: string
  logFormat: string
  dataDir: string
  maxExecutors: number
  configFile: string
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
  projectId: string
  testName?: string
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

export interface DashboardStats {
  projectCount: number
  testCount: number
  totalExecutions: number
  passedCount: number
  failedCount: number
  errorCount: number
  recentExecutions: TestResult[]
}
