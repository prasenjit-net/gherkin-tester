import type { AppConfig, DashboardStats, Environment, EnvironmentDraft, ExampleResponse, GitStatusResult, HealthResponse, KarateVersion, MetaResponse, Project, QueueItem, Test, TestResult } from '../types'

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
  importGit: async (repoUrl: string, branch?: string, name?: string, description?: string, karateVersion?: string) =>
    handleResponse<Project>(await fetch(`${API_BASE}/projects/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoUrl, branch, name, description, karateVersion }),
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
  getGitStatus: async (projectID: string) =>
    handleResponse<GitStatusResult>(await fetch(`${API_BASE}/projects/${projectID}/git/status`)),
  gitCommit: async (projectID: string, message: string) =>
    handleResponse<{ status: string }>(await fetch(`${API_BASE}/projects/${projectID}/git/commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    })),
  gitPull: async (projectID: string) =>
    handleResponse<{ status: string }>(await fetch(`${API_BASE}/projects/${projectID}/git/pull`, { method: 'POST' })),
  gitForcePull: async (projectID: string) =>
    handleResponse<{ status: string }>(await fetch(`${API_BASE}/projects/${projectID}/git/force-pull`, { method: 'POST' })),
}

export const queueApi = {
  list: async () => handleResponse<QueueItem[]>(await fetch(`${API_BASE}/queue`)),
  add: async (testId: string, projectId: string, testName: string, environmentId?: string, tags?: string[]) =>
    handleResponse<QueueItem>(await fetch(`${API_BASE}/queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testId, projectId, testName, environmentId: environmentId ?? '', tags: tags ?? [] }),
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

export const statsApi = {
  get: async () => handleResponse<DashboardStats>(await fetch(`${API_BASE}/stats`)),
}

export const environmentApi = {
  list: async () => handleResponse<Environment[]>(await fetch(`${API_BASE}/environments`)),
  get: async (id: string) => handleResponse<Environment>(await fetch(`${API_BASE}/environments/${id}`)),
  create: async (env: EnvironmentDraft, files?: { certificate?: File | null; privateKey?: File | null }) =>
    handleResponse<Environment>(await fetch(`${API_BASE}/environments`, {
      method: 'POST',
      body: buildEnvironmentFormData(env, files),
    })),
  update: async (id: string, env: Partial<EnvironmentDraft>, files?: { certificate?: File | null; privateKey?: File | null }) =>
    handleResponse<Environment>(await fetch(`${API_BASE}/environments/${id}`, {
      method: 'PUT',
      body: buildEnvironmentFormData(env, files),
    })),
  delete: async (id: string) =>
    handleResponse<void>(await fetch(`${API_BASE}/environments/${id}`, { method: 'DELETE' })),
}

function buildEnvironmentFormData(env: Partial<EnvironmentDraft>, files?: { certificate?: File | null; privateKey?: File | null }) {
  const formData = new FormData()
  if (env.name !== undefined) formData.set('name', env.name)
  if (env.description !== undefined) formData.set('description', env.description)
  if (env.httpProxy !== undefined) formData.set('httpProxy', env.httpProxy)
  if (env.properties !== undefined) formData.set('properties', JSON.stringify(env.properties))
  if (env.mtls?.privateKeyPassword !== undefined) formData.set('mtlsPrivateKeyPassword', env.mtls.privateKeyPassword)
  if (env.mtls?.clear) formData.set('mtlsClear', 'true')
  if (env.mtls?.clearPrivateKeyPassword) formData.set('mtlsClearPrivateKeyPassword', 'true')
  if (files?.certificate) formData.set('mtlsCertificate', files.certificate)
  if (files?.privateKey) formData.set('mtlsPrivateKey', files.privateKey)
  return formData
}
