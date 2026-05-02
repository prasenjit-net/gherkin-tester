import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import SectionHeader from '../components/SectionHeader'
import { projectApi } from '../services/api'
import type { Test, TestResult } from '../types'

export default function ProjectTestRunnerPage() {
  const { projectID, testID } = useParams<{ projectID: string; testID: string }>()
  const navigate = useNavigate()
  const [test, setTest] = useState<Test | null>(null)
  const [result, setResult] = useState<TestResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [executing, setExecuting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (projectID && testID) {
      projectApi.getTest(projectID, testID)
        .then(setTest)
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load test'))
        .finally(() => setLoading(false))
    }
  }, [projectID, testID])

  const handleRun = async () => {
    if (!projectID || !testID) return
    try {
      setExecuting(true)
      setError(null)
      const data = await projectApi.runTest(projectID, testID)
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute test')
    } finally {
      setExecuting(false)
    }
  }

  const statusColor = (status: string) => {
    if (status === 'passed') return 'bg-green-100 text-green-700'
    if (status === 'failed') return 'bg-red-100 text-red-700'
    return 'bg-orange-100 text-orange-700'
  }

  if (loading) return <div className="text-center py-8 text-gray-500">Loading…</div>

  return (
    <div className="space-y-6">
      <nav className="text-sm text-gray-500 dark:text-gray-400">
        <Link to="/projects" className="hover:text-blue-600">Projects</Link>
        <span className="mx-2">/</span>
        <Link to={`/projects/${projectID}/features`} className="hover:text-blue-600">{projectID}</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-800 dark:text-gray-200 font-medium">{test?.name ?? testID}</span>
      </nav>

      <div className="flex justify-between items-center">
        <SectionHeader title={test?.name || 'Run Test'} description="Execute and inspect results" />
        <button
          onClick={() => navigate(`/projects/${projectID}/features`)}
          className="px-4 py-2 text-gray-600 hover:text-gray-900"
        >
          ← Back
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">{error}</div>
      )}

      {test && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Feature Content</h3>
            <pre className="bg-gray-50 dark:bg-gray-900 p-4 rounded border border-gray-200 dark:border-gray-700 overflow-auto text-sm font-mono text-gray-700 dark:text-gray-300">
              {test.content}
            </pre>
          </div>

          <button
            onClick={handleRun}
            disabled={executing}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 w-full font-semibold"
          >
            {executing ? 'Executing…' : 'Execute Test'}
          </button>

          {result && (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Results</h3>
              <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900 rounded">
                <span className="text-gray-700 dark:text-gray-300">Status</span>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${statusColor(result.status)}`}>
                  {result.status.toUpperCase()}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded">
                  <p className="text-xs text-gray-500">Duration</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{result.duration}ms</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded">
                  <p className="text-xs text-gray-500">Scenarios</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{result.scenarios}</p>
                </div>
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded">
                  <p className="text-xs text-green-600">Passed</p>
                  <p className="text-lg font-semibold text-green-700">{result.passed}</p>
                </div>
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded">
                  <p className="text-xs text-red-600">Failed</p>
                  <p className="text-lg font-semibold text-red-700">{result.failed}</p>
                </div>
              </div>
              {result.message && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-700">
                  <p className="text-sm text-blue-900 dark:text-blue-300">{result.message}</p>
                </div>
              )}
              {result.output && (
                <details>
                  <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900">
                    View Output
                  </summary>
                  <pre className="mt-2 bg-gray-50 dark:bg-gray-900 p-4 rounded border border-gray-200 dark:border-gray-700 overflow-auto text-xs text-gray-700 dark:text-gray-400">
                    {result.output}
                  </pre>
                </details>
              )}
              <button
                onClick={() => navigate(`/projects/${projectID}/features/${testID}/history`)}
                className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                View Full History
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
