import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderKanban, GitBranch, Globe, Plus, Trash2, X } from 'lucide-react'
import SectionHeader from '../components/SectionHeader'
import { karateApi, projectApi } from '../services/api'
import type { KarateVersion, Project } from '../types'

const inputCls =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500'

type ModalMode = 'new' | 'import' | null

export default function ProjectsPage() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalMode, setModalMode] = useState<ModalMode>(null)
  const [submitting, setSubmitting] = useState(false)

  // New project form
  const [newProject, setNewProject] = useState({ id: '', name: '', description: '', karateVersion: '' })

  // Import form
  const [importForm, setImportForm] = useState({ repoUrl: '', branch: '', name: '', description: '', karateVersion: '' })

  const [karateVersions, setKarateVersions] = useState<KarateVersion[]>([])

  useEffect(() => {
    loadProjects()
    karateApi.listVersions().then(setKarateVersions).catch(() => {})
  }, [])

  const loadProjects = async () => {
    try {
      setLoading(true)
      setError(null)
      setProjects(await projectApi.list())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects')
    } finally {
      setLoading(false)
    }
  }

  const closeModal = () => {
    setModalMode(null)
    setError(null)
    setNewProject({ id: '', name: '', description: '', karateVersion: '' })
    setImportForm({ repoUrl: '', branch: '', name: '', description: '', karateVersion: '' })
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProject.name) { setError('Name is required'); return }
    setSubmitting(true)
    setError(null)
    try {
      const p = await projectApi.create({ id: newProject.id, name: newProject.name, description: newProject.description, karateVersion: newProject.karateVersion })
      closeModal()
      await loadProjects()
      navigate(`/projects/${p.id}/features`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project')
    } finally {
      setSubmitting(false)
    }
  }

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!importForm.repoUrl) { setError('Repository URL is required'); return }
    setSubmitting(true)
    setError(null)
    try {
      const p = await projectApi.importGit(
        importForm.repoUrl,
        importForm.branch || undefined,
        importForm.name || undefined,
        importForm.description || undefined,
        importForm.karateVersion || undefined,
      )
      closeModal()
      await loadProjects()
      navigate(`/projects/${p.id}/features`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import project')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (projectID: string) => {
    if (!confirm('Delete this project? This cannot be undone.')) return
    try {
      await projectApi.delete(projectID)
      loadProjects()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project')
    }
  }

  return (
    <div className="space-y-8 p-8">
      <div className="flex items-start justify-between gap-4">
        <SectionHeader title="Projects" description="Organise your Karate feature files by project." />
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => setModalMode('import')}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <GitBranch className="h-4 w-4" />
            Import from Git
          </button>
          <button
            onClick={() => setModalMode('new')}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            New Project
          </button>
        </div>
      </div>

      {error && !modalMode && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <p className="py-8 text-center text-sm text-gray-500 dark:text-slate-400">Loading projects…</p>
      ) : projects.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <FolderKanban className="mx-auto mb-3 h-10 w-10 text-gray-300 dark:text-slate-700" />
          <p className="text-base font-medium text-gray-700 dark:text-slate-300">No projects yet</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">Create a new project or import one from Git.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => (
            <div
              key={project.id}
              className="group flex cursor-pointer items-center gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
              onClick={() => navigate(`/projects/${project.id}/features`)}
            >
              <FolderKanban className="h-8 w-8 shrink-0 text-blue-400 dark:text-blue-500" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-base font-semibold text-gray-900 dark:text-slate-100">{project.name}</h3>
                  {project.gitUrl && (
                    <span className="flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-600 dark:bg-purple-900/20 dark:text-purple-400">
                      <GitBranch className="h-3 w-3" />
                      {project.gitBranch || 'git'}
                    </span>
                  )}
                </div>
                {project.description && (
                  <p className="mt-0.5 truncate text-sm text-gray-500 dark:text-slate-400">{project.description}</p>
                )}
                {project.gitUrl && (
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-gray-400 dark:text-slate-500">
                    <Globe className="h-3 w-3 shrink-0" />
                    {project.gitUrl}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="hidden text-xs text-gray-400 dark:text-slate-500 sm:block">
                  {new Date(project.createdAt).toLocaleDateString()}
                </span>
                {project.karateVersion && (
                  <span className="hidden rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 sm:block">
                    {project.karateVersion}
                  </span>
                )}
                <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Open →</span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(project.id) }}
                  className="rounded-lg border border-red-200 p-1.5 text-red-500 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                  title="Delete project"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modals ── */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-slate-700">
              <div className="flex items-center gap-2">
                {modalMode === 'import' ? (
                  <GitBranch className="h-5 w-5 text-purple-500" />
                ) : (
                  <Plus className="h-5 w-5 text-blue-500" />
                )}
                <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">
                  {modalMode === 'import' ? 'Import Project from Git' : 'New Project'}
                </h2>
              </div>
              <button onClick={closeModal} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-800 dark:hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5">
              {error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">
                  {error}
                </div>
              )}

              {modalMode === 'import' ? (
                <form onSubmit={handleImport} className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
                      Repository URL <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="url"
                      value={importForm.repoUrl}
                      onChange={(e) => setImportForm({ ...importForm, repoUrl: e.target.value })}
                      className={inputCls}
                      placeholder="https://github.com/user/my-tests.git"
                      required
                      autoFocus
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
                        Branch <span className="font-normal text-gray-400 dark:text-slate-500">(default branch if blank)</span>
                      </label>
                      <input
                        type="text"
                        value={importForm.branch}
                        onChange={(e) => setImportForm({ ...importForm, branch: e.target.value })}
                        className={inputCls}
                        placeholder="main"
                      />
                    </div>
                    {karateVersions.length > 0 && (
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
                          Karate Version
                        </label>
                        <select
                          value={importForm.karateVersion}
                          onChange={(e) => setImportForm({ ...importForm, karateVersion: e.target.value })}
                          className={inputCls}
                        >
                          <option value="">Latest ({karateVersions[0]?.version})</option>
                          {karateVersions.map((v) => (
                            <option key={v.version} value={v.version}>{v.version}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
                      Name override <span className="font-normal text-gray-400 dark:text-slate-500">(optional — uses repo name by default)</span>
                    </label>
                    <input
                      type="text"
                      value={importForm.name}
                      onChange={(e) => setImportForm({ ...importForm, name: e.target.value })}
                      className={inputCls}
                      placeholder="Leave blank to use repo name"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">Description</label>
                    <textarea
                      value={importForm.description}
                      onChange={(e) => setImportForm({ ...importForm, description: e.target.value })}
                      className={inputCls}
                      rows={2}
                      placeholder="Optional description"
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button type="button" onClick={closeModal} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-purple-700 disabled:opacity-60"
                    >
                      <GitBranch className="h-4 w-4" />
                      {submitting ? 'Cloning…' : 'Import Project'}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleCreate} className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
                      Project ID <span className="font-normal text-gray-400 dark:text-slate-500">(optional)</span>
                    </label>
                    <input type="text" value={newProject.id} onChange={(e) => setNewProject({ ...newProject, id: e.target.value })} className={inputCls} placeholder="e.g., my-api-project" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">Name <span className="text-red-500">*</span></label>
                    <input type="text" value={newProject.name} onChange={(e) => setNewProject({ ...newProject, name: e.target.value })} className={inputCls} placeholder="Project name" required autoFocus />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">Description</label>
                    <textarea value={newProject.description} onChange={(e) => setNewProject({ ...newProject, description: e.target.value })} className={inputCls} rows={2} placeholder="What does this project test?" />
                  </div>
                  {karateVersions.length > 0 && (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
                        Karate Version <span className="font-normal text-gray-400 dark:text-slate-500">(default: latest)</span>
                      </label>
                      <select value={newProject.karateVersion} onChange={(e) => setNewProject({ ...newProject, karateVersion: e.target.value })} className={inputCls}>
                        <option value="">Latest ({karateVersions[0]?.version})</option>
                        {karateVersions.map((v) => (
                          <option key={v.version} value={v.version}>{v.version}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="flex justify-end gap-3 pt-2">
                    <button type="button" onClick={closeModal} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                      Cancel
                    </button>
                    <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60">
                      <Plus className="h-4 w-4" />
                      {submitting ? 'Creating…' : 'Create Project'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
