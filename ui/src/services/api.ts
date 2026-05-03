import type { AppConfig, ExampleResponse, HealthResponse, KarateVersion, MetaResponse, Project, QueueItem, Test, TestResult } from '../types'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `HTTP ${response.status}`
    try {
      const payload = await response.json()
      if (payload?.error) {
        message = payload.error
      }
    } catch {
      // ignore invalid JSON
    }
    throw new Error(message)
  }

  return response.json() as Promise<T>
}

export const healthApi = {
  get: async () => handleResponse<HealthResponse>(await fetch(`${API_BASE}/health`)),
}

export const exampleApi = {
  get: async () => handleResponse<ExampleResponse>(await fetch(`${API_BASE}/example`)),
}

export const metaApi = {
  get: async () => handleResponse<MetaResponse>(await fetch(`${API_BASE}/meta`)),
}

export const projectApi = {
  list: async () => handleResponse<Project[]>(await fetch(`${API_BASE}/projects`)),
  get: async (projectID: string) => handleResponse<Project>(await fetch(`${API_BASE}/projects/${projectID}`)),
  create: async (project: Omit<Project, 'createdAt' | 'updatedAt'>) =>
    handleResponse<Project>(await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project),
    })),
  delete: async (projectID: string) =>
    handleResponse<{ message: string }>(await fetch(`${API_BASE}/projects/${projectID}`, {
      method: 'DELETE',
    })),
  update: async (projectID: string, data: { name?: string; description?: string; karateVersion?: string }) =>
    handleResponse<Project>(await fetch(`${API_BASE}/projects/${projectID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })),
  listTests: async (projectID: string) =>
    handleResponse<Test[]>(await fetch(`${API_BASE}/projects/${projectID}/tests`)),
  createTest: async (projectID: string, test: Omit<Test, 'projectId' | 'createdAt' | 'updatedAt'>) =>
    handleResponse<Test>(await fetch(`${API_BASE}/projects/${projectID}/tests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(test),
    })),
  getTest: async (projectID: string, testID: string) =>
    handleResponse<Test>(await fetch(`${API_BASE}/projects/${projectID}/tests/${testID}`)),
  updateTest: async (projectID: string, testID: string, test: Pick<Test, 'name' | 'description' | 'content' | 'tags'>) =>
    handleResponse<Test>(await fetch(`${API_BASE}/projects/${projectID}/tests/${testID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(test),
    })),
  deleteTest: async (projectID: string, testID: string) =>
    handleResponse<{ message: string }>(await fetch(`${API_BASE}/projects/${projectID}/tests/${testID}`, {
      method: 'DELETE',
    })),
  runTest: async (projectID: string, testID: string) =>
    handleResponse<TestResult>(await fetch(`${API_BASE}/projects/${projectID}/tests/${testID}/run`, {
      method: 'POST',
    })),
  getTestHistory: async (projectID: string, testID: string) =>
    handleResponse<TestResult[]>(await fetch(`${API_BASE}/projects/${projectID}/tests/${testID}/history`)),
}

export const queueApi = {
  list: async () => handleResponse<QueueItem[]>(await fetch(`${API_BASE}/queue`)),
  add: async (testId: string, projectId: string, testName: string) =>
    handleResponse<QueueItem>(await fetch(`${API_BASE}/queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testId, projectId, testName }),
    })),
  cancel: async (id: string) =>
    handleResponse<{ status: string }>(await fetch(`${API_BASE}/queue/${id}`, { method: 'DELETE' })),
  clearCompleted: async () =>
    handleResponse<{ status: string }>(await fetch(`${API_BASE}/queue/completed`, { method: 'DELETE' })),
  streamURL: () => `${API_BASE}/queue/stream`,
}

export const testApi = {
  list: async () => handleResponse<Test[]>(await fetch(`${API_BASE}/tests`)),
  get: async (testID: string) => handleResponse<Test>(await fetch(`${API_BASE}/tests/${testID}`)),
  create: async (test: Omit<Test, 'createdAt' | 'updatedAt'>) =>
    handleResponse<Test>(await fetch(`${API_BASE}/tests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(test),
    })),
  delete: async (testID: string) =>
    handleResponse<{ message: string }>(await fetch(`${API_BASE}/tests/${testID}`, {
      method: 'DELETE',
    })),
  run: async (testID: string) => handleResponse<TestResult>(await fetch(`${API_BASE}/tests/${testID}/run`, {
    method: 'POST',
  })),
  getResult: async (testID: string) => handleResponse<TestResult>(await fetch(`${API_BASE}/tests/${testID}/results`)),
  getHistory: async (testID: string) => handleResponse<TestResult[]>(await fetch(`${API_BASE}/tests/${testID}/history`)),
}

export const karateApi = {
  listVersions: async () => handleResponse<KarateVersion[]>(await fetch(`${API_BASE}/karate-versions`)),
  addVersion: async (version: string) =>
    handleResponse<{ version: string; status: string }>(await fetch(`${API_BASE}/karate-versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version }),
    })),
  removeVersion: async (version: string) =>
    handleResponse<{ status: string }>(await fetch(`${API_BASE}/karate-versions/${version}`, { method: 'DELETE' })),
  versionStatus: async (version: string) =>
    handleResponse<{ version: string; downloaded: boolean }>(await fetch(`${API_BASE}/karate-versions/${version}/status`)),
  fetchReleases: async () => handleResponse<string[]>(await fetch(`${API_BASE}/karate-releases`)),
}

export const configApi = {
  get: async () => handleResponse<AppConfig>(await fetch(`${API_BASE}/config`)),
  update: async (cfg: Omit<AppConfig, 'configFile'>) =>
    handleResponse<{ status: string; configFile: string }>(await fetch(`${API_BASE}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg),
    })),
}
