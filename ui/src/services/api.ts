import type { ExampleResponse, HealthResponse, MetaResponse, Test, TestResult } from '../types'

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
