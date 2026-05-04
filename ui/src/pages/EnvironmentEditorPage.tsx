import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronRight, Pencil, Plus, Shield, Trash2, X } from 'lucide-react'
import { useToast } from '../components/Toast'
import { environmentApi } from '../services/api'
import type { Environment, EnvironmentDraft } from '../types'

const inputCls =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500'

interface PropertyRow {
  key: string
  value: string
}

interface EnvironmentFormState {
  name: string
  description: string
  httpProxy: string
  mtlsPrivateKeyPassword: string
  clearMTLS: boolean
  clearMTLSPrivateKeyPassword: boolean
  rows: PropertyRow[]
}

const emptyForm = (): EnvironmentFormState => ({
  name: '',
  description: '',
  httpProxy: '',
  mtlsPrivateKeyPassword: '',
  clearMTLS: false,
  clearMTLSPrivateKeyPassword: false,
  rows: [{ key: '', value: '' }],
})

const envToForm = (env: Environment): EnvironmentFormState => ({
  name: env.name,
  description: env.description ?? '',
  httpProxy: env.httpProxy ?? '',
  mtlsPrivateKeyPassword: '',
  clearMTLS: false,
  clearMTLSPrivateKeyPassword: false,
  rows: [...Object.entries(env.properties).map(([key, value]) => ({ key, value })), { key: '', value: '' }],
})

export default function EnvironmentEditorPage() {
  const { environmentID } = useParams<{ environmentID: string }>()
  const isEditing = Boolean(environmentID)
  const navigate = useNavigate()
  const { toast } = useToast()

  const [form, setForm] = useState<EnvironmentFormState>(emptyForm())
  const [environment, setEnvironment] = useState<Environment | null>(null)
  const [certificateFile, setCertificateFile] = useState<File | null>(null)
  const [privateKeyFile, setPrivateKeyFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!environmentID) {
      setEnvironment(null)
      setForm(emptyForm())
      setCertificateFile(null)
      setPrivateKeyFile(null)
      setLoading(false)
      return
    }

    const loadEnvironment = async () => {
      try {
        setLoading(true)
        setError(null)
        const env = await environmentApi.get(environmentID)
        setEnvironment(env)
        setForm(envToForm(env))
        setCertificateFile(null)
        setPrivateKeyFile(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load environment')
      } finally {
        setLoading(false)
      }
    }

    void loadEnvironment()
  }, [environmentID])

  const setRow = (idx: number, field: 'key' | 'value', val: string) => {
    setForm((current) => {
      const rows = [...current.rows]
      rows[idx] = { ...rows[idx], [field]: val }
      if (idx === rows.length - 1 && val && field === 'key') {
        rows.push({ key: '', value: '' })
      }
      return { ...current, rows }
    })
  }

  const removeRow = (idx: number) => {
    setForm((current) => ({ ...current, rows: current.rows.filter((_, rowIdx) => rowIdx !== idx) }))
  }

  const existingMTLS = environment?.mtls
  const isReplacingMTLSFiles = certificateFile !== null || privateKeyFile !== null
  const hasExistingMTLS = Boolean(existingMTLS && !form.clearMTLS)

  const mtlsSummary = useMemo(() => {
    if (form.clearMTLS) {
      return 'mTLS will be removed when you save.'
    }
    if (isReplacingMTLSFiles) {
      return 'Upload both the client certificate and private key together to replace the existing mTLS files.'
    }
    if (existingMTLS) {
      return 'Existing environment mTLS files will be reused unless you upload a new pair or remove them.'
    }
    return 'Upload a PEM certificate and PEM private key to enable client certificate authentication.'
  }, [existingMTLS, form.clearMTLS, isReplacingMTLSFiles])

  const buildDraft = (): EnvironmentDraft => {
    const properties: Record<string, string> = {}
    for (const { key, value } of form.rows) {
      const trimmedKey = key.trim()
      if (trimmedKey) {
        properties[trimmedKey] = value
      }
    }

    const draft: EnvironmentDraft = {
      name: form.name.trim(),
      description: form.description.trim(),
      httpProxy: form.httpProxy.trim(),
      properties,
    }

    if (form.clearMTLS || form.mtlsPrivateKeyPassword || form.clearMTLSPrivateKeyPassword) {
      draft.mtls = {
        clear: form.clearMTLS,
        privateKeyPassword: form.mtlsPrivateKeyPassword || undefined,
        clearPrivateKeyPassword: form.clearMTLSPrivateKeyPassword || undefined,
      }
    }

    return draft
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Name is required')
      return
    }
    if (!form.clearMTLS && (certificateFile === null) !== (privateKeyFile === null)) {
      setError('Upload both the mTLS certificate and private key files together')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const payload = buildDraft()
      const files = form.clearMTLS ? undefined : { certificate: certificateFile, privateKey: privateKeyFile }
      if (environmentID) {
        await environmentApi.update(environmentID, payload, files)
        toast('Environment updated')
      } else {
        await environmentApi.create(payload, files)
        toast('Environment created')
      }
      navigate('/environments')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="p-8 text-sm text-gray-500 dark:text-slate-400">Loading environment…</p>
  }

  return (
    <div className="space-y-8 p-8">
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-slate-400">
        <Link to="/environments" className="transition-colors hover:text-blue-600 dark:hover:text-blue-400">
          Environments
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-gray-800 dark:text-slate-200">
          {isEditing ? form.name || 'Edit environment' : 'New environment'}
        </span>
      </nav>

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {isEditing ? (
            <Pencil className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
          ) : (
            <Plus className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
              {isEditing ? 'Edit Environment' : 'New Environment'}
            </h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Configure properties, proxy settings, and optional client-certificate authentication
            </p>
          </div>
        </div>
        <Link
          to="/environments"
          className="shrink-0 text-sm text-gray-500 transition-colors hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          ← Back
        </Link>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-gray-100 px-6 py-4 dark:border-slate-800">
            <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Environment details</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                  className={inputCls}
                  placeholder="e.g. dev, uat, prod"
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
                  HTTP Proxy <span className="font-normal text-gray-400 dark:text-slate-500">(optional)</span>
                </label>
                <input
                  type="text"
                  value={form.httpProxy}
                  onChange={(e) => setForm((current) => ({ ...current, httpProxy: e.target.value }))}
                  className={inputCls}
                  placeholder="http://proxy.internal:8080"
                />
                <p className="mt-1.5 text-xs text-gray-400 dark:text-slate-500">
                  Stored in the environment and applied from <code className="rounded bg-gray-100 px-1 dark:bg-slate-800">karate-config.js</code> for queued runs.
                </p>
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
                Description <span className="font-normal text-gray-400 dark:text-slate-500">(optional)</span>
              </label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
                className={inputCls}
                placeholder="Short description of this environment"
              />
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-gray-100 px-6 py-4 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">mTLS client authentication</h2>
            </div>
          </div>
          <div className="space-y-4 p-6">
            <p className="text-sm text-gray-500 dark:text-slate-400">{mtlsSummary}</p>

            {existingMTLS && !form.clearMTLS && (
              <div className="rounded-lg border border-indigo-100 bg-indigo-50/70 p-4 text-sm dark:border-indigo-900/40 dark:bg-indigo-900/10">
                <p className="font-medium text-indigo-800 dark:text-indigo-300">Current environment files</p>
                <div className="mt-2 space-y-1 text-indigo-700 dark:text-indigo-300">
                  <p>Certificate: {existingMTLS.certificateFileName}</p>
                  <p>Private key: {existingMTLS.privateKeyFileName}</p>
                  <p>{existingMTLS.hasPrivateKeyPassword ? 'Private key password stored' : 'No private key password stored'}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
                  Client certificate <span className="font-normal text-gray-400 dark:text-slate-500">(PEM)</span>
                </label>
                <input
                  type="file"
                  accept=".crt,.cert,.pem"
                  className={inputCls}
                  onChange={(e) => {
                    setCertificateFile(e.target.files?.[0] ?? null)
                    setForm((current) => ({ ...current, clearMTLS: false }))
                  }}
                />
                {certificateFile && <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">{certificateFile.name}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
                  Private key <span className="font-normal text-gray-400 dark:text-slate-500">(PEM)</span>
                </label>
                <input
                  type="file"
                  accept=".key,.pem"
                  className={inputCls}
                  onChange={(e) => {
                    setPrivateKeyFile(e.target.files?.[0] ?? null)
                    setForm((current) => ({ ...current, clearMTLS: false }))
                  }}
                />
                {privateKeyFile && <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">{privateKeyFile.name}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
                  Private key password <span className="font-normal text-gray-400 dark:text-slate-500">(optional)</span>
                </label>
                <input
                  type="password"
                  value={form.mtlsPrivateKeyPassword}
                  onChange={(e) => setForm((current) => ({ ...current, mtlsPrivateKeyPassword: e.target.value }))}
                  className={inputCls}
                  placeholder={existingMTLS?.hasPrivateKeyPassword ? 'Leave blank to keep existing password' : 'Enter password if your key is encrypted'}
                />
              </div>
              <div className="flex flex-col justify-end gap-3 text-sm">
                {hasExistingMTLS && (
                  <label className="inline-flex items-center gap-2 text-gray-600 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={form.clearMTLSPrivateKeyPassword}
                      onChange={(e) => setForm((current) => ({ ...current, clearMTLSPrivateKeyPassword: e.target.checked }))}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    Clear stored private key password
                  </label>
                )}
                {(hasExistingMTLS || isReplacingMTLSFiles) && (
                  <button
                    type="button"
                    onClick={() => {
                      setCertificateFile(null)
                      setPrivateKeyFile(null)
                      setForm((current) => ({
                        ...current,
                        clearMTLS: Boolean(existingMTLS),
                        mtlsPrivateKeyPassword: '',
                        clearMTLSPrivateKeyPassword: false,
                      }))
                    }}
                    className="inline-flex items-center gap-2 self-start rounded-lg border border-red-200 px-3 py-2 text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-900/10"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove mTLS
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-gray-100 px-6 py-4 dark:border-slate-800">
            <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Properties</h2>
          </div>
          <div className="space-y-2 p-6">
            {form.rows.map((row, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={row.key}
                  onChange={(e) => setRow(idx, 'key', e.target.value)}
                  placeholder="key"
                  className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-mono text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
                />
                <span className="shrink-0 text-sm text-gray-400">=</span>
                <input
                  type="text"
                  value={row.value}
                  onChange={(e) => setRow(idx, 'value', e.target.value)}
                  placeholder="value"
                  className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-mono text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
                />
                {idx < form.rows.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => removeRow(idx)}
                    className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-500 dark:hover:bg-slate-700"
                    title="Remove"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : (
                  <span className="w-6 shrink-0" />
                )}
              </div>
            ))}
            <p className="mt-1.5 text-xs text-gray-400 dark:text-slate-500">
              Each property is passed as a <code className="rounded bg-gray-100 px-1 dark:bg-slate-800">-Dkey=value</code> JVM flag and exposed in <code className="rounded bg-gray-100 px-1 dark:bg-slate-800">karate-config.js</code>.
            </p>
          </div>
        </section>

        <div className="flex justify-end gap-3">
          <Link
            to="/environments"
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            {isEditing ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Environment'}
          </button>
        </div>
      </form>
    </div>
  )
}
