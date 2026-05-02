import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import SectionHeader from '../components/SectionHeader'
import { testApi } from '../services/api'
import type { Test, TestResult } from '../types'

export default function TestRunnerPage() {
  const { testID } = useParams<{ testID: string }>()
  const navigate = useNavigate()
  const [test, setTest] = useState<Test | null>(null)
  const [result, setResult] = useState<TestResult | null>(null)
  const [loading, setLoading] = useState(!!testID)
  const [executing, setExecuting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (testID) {
      loadTest()
    }
  }, [testID])

  const loadTest = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await testApi.get(testID!)
      setTest(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load test')
    } finally {
      setLoading(false)
    }
  }

  const handleRun = async () => {
    if (!testID) return
    try {
      setExecuting(true)
      setError(null)
      const data = await testApi.run(testID)
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute test')
    } finally {
      setExecuting(false)
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

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin">⏳</div> Loading test...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <SectionHeader title={test?.name || 'Run Test'} description="Execute and monitor test execution" />
        <button
          onClick={() => navigate('/tests')}
          className="px-4 py-2 text-gray-600 hover:text-gray-900"
        >
          ← Back
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      {test && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4">Test Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">ID</p>
                <p className="font-mono text-gray-900">{test.id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Name</p>
                <p className="text-gray-900">{test.name}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-gray-600">Description</p>
                <p className="text-gray-900">{test.description}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-900">Test Content</h3>
            </div>
            <pre className="bg-gray-50 p-4 rounded border border-gray-200 overflow-auto text-sm font-mono text-gray-700">
              {test.content}
            </pre>
          </div>

          <button
            onClick={handleRun}
            disabled={executing}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 w-full font-semibold"
          >
            {executing ? 'Executing...' : 'Execute Test'}
          </button>

          {result && (
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-4">Execution Results</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                  <span className="text-gray-700">Status</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(result.status)}`}>
                    {result.status.toUpperCase()}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 rounded">
                    <p className="text-sm text-gray-600">Duration</p>
                    <p className="text-lg font-semibold text-gray-900">{result.duration}ms</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded">
                    <p className="text-sm text-gray-600">Scenarios</p>
                    <p className="text-lg font-semibold text-gray-900">{result.scenarios}</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded">
                    <p className="text-sm text-green-600">Passed</p>
                    <p className="text-lg font-semibold text-green-700">{result.passed}</p>
                  </div>
                  <div className="p-3 bg-red-50 rounded">
                    <p className="text-sm text-red-600">Failed</p>
                    <p className="text-lg font-semibold text-red-700">{result.failed}</p>
                  </div>
                </div>
                {result.message && (
                  <div className="p-4 bg-blue-50 rounded border border-blue-200">
                    <p className="text-sm text-blue-900">{result.message}</p>
                  </div>
                )}
                {result.output && (
                  <div className="mt-4">
                    <p className="text-sm text-gray-600 mb-2">Output</p>
                    <pre className="bg-gray-50 p-4 rounded border border-gray-200 overflow-auto text-xs text-gray-700">
                      {result.output}
                    </pre>
                  </div>
                )}
                <button
                  onClick={() => navigate(`/tests/${testID}/results`)}
                  className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  View Full History
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
