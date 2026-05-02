import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import SectionHeader from '../components/SectionHeader'
import { projectApi } from '../services/api'
import type { Project, Test } from '../types'

export default function ProjectFeaturesPage() {
  const { projectID } = useParams<{ projectID: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [tests, setTests] = useState<Test[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newTest, setNewTest] = useState({ id: '', name: '', description: '', tags: '' })

  useEffect(() => {
    if (projectID) {
      loadAll()
    }
  }, [projectID])

  const loadAll = async () => {
    try {
      setLoading(true)
      setError(null)
      const [proj, feats] = await Promise.all([
        projectApi.get(projectID!),
        projectApi.listTests(projectID!),
      ])
      setProject(proj)
      setTests(feats)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTest.name) {
      setError('Name is required')
      return
    }
    try {
      await projectApi.createTest(projectID!, {
        id: newTest.id,
        name: newTest.name,
        description: newTest.description,
        content: 'Feature: Example\n  Scenario: Example\n    Given url "https://httpbin.org/get"\n    When method GET\n    Then status 200',
        tags: newTest.tags.split(',').map((t) => t.trim()).filter(Boolean),
      })
      setNewTest({ id: '', name: '', description: '', tags: '' })
      setShowNewForm(false)
      loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create feature')
    }
  }

  const handleDelete = async (testID: string) => {
    if (!confirm('Delete this feature file?')) return
    try {
      await projectApi.deleteTest(projectID!, testID)
      loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete feature')
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading…</div>
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 dark:text-gray-400">
        <Link to="/projects" className="hover:text-blue-600 dark:hover:text-blue-400">Projects</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-800 dark:text-gray-200 font-medium">{project?.name ?? projectID}</span>
      </nav>

      <div className="flex justify-between items-center">
        <SectionHeader
          title={project?.name ?? 'Features'}
          description={project?.description || 'Manage Karate feature files for this project'}
        />
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {showNewForm ? 'Cancel' : 'New Feature'}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      {showNewForm && (
        <form onSubmit={handleCreate} className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Feature ID <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={newTest.id}
                onChange={(e) => setNewTest({ ...newTest, id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                placeholder="e.g., login-feature"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
              <input
                type="text"
                value={newTest.name}
                onChange={(e) => setNewTest({ ...newTest, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                placeholder="Feature name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <textarea
                value={newTest.description}
                onChange={(e) => setNewTest({ ...newTest, description: e.target.value })}
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
                value={newTest.tags}
                onChange={(e) => setNewTest({ ...newTest, tags: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                placeholder="e.g., smoke, regression"
              />
            </div>
            <button type="submit" className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
              Create Feature
            </button>
          </div>
        </form>
      )}

      {tests.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="text-4xl mb-4">📄</p>
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300">No feature files yet</p>
          <p className="text-gray-500 mt-1">Create or upload a Karate .feature file to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tests.map((test) => (
            <div
              key={test.id}
              className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{test.name}</h3>
                  {test.description && (
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">{test.description}</p>
                  )}
                  {test.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {test.tags.map((tag) => (
                        <span key={tag} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 ml-4 shrink-0">
                  <button
                    onClick={() => navigate(`/projects/${projectID}/features/${test.id}/edit`)}
                    className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => navigate(`/projects/${projectID}/features/${test.id}/run`)}
                    className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
                  >
                    Run
                  </button>
                  <button
                    onClick={() => handleDelete(test.id)}
                    className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
