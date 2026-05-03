import { useEffect, useState } from 'react'
import { environmentApi, queueApi } from '../services/api'
import type { Environment, Test } from '../types'
import { useToast } from './Toast'

interface Props {
  test: Test
  onClose: () => void
  onQueued?: () => void
}

export default function QueueModal({ test, onClose, onQueued }: Props) {
  const [environments, setEnvironments] = useState<Environment[]>([])
  const [selectedEnvId, setSelectedEnvId] = useState('')
  const [tagsInput, setTagsInput] = useState((test.tags ?? []).join(', '))
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    environmentApi.list()
      .then(list => setEnvironments(list))
      .catch(() => {/* ignore — env list is optional */})
      .finally(() => setLoading(false))
  }, [])

  const parseTags = (): string[] =>
    tagsInput.split(',').map(t => t.trim()).filter(Boolean)

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      await queueApi.add(test.id, test.projectId, test.name, selectedEnvId || undefined, parseTags())
      toast(`"${test.name}" added to queue`)
      onQueued?.()
      onClose()
    } catch (e) {
      toast(`Failed to queue test: ${e}`, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Queue Test</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5 truncate">
            {test.name}
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Environment <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              {loading ? (
                <div className="text-sm text-gray-400">Loading environments…</div>
              ) : (
                <select
                  value={selectedEnvId}
                  onChange={e => setSelectedEnvId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">— No environment —</option>
                  {environments.map(env => (
                    <option key={env.id} value={env.id}>
                      {env.name}{env.description ? ` — ${env.description}` : ''}
                    </option>
                  ))}
                </select>
              )}
              {selectedEnvId && (() => {
                const env = environments.find(e => e.id === selectedEnvId)
                if (!env || Object.keys(env.properties).length === 0) return null
                return (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {Object.entries(env.properties).map(([k, v]) => (
                      <span key={k} className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs font-mono">
                        {k}={v}
                      </span>
                    ))}
                  </div>
                )
              })()}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tags <span className="text-gray-400 font-normal">(comma-separated, optional)</span>
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={e => setTagsInput(e.target.value)}
                placeholder="e.g. smoke, regression"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Only scenarios tagged with these will run. Leave empty to run all.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Queuing…' : 'Add to Queue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
