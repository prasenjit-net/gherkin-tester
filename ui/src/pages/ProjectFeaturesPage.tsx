import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowUpDown, ChevronRight, CloudDownload, FilePlus, FileText, GitBranch, GitCommit, Loader2, ListOrdered, Pencil, RefreshCw, Save, Tag, Trash2, Upload } from 'lucide-react'
import SectionHeader from '../components/SectionHeader'
import QueueModal from '../components/QueueModal'
import { useToast } from '../components/Toast'
import { karateApi, projectApi } from '../services/api'
import type { GitStatusResult, KarateVersion, Project, Spec, Test } from '../types'

const inputCls =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500'

export default function ProjectFeaturesPage() {
  const { projectID } = useParams<{ projectID: string }>()
  const { toast } = useToast()
  const [project, setProject] = useState<Project | null>(null)
  const [tests, setTests] = useState<Test[]>([])
  const [specs, setSpecs] = useState<Spec[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editKarateVersion, setEditKarateVersion] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [karateVersions, setKarateVersions] = useState<KarateVersion[]>([])

  const [showNewForm, setShowNewForm] = useState(false)
  const [newTest, setNewTest] = useState({ id: '', name: '', description: '', tags: '' })

  const [showSpecForm, setShowSpecForm] = useState(false)
  const [uploadingSpec, setUploadingSpec] = useState(false)
  const [newSpec, setNewSpec] = useState({ name: '', description: '', file: null as File | null })

  const [gitStatus, setGitStatus] = useState<GitStatusResult | null>(null)
  const [gitLoading, setGitLoading] = useState(false)
  const [showCommitForm, setShowCommitForm] = useState(false)
  const [commitMsg, setCommitMsg] = useState('')
  const [pushing, setPushing] = useState(false)
  const [pulling, setPulling] = useState(false)

  const [queueTest, setQueueTest] = useState<Test | null>(null)

  const loadGitStatus = useCallback(async () => {
    if (!projectID) return
    setGitLoading(true)
    try {
      setGitStatus(await projectApi.getGitStatus(projectID))
    } catch {
      // non-fatal
    } finally {
      setGitLoading(false)
    }
  }, [projectID])

  const loadAll = useCallback(async () => {
    if (!projectID) return
    try {
      setLoading(true)
      setError(null)
      const [proj, feats, specList] = await Promise.all([
        projectApi.get(projectID),
        projectApi.listTests(projectID),
        projectApi.listSpecs(projectID),
      ])
      setProject(proj)
      setEditName(proj.name)
      setEditDescription(proj.description)
      setEditKarateVersion(proj.karateVersion ?? '')
      setTests(feats)
      setSpecs(specList)
      if (proj.gitUrl) {
        void loadGitStatus()
      } else {
        setGitStatus(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project')
    } finally {
      setLoading(false)
    }
  }, [loadGitStatus, projectID])

  useEffect(() => {
    if (!projectID) return
    void loadAll()
    karateApi.listVersions().then(setKarateVersions).catch(() => {})
  }, [loadAll, projectID])

  const handleCommitPush = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectID || !commitMsg.trim()) return
    setPushing(true)
    try {
      await projectApi.gitCommit(projectID, commitMsg.trim())
      toast('Changes committed and pushed')
      setCommitMsg('')
      setShowCommitForm(false)
      await loadGitStatus()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Git push failed', 'error')
    } finally {
      setPushing(false)
    }
  }

  const handlePull = async () => {
    if (!projectID) return
    setPulling(true)
    try {
      await projectApi.gitPull(projectID)
      toast('Pulled latest changes')
      await loadGitStatus()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Git pull failed', 'error')
    } finally {
      setPulling(false)
    }
  }

  const handleForcePull = async () => {
    if (!projectID || !confirm('Force pull will discard ALL local changes and reset to the remote branch. Continue?')) return
    setPulling(true)
    try {
      await projectApi.gitForcePull(projectID)
      toast('Force-pulled: local changes discarded')
      await loadGitStatus()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Force pull failed', 'error')
    } finally {
      setPulling(false)
    }
  }

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectID) return
    if (!editName.trim()) {
      setError('Project name is required')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const updated = await projectApi.update(projectID, {
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
    if (!projectID) return
    if (!newTest.name) {
      setError('Name is required')
      return
    }
    try {
      await projectApi.createTest(projectID, {
        id: newTest.id,
        name: newTest.name,
        description: newTest.description,
        content: 'Feature: Example\n  Scenario: Example\n    Given url "https://httpbin.org/get"\n    When method GET\n    Then status 200',
        tags: newTest.tags.split(',').map((t) => t.trim()).filter(Boolean),
      })
      setNewTest({ id: '', name: '', description: '', tags: '' })
      setShowNewForm(false)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create feature')
    }
  }

  const handleDelete = async (testID: string) => {
    if (!projectID || !confirm('Delete this feature file?')) return
    try {
      await projectApi.deleteTest(projectID, testID)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete feature')
    }
  }

  const handleUploadSpec = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectID) return
    if (!newSpec.file) {
      setError('Spec file is required')
      return
    }
    setUploadingSpec(true)
    setError(null)
    try {
      await projectApi.createSpec(projectID, {
        name: newSpec.name || undefined,
        description: newSpec.description || undefined,
        file: newSpec.file,
      })
      setNewSpec({ name: '', description: '', file: null })
      setShowSpecForm(false)
      await loadAll()
      toast('Spec uploaded')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload spec')
    } finally {
      setUploadingSpec(false)
    }
  }

  const handleDeleteSpec = async (specID: string) => {
    if (!projectID || !confirm('Delete this spec file?')) return
    try {
      await projectApi.deleteSpec(projectID, specID)
      await loadAll()
      toast('Spec deleted')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete spec')
    }
  }

  if (loading) return <p className="p-8 text-sm text-gray-500 dark:text-slate-400">Loading…</p>

  return (
    <div className="space-y-8 p-8">
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-slate-400">
        <Link to="/projects" className="transition-colors hover:text-blue-600 dark:hover:text-blue-400">Projects</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-gray-800 dark:text-slate-200">{project?.name ?? projectID}</span>
      </nav>

      <SectionHeader
        title={project?.name ?? 'Project'}
        description="Edit project settings and manage Karate feature files and OpenAPI specs."
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

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
              onClick={() => void loadGitStatus()}
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
              <p className="break-all text-xs text-gray-400 dark:text-slate-500">{project.gitUrl}</p>

              {!showCommitForm ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handlePull}
                    disabled={pulling}
                    className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 shadow-sm transition-colors hover:bg-blue-100 disabled:opacity-60 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40"
                  >
                    {pulling ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudDownload className="h-4 w-4" />}
                    {pulling ? 'Pulling…' : 'Pull'}
                  </button>
                  <button
                    onClick={handleForcePull}
                    disabled={pulling}
                    className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 shadow-sm transition-colors hover:bg-amber-100 disabled:opacity-60 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/40"
                  >
                    {pulling ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudDownload className="h-4 w-4" />}
                    Force Pull
                  </button>
                  <button
                    onClick={() => setShowCommitForm(true)}
                    className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-purple-700"
                  >
                    <GitCommit className="h-4 w-4" />
                    Commit &amp; Push
                  </button>
                </div>
              ) : (
                <form onSubmit={handleCommitPush} className="flex items-center gap-3">
                  <input
                    type="text"
                    value={commitMsg}
                    onChange={(e) => setCommitMsg(e.target.value)}
                    className={`${inputCls} flex-1`}
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

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <section className="space-y-4">
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
              onClick={() => setShowNewForm((value) => !value)}
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
                        onClick={() => setQueueTest(test)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 px-3 py-1.5 text-sm font-medium text-green-700 transition-colors hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-900/20"
                      >
                        <ListOrdered className="h-3.5 w-3.5" /> Queue
                      </button>
                      <button
                        onClick={() => void handleDelete(test.id)}
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
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">
              OpenAPI Specs
              {specs.length > 0 && (
                <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-500 dark:bg-slate-800 dark:text-slate-400">
                  {specs.length}
                </span>
              )}
            </h2>
            <button
              onClick={() => setShowSpecForm((value) => !value)}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
            >
              <Upload className="h-4 w-4" />
              {showSpecForm ? 'Cancel' : 'Upload Spec'}
            </button>
          </div>

          {showSpecForm && (
            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-slate-100">Upload OpenAPI 3 Spec</h3>
              <form onSubmit={handleUploadSpec} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
                      Display name <span className="font-normal text-gray-400 dark:text-slate-500">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={newSpec.name}
                      onChange={(e) => setNewSpec((current) => ({ ...current, name: e.target.value }))}
                      className={inputCls}
                      placeholder="Defaults to spec title or filename"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
                      Spec file <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="file"
                      accept=".yaml,.yml,.json"
                      className={inputCls}
                      onChange={(e) => setNewSpec((current) => ({ ...current, file: e.target.files?.[0] ?? null }))}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">Description</label>
                  <input
                    type="text"
                    value={newSpec.description}
                    onChange={(e) => setNewSpec((current) => ({ ...current, description: e.target.value }))}
                    className={inputCls}
                    placeholder="Optional internal note about this spec"
                  />
                </div>
                <button
                  type="submit"
                  disabled={uploadingSpec}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-60"
                >
                  {uploadingSpec ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploadingSpec ? 'Uploading…' : 'Upload Spec'}
                </button>
              </form>
            </section>
          )}

          {specs.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white py-16 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <FileText className="mx-auto mb-3 h-10 w-10 text-gray-300 dark:text-slate-700" />
              <p className="text-base font-medium text-gray-700 dark:text-slate-300">No specs yet</p>
              <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">Upload an OpenAPI 3 YAML or JSON spec to inspect operations and drive future test generation.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {specs.map((spec) => (
                <div key={spec.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold text-gray-900 dark:text-slate-100">
                        <Link
                          to={`/projects/${projectID}/specs/${spec.id}`}
                          className="hover:text-blue-600 dark:hover:text-blue-400"
                        >
                          {spec.name}
                        </Link>
                      </h3>
                      {spec.description && (
                        <p className="mt-0.5 text-sm text-gray-500 dark:text-slate-400">{spec.description}</p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-400 dark:text-slate-500">
                        <span>{spec.fileName}</span>
                        <span>{spec.summary.pathsCount} paths</span>
                        <span>{spec.summary.operationsCount} operations</span>
                        {spec.summary.version && <span>v{spec.summary.version}</span>}
                      </div>
                      {spec.summary.tags && spec.summary.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {spec.summary.tags.slice(0, 6).map((tag) => (
                            <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-slate-800 dark:text-slate-300">
                              {tag}
                            </span>
                          ))}
                          {spec.summary.tags.length > 6 && (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-slate-800 dark:text-slate-400">
                              +{spec.summary.tags.length - 6}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Link
                        to={`/projects/${projectID}/specs/${spec.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        <FileText className="h-3.5 w-3.5" /> View
                      </Link>
                      <button
                        onClick={() => void handleDeleteSpec(spec.id)}
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
        </section>
      </div>

      {queueTest && (
        <QueueModal
          test={queueTest}
          onClose={() => setQueueTest(null)}
        />
      )}
    </div>
  )
}
