import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SectionHeader from '../components/SectionHeader'
import { testApi } from '../services/api'
import type { Test } from '../types'

export default function TestListPage() {
  const navigate = useNavigate()
  const [tests, setTests] = useState<Test[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newTest, setNewTest] = useState({
    id: '',
    name: '',
    description: '',
    tags: '',
  })

  useEffect(() => {
    loadTests()
  }, [])

  const loadTests = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await testApi.list()
      setTests(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tests')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTest.id || !newTest.name) {
      setError('ID and Name are required')
      return
    }

    try {
      await testApi.create({
        id: newTest.id,
        name: newTest.name,
        description: newTest.description,
        content: 'Feature: Example\n  Scenario: Example\n    Given setup',
        tags: newTest.tags.split(',').map(t => t.trim()).filter(t => t),
      })
      setNewTest({ id: '', name: '', description: '', tags: '' })
      setShowNewForm(false)
      loadTests()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create test')
    }
  }

  const handleDeleteTest = async (testID: string) => {
    if (!confirm('Are you sure you want to delete this test?')) return
    try {
      await testApi.delete(testID)
      loadTests()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete test')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <SectionHeader title="Tests" description="Manage your Karate tests" />
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {showNewForm ? 'Cancel' : 'New Test'}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      {showNewForm && (
        <form onSubmit={handleCreateTest} className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Test ID</label>
              <input
                type="text"
                value={newTest.id}
                onChange={(e) => setNewTest({ ...newTest, id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., login-test"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={newTest.name}
                onChange={(e) => setNewTest({ ...newTest, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Test name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={newTest.description}
                onChange={(e) => setNewTest({ ...newTest, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                placeholder="Test description"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma-separated)</label>
              <input
                type="text"
                value={newTest.tags}
                onChange={(e) => setNewTest({ ...newTest, tags: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., smoke, login"
              />
            </div>
            <button
              type="submit"
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Create Test
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin">⏳</div> Loading tests...
        </div>
      ) : tests.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No tests yet. Create one to get started!
        </div>
      ) : (
        <div className="space-y-4">
          {tests.map((test) => (
            <div key={test.id} className="bg-white p-4 rounded-lg border border-gray-200 hover:shadow-lg transition">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-gray-900">{test.name}</h3>
                  <p className="text-gray-600 text-sm">{test.description}</p>
                  {test.tags && test.tags.length > 0 && (
                    <div className="flex gap-2 mt-2">
                      {test.tags.map((tag) => (
                        <span key={tag} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => navigate(`/tests/${test.id}`)}
                    className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => navigate(`/tests/${test.id}/run`)}
                    className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
                  >
                    Run
                  </button>
                  <button
                    onClick={() => handleDeleteTest(test.id)}
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
