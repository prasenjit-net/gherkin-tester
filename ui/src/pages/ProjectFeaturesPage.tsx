import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ChevronRight, FilePlus, ListOrdered, Pencil, Plus, Tag, Trash2 } from 'lucide-react'
import SectionHeader from '../components/SectionHeader'
import { projectApi, queueApi } from '../services/api'
import type { Project, Test } from '../types'

const inputCls =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500'

export default function ProjectFeaturesPage() {
  const { projectID } = useParams<{ projectID: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [tests, setTests] = useState<Test[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newTest, setNewTest] = useState({ id: '', name: '', description: '', tags: '' })

  useEffect(() => { if (projectID) loadAll() }, [projectID])

  const loadAll = async () => {
    try {
      setLoading(true)
      setError(null)
      const [proj, feats] = await Promise.all([projectApi.get(projectID!), projectApi.listTests(projectID!)])
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
    if (!newTest.name) { setError('Name is required'); return }
    try {
      await projectApi.createTest(projectID!, {
        id: newTest.id, name: newTest.name, description: newTest.description,
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

  if (loading) return <p className="p-8 text-sm text-gray-500 dark:text-slate-400">Loading…</p>

  return (
    <div className="space-y-8 p-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-slate-400">
        <Link to="/projects" className="transition-colors hover:text-blue-600 dark:hover:text-blue-400">Projects</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-gray-800 dark:text-slate-200">{project?.name ?? projectID}</span>
      </nav>

      <div className="flex items-start justify-between gap-4">
        <SectionHeader
          title={project?.name ?? 'Features'}
          description={project?.description || 'Manage Karate feature files for this project.'}
        />
        <button
          onClick={() => setShowNewForm((v) => !v)}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <Plus className="h-4 w-4" />
          {showNewForm ? 'Cancel' : 'New Feature'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {showNewForm && (
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-slate-100">New Feature</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
                Feature ID <span className="font-normal text-gray-400 dark:text-slate-500">(optional)</span>
              </label>
              <input type="text" value={newTest.id} onChange={(e) => setNewTest({ ...newTest, id: e.target.value })} className={inputCls} placeholder="e.g., login-feature" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">Name <span className="text-red-500">*</span></label>
              <input type="text" value={newTest.name} onChange={(e) => setNewTest({ ...newTest, name: e.target.value })} className={inputCls} placeholder="Feature name" required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">Description</label>
              <textarea value={newTest.description} onChange={(e) => setNewTest({ ...newTest, description: e.target.value })} className={inputCls} rows={2} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
                Tags <span className="font-normal text-gray-400 dark:text-slate-500">(comma-separated)</span>
              </label>
              <input type="text" value={newTest.tags} onChange={(e) => setNewTest({ ...newTest, tags: e.target.value })} className={inputCls} placeholder="e.g., smoke, regression" />
            </div>
            <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-700">
              <Plus className="h-4 w-4" /> Create Feature
            </button>
          </form>
        </section>
      )}

      {tests.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <FilePlus className="mx-auto mb-3 h-10 w-10 text-gray-300 dark:text-slate-700" />
          <p className="text-base font-medium text-gray-700 dark:text-slate-300">No feature files yet</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">Create or upload a Karate .feature file to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tests.map((test) => (
            <div key={test.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-gray-900 dark:text-slate-100">{test.name}</h3>
                  {test.description && (
                    <p className="mt-0.5 text-sm text-gray-500 dark:text-slate-400">{test.description}</p>
                  )}
                  {test.tags?.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      <Tag className="h-3 w-3 text-gray-400 dark:text-slate-500" />
                      {test.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-slate-800 dark:text-slate-300">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => navigate(`/projects/${projectID}/features/${test.id}/edit`)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button
                    onClick={async () => {
                      try { await queueApi.add(test.id, projectID!, test.name); navigate('/queue') }
                      catch (e) { alert(e instanceof Error ? e.message : 'Failed to queue test') }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 px-3 py-1.5 text-sm font-medium text-green-700 transition-colors hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-900/20"
                  >
                    <ListOrdered className="h-3.5 w-3.5" /> Queue
                  </button>
                  <button
                    onClick={() => handleDelete(test.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
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
