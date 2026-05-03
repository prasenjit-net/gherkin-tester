import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderKanban, Plus, Trash2 } from 'lucide-react'
import SectionHeader from '../components/SectionHeader'
import { projectApi } from '../services/api'
import type { Project } from '../types'

const inputCls =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500'

export default function ProjectsPage() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newProject, setNewProject] = useState({ id: '', name: '', description: '' })

  useEffect(() => { loadProjects() }, [])

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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProject.name) { setError('Name is required'); return }
    try {
      await projectApi.create({ id: newProject.id, name: newProject.name, description: newProject.description })
      setNewProject({ id: '', name: '', description: '' })
      setShowNewForm(false)
      loadProjects()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project')
    }
  }

  const handleDelete = async (projectID: string) => {
    if (!confirm('Delete this project? This will not delete its tests.')) return
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
        <button
          onClick={() => setShowNewForm((v) => !v)}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <Plus className="h-4 w-4" />
          {showNewForm ? 'Cancel' : 'New Project'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {showNewForm && (
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-slate-100">New Project</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
                Project ID <span className="font-normal text-gray-400 dark:text-slate-500">(optional — auto-generated if blank)</span>
              </label>
              <input type="text" value={newProject.id} onChange={(e) => setNewProject({ ...newProject, id: e.target.value })} className={inputCls} placeholder="e.g., my-api-project" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">Name <span className="text-red-500">*</span></label>
              <input type="text" value={newProject.name} onChange={(e) => setNewProject({ ...newProject, name: e.target.value })} className={inputCls} placeholder="Project name" required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">Description</label>
              <textarea value={newProject.description} onChange={(e) => setNewProject({ ...newProject, description: e.target.value })} className={inputCls} rows={2} placeholder="What APIs or services does this project test?" />
            </div>
            <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-700">
              <Plus className="h-4 w-4" /> Create Project
            </button>
          </form>
        </section>
      )}

      {loading ? (
        <p className="py-8 text-center text-sm text-gray-500 dark:text-slate-400">Loading projects…</p>
      ) : projects.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <FolderKanban className="mx-auto mb-3 h-10 w-10 text-gray-300 dark:text-slate-700" />
          <p className="text-base font-medium text-gray-700 dark:text-slate-300">No projects yet</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">Create your first project to start organising feature files.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <div
              key={project.id}
              className="group cursor-pointer rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
              onClick={() => navigate(`/projects/${project.id}/features`)}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100 truncate">{project.name}</h3>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(project.id) }}
                  className="shrink-0 rounded-lg border border-red-200 p-1.5 text-red-500 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                  title="Delete project"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {project.description && (
                <p className="mb-4 text-sm text-gray-500 dark:text-slate-400 line-clamp-2">{project.description}</p>
              )}
              <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-slate-800">
                <span className="text-xs text-gray-400 dark:text-slate-500">
                  {new Date(project.createdAt).toLocaleDateString()}
                </span>
                <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  View features →
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
