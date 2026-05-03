import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ChevronRight, ListOrdered, Save } from 'lucide-react'
import SectionHeader from '../components/SectionHeader'
import { useToast } from '../components/Toast'
import { projectApi, queueApi } from '../services/api'
import type { Test } from '../types'

const inputCls =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500'

export default function ProjectFeatureEditorPage() {
  const { projectID, testID } = useParams<{ projectID: string; testID: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [test, setTest] = useState<Test | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { if (projectID && testID) loadTest() }, [projectID, testID])

  const loadTest = async () => {
    try {
      setLoading(true)
      setError(null)
      setTest(await projectApi.getTest(projectID!, testID!))
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
      setError(null)
      await projectApi.updateTest(projectID!, testID!, { name: test.name, description: test.description, content: test.content, tags: test.tags })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save feature')
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) return <p className="p-8 text-sm text-gray-500 dark:text-slate-400">Loading…</p>

  if (error && !test) {
    return (
      <div className="space-y-4 p-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">{error}</div>
        <button onClick={() => navigate(`/projects/${projectID}/features`)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          ← Back to Features
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-8 p-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-slate-400">
        <Link to="/projects" className="transition-colors hover:text-blue-600 dark:hover:text-blue-400">Projects</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link to={`/projects/${projectID}/features`} className="transition-colors hover:text-blue-600 dark:hover:text-blue-400">{projectID}</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-gray-800 dark:text-slate-200">{test?.name}</span>
      </nav>

      <div className="flex items-start justify-between gap-4">
        <SectionHeader title={test?.name || 'Edit Feature'} description="Edit the Karate feature file content and metadata." />
        <button
          onClick={() => navigate(`/projects/${projectID}/features`)}
          className="shrink-0 text-sm text-gray-500 transition-colors hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          ← Back
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">{error}</div>
      )}

      {test && (
        <div className="space-y-6">
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-slate-100">Metadata</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">Name</label>
                  <input type="text" value={test.name} onChange={(e) => setTest({ ...test, name: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">ID</label>
                  <input type="text" value={test.id} disabled className="w-full cursor-not-allowed rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-400 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-500" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">Description</label>
                <textarea value={test.description} onChange={(e) => setTest({ ...test, description: e.target.value })} className={inputCls} rows={2} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
                  Tags <span className="font-normal text-gray-400 dark:text-slate-500">(comma-separated)</span>
                </label>
                <input type="text" value={test.tags.join(', ')} onChange={(e) => setTest({ ...test, tags: e.target.value.split(',').map((t) => t.trim()) })} className={inputCls} />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-slate-100">Feature File</h2>
            <textarea
              value={test.content}
              onChange={(e) => setTest({ ...test, content: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-3 font-mono text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
              rows={18}
              placeholder={'Feature: Test name\n  Scenario: Test scenario\n    Given url "https://example.com"\n    When method GET\n    Then status 200'}
            />
          </section>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Feature'}
            </button>
            <button
              onClick={async () => {
                if (!test || !projectID) return
                try {
                  await queueApi.add(test.id, projectID, test.name)
                  toast(`"${test.name}" queued for execution`)
                } catch (e) {
                  toast(e instanceof Error ? e.message : 'Failed to queue test', 'error')
                }
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
            >
              <ListOrdered className="h-4 w-4" /> Queue &amp; Run
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
