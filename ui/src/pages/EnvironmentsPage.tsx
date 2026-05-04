import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Globe, Pencil, Plus, Trash2 } from 'lucide-react'
import { useToast } from '../components/Toast'
import { environmentApi } from '../services/api'
import type { Environment } from '../types'

export default function EnvironmentsPage() {
  const [environments, setEnvironments] = useState<Environment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const { toast } = useToast()

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      setEnvironments(await environmentApi.list())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load environments')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const handleDelete = async (id: string) => {
    try {
      await environmentApi.delete(id)
      toast('Environment deleted')
      setDeleteConfirmId(null)
      await load()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Delete failed', 'error')
    }
  }

  return (
    <div className="space-y-8 p-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Globe className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Environments</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Named property sets and optional HTTP proxies for queued executions
            </p>
          </div>
        </div>
        <Link
          to="/environments/new"
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          New Environment
        </Link>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <p className="py-8 text-center text-sm text-gray-500 dark:text-slate-400">Loading environments…</p>
      ) : environments.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <Globe className="mx-auto mb-3 h-12 w-12 text-gray-200 dark:text-slate-700" />
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Create an environment to inject properties and an optional proxy into test executions.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {environments.map((env) => {
            const propertyCount = Object.keys(env.properties).length

            return (
              <div
                key={env.id}
                className="group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-start gap-4 p-4">
                  <Globe className="mt-0.5 h-6 w-6 shrink-0 text-indigo-500 dark:text-indigo-400" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-semibold text-gray-900 dark:text-slate-100">{env.name}</h3>
                      {env.httpProxy && (
                        <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/20 dark:text-purple-300">
                          Proxy enabled
                        </span>
                      )}
                      {env.mtls && (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                          mTLS enabled
                        </span>
                      )}
                    </div>
                    {env.description && (
                      <p className="mt-0.5 truncate text-sm text-gray-500 dark:text-slate-400">{env.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-400 dark:text-slate-500">
                      <span>{propertyCount} {propertyCount === 1 ? 'property' : 'properties'}</span>
                      <span>{env.httpProxy ? 'Proxy configured' : 'No proxy'}</span>
                      <span>{env.mtls ? 'Client cert configured' : 'No mTLS'}</span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {env.httpProxy && (
                        <div className="rounded-lg border border-purple-100 bg-purple-50/70 px-3 py-2 text-xs text-purple-700 dark:border-purple-900/40 dark:bg-purple-900/10 dark:text-purple-300">
                          <span className="font-semibold">HTTP proxy:</span> {env.httpProxy}
                        </div>
                      )}
                      {env.mtls && (
                        <div className="rounded-lg border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/10 dark:text-emerald-300">
                          <span className="font-semibold">mTLS:</span> {env.mtls.certificateFileName} + {env.mtls.privateKeyFileName}
                          {env.mtls.hasPrivateKeyPassword ? ' (password stored)' : ''}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        {propertyCount === 0 ? (
                          <span className="text-xs italic text-gray-400 dark:text-slate-500">No properties</span>
                        ) : (
                          Object.entries(env.properties).map(([key, value]) => (
                            <span
                              key={key}
                              className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-mono text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                            >
                              <span className="font-semibold">{key}</span>
                              <span className="opacity-50">=</span>
                              <span>{value}</span>
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      to={`/environments/${env.id}/edit`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Link>
                    {deleteConfirmId === env.id ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-red-600 dark:text-red-400">Delete?</span>
                        <button
                          onClick={() => void handleDelete(env.id)}
                          className="rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(env.id)}
                        className="rounded-lg border border-red-200 p-1.5 text-red-500 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                        title="Delete environment"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
