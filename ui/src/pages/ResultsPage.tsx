import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import SectionHeader from '../components/SectionHeader'
import { testApi } from '../services/api'
import type { TestResult } from '../types'

export default function ResultsPage() {
  const { testID } = useParams<{ testID: string }>()
  const navigate = useNavigate()
  const [results, setResults] = useState<TestResult[]>([])
  const [loading, setLoading] = useState(!!testID)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (testID) {
      loadResults()
    }
  }, [testID])

  const loadResults = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await testApi.getHistory(testID!)
      setResults(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load results')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed':
        return 'bg-green-100 text-green-700'
      case 'failed':
        return 'bg-red-100 text-red-700'
      case 'error':
        return 'bg-orange-100 text-orange-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin">⏳</div> Loading results...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <SectionHeader title="Test Results History" description="View past execution results" />
        <button
          onClick={() => navigate('/tests')}
          className="px-4 py-2 text-gray-600 hover:text-gray-900"
        >
          ← Back to Tests
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      {results.length === 0 ? (
        <div className="text-center py-8 text-gray-500 bg-white rounded-lg border border-gray-200">
          No execution results yet. <br />
          <button
            onClick={() => navigate(`/tests/${testID}/run`)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Run Test Now
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {results.map((result) => (
            <div key={result.id} className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-lg transition">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-sm text-gray-600">Executed at</p>
                  <p className="font-semibold text-gray-900">{formatDate(result.startedAt)}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(result.status)}`}>
                  {result.status.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-xs text-gray-600 uppercase">Duration</p>
                  <p className="text-lg font-semibold text-gray-900">{result.duration}ms</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 uppercase">Scenarios</p>
                  <p className="text-lg font-semibold text-gray-900">{result.scenarios}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 uppercase">Passed</p>
                  <p className="text-lg font-semibold text-green-700">{result.passed}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 uppercase">Failed</p>
                  <p className="text-lg font-semibold text-red-700">{result.failed}</p>
                </div>
              </div>

              {result.message && (
                <p className="text-sm text-gray-700 mb-4 p-3 bg-blue-50 rounded border border-blue-200">
                  {result.message}
                </p>
              )}

              {result.output && (
                <details className="text-sm">
                  <summary className="cursor-pointer font-medium text-gray-700 hover:text-gray-900">
                    View Output
                  </summary>
                  <pre className="mt-2 bg-gray-50 p-4 rounded border border-gray-200 overflow-auto text-xs text-gray-700">
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
