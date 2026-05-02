import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import SectionHeader from '../components/SectionHeader'
import { projectApi } from '../services/api'
import type { Test } from '../types'

export default function ProjectFeatureEditorPage() {
  const { projectID, testID } = useParams<{ projectID: string; testID: string }>()
  const navigate = useNavigate()
  const [test, setTest] = useState<Test | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (projectID && testID) loadTest()
  }, [projectID, testID])

  const loadTest = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await projectApi.getTest(projectID!, testID!)
      setTest(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feature')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!test) return
    try {
      setIsSaving(true)
      await projectApi.createTest(projectID!, {
        id: test.id,
        name: test.name,
        description: test.description,
        content: test.content,
        tags: test.tags,
      })
      setError(null)
      alert('Feature saved!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save feature')
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) return <div className="text-center py-8 text-gray-500">Loading…</div>

  if (error && !test) {
    return (
      <div className="space-y-4">
        <SectionHeader title="Error" description="Failed to load feature" />
        <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">{error}</div>
        <button
          onClick={() => navigate(`/projects/${projectID}/features`)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Back to Features
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <nav className="text-sm text-gray-500 dark:text-gray-400">
        <Link to="/projects" className="hover:text-blue-600">Projects</Link>
        <span className="mx-2">/</span>
        <Link to={`/projects/${projectID}/features`} className="hover:text-blue-600">{projectID}</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-800 dark:text-gray-200 font-medium">{test?.name}</span>
      </nav>

      <div className="flex justify-between items-center">
        <SectionHeader title={test?.name || 'Edit Feature'} description="Edit feature file content" />
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
              <input
                type="text"
                value={test.name}
                onChange={(e) => setTest({ ...test, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ID</label>
              <input
                type="text"
                value={test.id}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea
              value={test.description}
              onChange={(e) => setTest({ ...test, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tags <span className="text-gray-400 font-normal">(comma-separated)</span>
            </label>
            <input
              type="text"
              value={test.tags.join(', ')}
              onChange={(e) => setTest({ ...test, tags: e.target.value.split(',').map((t) => t.trim()) })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Feature File Content</label>
            <textarea
              value={test.content}
              onChange={(e) => setTest({ ...test, content: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 font-mono text-sm"
              rows={18}
              placeholder={'Feature: Test name\n  Scenario: Test scenario\n    Given url "https://example.com"\n    When method GET\n    Then status 200'}
            />
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : 'Save Feature'}
            </button>
            <button
              onClick={() => navigate(`/projects/${projectID}/features/${test.id}/run`)}
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
