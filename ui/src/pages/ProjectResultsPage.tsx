import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import SectionHeader from '../components/SectionHeader'
import { projectApi } from '../services/api'
import type { TestResult } from '../types'

export default function ProjectResultsPage() {
  const { projectID, testID } = useParams<{ projectID: string; testID: string }>()
  const navigate = useNavigate()
  const [results, setResults] = useState<TestResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (projectID && testID) {
      projectApi.getTestHistory(projectID, testID)
        .then(setResults)
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load history'))
        .finally(() => setLoading(false))
    }
  }, [projectID, testID])

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
        <span className="text-gray-800 dark:text-gray-200 font-medium">History</span>
      </nav>

      <div className="flex justify-between items-center">
        <SectionHeader title="Test Result History" description="Past execution runs for this feature" />
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

      {results.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="text-gray-500">No results yet.</p>
          <button
            onClick={() => navigate(`/projects/${projectID}/features/${testID}/run`)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Run Now
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {results.map((result) => (
            <div key={result.id} className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Executed at</p>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">
                    {new Date(result.startedAt).toLocaleString()}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${statusColor(result.status)}`}>
                  {result.status.toUpperCase()}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Duration</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{result.duration}ms</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Scenarios</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{result.scenarios}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Passed</p>
                  <p className="text-lg font-semibold text-green-700">{result.passed}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Failed</p>
                  <p className="text-lg font-semibold text-red-700">{result.failed}</p>
                </div>
              </div>
              {result.message && (
                <p className="text-sm text-gray-700 dark:text-gray-300 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-700 mb-4">
                  {result.message}
                </p>
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
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
