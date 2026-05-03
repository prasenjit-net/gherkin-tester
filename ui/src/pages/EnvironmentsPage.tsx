import { useEffect, useState } from 'react'
import { environmentApi } from '../services/api'
import type { Environment } from '../types'
import { useToast } from '../components/Toast'

interface PropertyRow {
  key: string
  value: string
}

interface EnvFormState {
  name: string
  description: string
  rows: PropertyRow[]
}

const emptyForm = (): EnvFormState => ({
  name: '',
  description: '',
  rows: [{ key: '', value: '' }],
})

const envToForm = (env: Environment): EnvFormState => ({
  name: env.name,
  description: env.description ?? '',
  rows: Object.entries(env.properties).map(([key, value]) => ({ key, value })).concat({ key: '', value: '' }),
})

export default function EnvironmentsPage() {
  const [environments, setEnvironments] = useState<Environment[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<EnvFormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const { toast } = useToast()

  const load = async () => {
    try {
      const list = await environmentApi.list()
      setEnvironments(list)
    } catch (e) {
      toast(`Failed to load environments: ${e}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm())
    setModalOpen(true)
  }

  const openEdit = (env: Environment) => {
    setEditingId(env.id)
    setForm(envToForm(env))
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingId(null)
  }

  const setRow = (idx: number, field: 'key' | 'value', val: string) => {
    setForm(f => {
      const rows = [...f.rows]
      rows[idx] = { ...rows[idx], [field]: val }
      // auto-add new row when last row gets a key
      if (idx === rows.length - 1 && val && field === 'key') {
        rows.push({ key: '', value: '' })
      }
      return { ...f, rows }
    })
  }

  const removeRow = (idx: number) => {
    setForm(f => ({
      ...f,
      rows: f.rows.filter((_, i) => i !== idx),
    }))
  }

  const buildProperties = (): Record<string, string> => {
    const props: Record<string, string> = {}
    for (const { key, value } of form.rows) {
      if (key.trim()) props[key.trim()] = value
    }
    return props
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast('Environment name is required', 'error')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description,
        properties: buildProperties(),
      }
      if (editingId) {
        await environmentApi.update(editingId, payload)
        toast('Environment updated')
      } else {
        await environmentApi.create(payload)
        toast('Environment created')
      }
      closeModal()
      load()
    } catch (e) {
      toast(`Save failed: ${e}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await environmentApi.delete(id)
      toast('Environment deleted')
      setDeleteConfirmId(null)
      load()
    } catch (e) {
      toast(`Delete failed: ${e}`, 'error')
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Environments</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Named property sets injected into test executions
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          + New Environment
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading…</div>
      ) : environments.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl">
          <p className="text-gray-500 dark:text-gray-400 mb-2">No environments yet</p>
          <button onClick={openCreate} className="text-blue-600 hover:underline text-sm">
            Create your first environment
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {environments.map(env => (
            <div key={env.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-white text-lg">{env.name}</h3>
                  {env.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{env.description}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(env.properties).length === 0 ? (
                      <span className="text-xs text-gray-400 dark:text-gray-500 italic">No properties</span>
                    ) : (
                      Object.entries(env.properties).map(([k, v]) => (
                        <span key={k} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-xs font-mono text-gray-700 dark:text-gray-300">
                          <span className="font-semibold">{k}</span>
                          <span className="text-gray-400">=</span>
                          <span>{v}</span>
                        </span>
                      ))
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  <button
                    onClick={() => openEdit(env)}
                    className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    Edit
                  </button>
                  {deleteConfirmId === env.id ? (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-red-600 dark:text-red-400">Confirm?</span>
                      <button
                        onClick={() => handleDelete(env.id)}
                        className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirmId(env.id)}
                      className="px-3 py-1.5 text-sm bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                {editingId ? 'Edit Environment' : 'New Environment'}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. dev, uat, prod"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Optional description"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Properties</label>
                  <div className="space-y-2">
                    {form.rows.map((row, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={row.key}
                          onChange={e => setRow(idx, 'key', e.target.value)}
                          placeholder="key"
                          className="flex-1 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                        <span className="text-gray-400 text-sm">=</span>
                        <input
                          type="text"
                          value={row.value}
                          onChange={e => setRow(idx, 'value', e.target.value)}
                          placeholder="value"
                          className="flex-1 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                        {idx < form.rows.length - 1 && (
                          <button
                            onClick={() => removeRow(idx)}
                            className="text-red-400 hover:text-red-600 text-lg leading-none px-1"
                            title="Remove"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Properties are passed as <code>-Dkey=value</code> JVM flags and via <code>karate-config.js</code>
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
