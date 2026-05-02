import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import SectionHeader from '../components/SectionHeader'
import { testApi } from '../services/api'
import type { Test } from '../types'

export default function TestEditorPage() {
  const { testID } = useParams<{ testID: string }>()
  const navigate = useNavigate()
  const [test, setTest] = useState<Test | null>(null)
  const [loading, setLoading] = useState(!!testID)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

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

  const handleSave = async () => {
    if (!test) return
    try {
      setIsSaving(true)
      await testApi.create({
        id: test.id,
        name: test.name,
        description: test.description,
        content: test.content,
        tags: test.tags,
      })
      setError(null)
      alert('Test saved successfully!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save test')
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin">⏳</div> Loading test...
      </div>
    )
  }

  if (error && !test) {
    return (
      <div className="space-y-4">
        <SectionHeader title="Error" description="Failed to load test" />
        <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
          {error}
        </div>
        <button
          onClick={() => navigate('/tests')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Back to Tests
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <SectionHeader title={test?.name || 'New Test'} description="Edit test details and content" />
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={test.name}
                onChange={(e) => setTest({ ...test, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ID</label>
              <input
                type="text"
                value={test.id}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={test.description}
              onChange={(e) => setTest({ ...test, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma-separated)</label>
            <input
              type="text"
              value={test.tags.join(', ')}
              onChange={(e) => setTest({ ...test, tags: e.target.value.split(',').map(t => t.trim()) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Feature File Content</label>
            <textarea
              value={test.content}
              onChange={(e) => setTest({ ...test, content: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              rows={15}
              placeholder="Feature: Test name&#10;  Scenario: Test scenario&#10;    Given setup&#10;    When action&#10;    Then verify"
            />
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Test'}
            </button>
            <button
              onClick={() => navigate(`/tests/${test.id}/run`)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Run Test
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
