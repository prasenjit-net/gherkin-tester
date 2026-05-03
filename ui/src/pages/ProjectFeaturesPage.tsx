import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowUpDown, ChevronRight, FilePlus, GitBranch, GitCommit, Loader2, ListOrdered, Pencil, RefreshCw, Save, Tag, Trash2 } from 'lucide-react'
import SectionHeader from '../components/SectionHeader'
import { useToast } from '../components/Toast'
import { karateApi, projectApi, queueApi } from '../services/api'
import type { GitStatusResult, KarateVersion, Project, Test } from '../types'

const inputCls =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500'

export default function ProjectFeaturesPage() {
  const { projectID } = useParams<{ projectID: string }>()
  const { toast } = useToast()
  const [project, setProject] = useState<Project | null>(null)
  const [tests, setTests] = useState<Test[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Project detail editing
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editKarateVersion, setEditKarateVersion] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [karateVersions, setKarateVersions] = useState<KarateVersion[]>([])

  // New feature form
  const [showNewForm, setShowNewForm] = useState(false)
  const [newTest, setNewTest] = useState({ id: '', name: '', description: '', tags: '' })

  // Git status
  const [gitStatus, setGitStatus] = useState<GitStatusResult | null>(null)
  const [gitLoading, setGitLoading] = useState(false)
  const [showCommitForm, setShowCommitForm] = useState(false)
  const [commitMsg, setCommitMsg] = useState('')
  const [pushing, setPushing] = useState(false)

  useEffect(() => {
    if (projectID) {
      loadAll()
      karateApi.listVersions().then(setKarateVersions).catch(() => {})
    }
  }, [projectID])

  const loadAll = async () => {
    try {
      setLoading(true)
      setError(null)
      const [proj, feats] = await Promise.all([projectApi.get(projectID!), projectApi.listTests(projectID!)])
      setProject(proj)
      setEditName(proj.name)
      setEditDescription(proj.description)
      setEditKarateVersion(proj.karateVersion ?? '')
      setTests(feats)
      if (proj.gitUrl) loadGitStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project')
    } finally {
      setLoading(false)
    }
  }

  const loadGitStatus = async () => {
    setGitLoading(true)
    try {
      setGitStatus(await projectApi.getGitStatus(projectID!))
    } catch {
      // non-fatal
    } finally {
      setGitLoading(false)
    }
  }

  const handleCommitPush = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commitMsg.trim()) return
    setPushing(true)
    try {
      await projectApi.gitCommit(projectID!, commitMsg.trim())
      toast('Changes committed and pushed')
      setCommitMsg('')
      setShowCommitForm(false)
      loadGitStatus()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Git push failed', 'error')
    } finally {
      setPushing(false)
    }
  }

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editName.trim()) { setError('Project name is required'); return }
    setSaving(true)
    setError(null)
    try {
      const updated = await projectApi.update(projectID!, {
        name: editName,
        description: editDescription,
        karateVersion: editKarateVersion,
      })
      setProject(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save project')
    } finally {
      setSaving(false)
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

      <SectionHeader
        title={project?.name ?? 'Project'}
        description="Edit project settings and manage Karate feature files."
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {/* ── Project details card ── */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-slate-100">Project Settings</h2>
        <form onSubmit={handleSaveProject} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className={inputCls}
                placeholder="Project name"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
                Karate Version{' '}
                <span className="font-normal text-gray-400 dark:text-slate-500">
                  (blank = latest{karateVersions[0] ? ` · ${karateVersions[0].version}` : ''})
                </span>
              </label>
              <select
                value={editKarateVersion}
                onChange={(e) => setEditKarateVersion(e.target.value)}
                className={inputCls}
              >
                <option value="">Use latest</option>
                {karateVersions.map((v) => (
                  <option key={v.version} value={v.version}>{v.version}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">Description</label>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className={inputCls}
              rows={2}
              placeholder="What APIs or services does this project test?"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Changes'}
          </button>
        </form>
      </section>

      {/* ── Git status card (only for git-connected projects) ── */}
      {project?.gitUrl && (
        <section className="rounded-xl border border-purple-200 bg-white p-6 shadow-sm dark:border-purple-900/40 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-purple-500" />
              <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Git</h2>
              {gitStatus && (
                <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-600 dark:bg-purple-900/20 dark:text-purple-400">
                  {gitStatus.branch}
                </span>
              )}
            </div>
            <button
              onClick={loadGitStatus}
              disabled={gitLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              {gitLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Refresh
            </button>
          </div>

          {gitStatus && (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="flex items-center gap-1.5 text-gray-600 dark:text-slate-400">
                  <ArrowUpDown className="h-3.5 w-3.5 text-gray-400" />
                  <span className="font-medium text-green-600 dark:text-green-400">↑ {gitStatus.ahead}</span>
                  <span className="font-medium text-amber-600 dark:text-amber-400">↓ {gitStatus.behind}</span>
                </span>
                {gitStatus.dirty && (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                    uncommitted changes
                  </span>
                )}
              </div>
              {gitStatus.lastCommit && (
                <p className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-slate-500">
                  <GitCommit className="h-3 w-3 shrink-0" />
                  {gitStatus.lastCommit}
                </p>
              )}
              <p className="text-xs text-gray-400 dark:text-slate-500 break-all">{project.gitUrl}</p>

              {!showCommitForm ? (
                <button
                  onClick={() => setShowCommitForm(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-purple-700"
                >
                  <GitCommit className="h-4 w-4" />
                  Commit &amp; Push
                </button>
              ) : (
                <form onSubmit={handleCommitPush} className="flex items-center gap-3">
                  <input
                    type="text"
                    value={commitMsg}
                    onChange={(e) => setCommitMsg(e.target.value)}
                    className={inputCls + ' flex-1'}
                    placeholder="Commit message…"
                    autoFocus
                    required
                  />
                  <button
                    type="submit"
                    disabled={pushing}
                    className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-purple-700 disabled:opacity-60"
                  >
                    {pushing ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitCommit className="h-4 w-4" />}
                    {pushing ? 'Pushing…' : 'Push'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowCommitForm(false); setCommitMsg('') }}
                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                </form>
              )}
            </div>
          )}
        </section>
      )}

      {/* ── Features section ── */}
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">
          Feature Files
          {tests.length > 0 && (
            <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-500 dark:bg-slate-800 dark:text-slate-400">
              {tests.length}
            </span>
          )}
        </h2>
        <button
          onClick={() => setShowNewForm((v) => !v)}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          {showNewForm ? 'Cancel' : '+ New Feature'}
        </button>
      </div>

      {showNewForm && (
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-slate-100">New Feature File</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
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
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">Description</label>
                <input type="text" value={newTest.description} onChange={(e) => setNewTest({ ...newTest, description: e.target.value })} className={inputCls} placeholder="Optional description" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
                  Tags <span className="font-normal text-gray-400 dark:text-slate-500">(comma-separated)</span>
                </label>
                <input type="text" value={newTest.tags} onChange={(e) => setNewTest({ ...newTest, tags: e.target.value })} className={inputCls} placeholder="e.g., smoke, regression" />
              </div>
            </div>
            <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-700">
              Create Feature
            </button>
          </form>
        </section>
      )}

      {tests.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <FilePlus className="mx-auto mb-3 h-10 w-10 text-gray-300 dark:text-slate-700" />
          <p className="text-base font-medium text-gray-700 dark:text-slate-300">No feature files yet</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">Create a Karate .feature file to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tests.map((test) => (
            <div key={test.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-gray-900 dark:text-slate-100">
                    <Link
                      to={`/projects/${projectID}/features/${test.id}/edit`}
                      className="hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      {test.name}
                    </Link>
                  </h3>
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
                  <Link
                    to={`/projects/${projectID}/features/${test.id}/edit`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Link>
                  <button
                    onClick={async () => {
                      try {
                        await queueApi.add(test.id, projectID!, test.name)
                        toast(`"${test.name}" queued for execution`)
                      } catch (e) {
                        toast(e instanceof Error ? e.message : 'Failed to queue test', 'error')
                      }
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
