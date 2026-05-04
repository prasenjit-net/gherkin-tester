import { useEffect, useState } from 'react'
import { Download, Plus, Save, Trash2 } from 'lucide-react'
import SectionHeader from '../components/SectionHeader'
import { configApi, karateApi, metaApi } from '../services/api'
import { useEventBus } from '../context/EventBusContext'
import type { AppConfig, KarateVersion } from '../types'

export default function SettingsPage() {
  // ── App config ──────────────────────────────────────────────────────────────
  const [cfg, setCfg] = useState<AppConfig | null>(null)
  const [cfgForm, setCfgForm] = useState<AppConfig | null>(null)
  const [savingCfg, setSavingCfg] = useState(false)
  const [cfgSaved, setCfgSaved] = useState(false)
  const [cfgError, setCfgError] = useState<string | null>(null)
  const [aiApiKey, setAiApiKey] = useState('')
  const [clearAiApiKey, setClearAiApiKey] = useState(false)

  // ── App meta ─────────────────────────────────────────────────────────────────
  const [meta, setMeta] = useState<Awaited<ReturnType<typeof metaApi.get>> | null>(null)

  // ── Karate versions ──────────────────────────────────────────────────────────
  const [versions, setVersions] = useState<KarateVersion[]>([])
  const [releases, setReleases] = useState<string[]>([])
  const [selectedRelease, setSelectedRelease] = useState('')
  const [loadingReleases, setLoadingReleases] = useState(false)
  const [adding, setAdding] = useState(false)
  // true = downloaded, false = downloading, undefined = unknown
  const [statusMap, setStatusMap] = useState<Record<string, boolean | undefined>>({})
  const [karateError, setKarateError] = useState<string | null>(null)

  // ── Global event bus ──────────────────────────────────────────────────────────
  const { on } = useEventBus()

  useEffect(() => {
    metaApi.get().then(setMeta).catch(() => {})
    loadVersions()
    configApi.get().then((c) => {
      setCfg(c)
      setCfgForm(c)
      setAiApiKey('')
      setClearAiApiKey(false)
    }).catch(() => {})
  }, [])

  // Listen for karate download events to update status badges in real-time.
  useEffect(() => on<{ version: string }>('karate.download.started', (e) => {
    setStatusMap((m) => ({ ...m, [e.payload.version]: false }))
  }), [on])
  useEffect(() => on<{ version: string }>('karate.download.complete', (e) => {
    setStatusMap((m) => ({ ...m, [e.payload.version]: true }))
  }), [on])
  useEffect(() => on<{ version: string }>('karate.download.error', (e) => {
    setStatusMap((m) => { const next = { ...m }; delete next[e.payload.version]; return next })
    setKarateError(`Download failed for ${e.payload.version}`)
  }), [on])
  useEffect(() => on<{ version: string }>('karate.version.removed', (e) => {
    setVersions((vs) => vs.filter((v) => v.version !== e.payload.version))
    setStatusMap((m) => { const next = { ...m }; delete next[e.payload.version]; return next })
  }), [on])

  // ── Config handlers ──────────────────────────────────────────────────────────
  const handleCfgChange = (field: keyof AppConfig, value: string | number) => {
    setCfgForm((f) => f ? { ...f, [field]: value } : f)
  }

  const handleSaveCfg = async () => {
    if (!cfgForm) return
    setSavingCfg(true)
    setCfgError(null)
    try {
      const nextAIKey = aiApiKey.trim()
      const res = await configApi.update({
        appName: cfgForm.appName,
        appDescription: cfgForm.appDescription,
        appURL: cfgForm.appURL,
        appEnv: cfgForm.appEnv,
        serverPort: cfgForm.serverPort,
        logLevel: cfgForm.logLevel,
        logFormat: cfgForm.logFormat,
        dataDir: cfgForm.dataDir,
        maxExecutors: cfgForm.maxExecutors,
        aiProvider: cfgForm.aiProvider,
        aiModel: cfgForm.aiModel,
        aiBaseURL: cfgForm.aiBaseURL,
        aiApiKey: nextAIKey || undefined,
        clearAiApiKey: clearAiApiKey && nextAIKey === '',
      })
      const nextCfg = {
        ...cfgForm,
        configFile: res.configFile,
        hasAiApiKey: nextAIKey !== '' ? true : clearAiApiKey ? false : cfgForm.hasAiApiKey,
      }
      setCfg(nextCfg)
      setCfgForm(nextCfg)
      setAiApiKey('')
      setClearAiApiKey(false)
      setCfgSaved(true)
      setTimeout(() => setCfgSaved(false), 2500)
    } catch (e) {
      setCfgError(e instanceof Error ? e.message : 'Failed to save settings')
    } finally {
      setSavingCfg(false)
    }
  }

  const handleReload = () => {
    if (cfgForm && cfgForm.serverPort !== cfg?.serverPort) {
      // Port changed — redirect to the new origin so the reload lands on the right port.
      const { protocol, hostname, pathname } = window.location
      window.location.href = `${protocol}//${hostname}:${cfgForm.serverPort}${pathname}`
    } else {
      window.location.reload()
    }
  }

  // ── Karate handlers ──────────────────────────────────────────────────────────
  const loadVersions = async () => {
    try {
      const vs = await karateApi.listVersions()
      setVersions(vs)
      vs.forEach(async (v) => {
        try {
          const s = await karateApi.versionStatus(v.version)
          setStatusMap((m) => ({ ...m, [v.version]: s.downloaded }))
        } catch {
          return undefined
        }
      })
    } catch (e) {
      setKarateError(e instanceof Error ? e.message : 'Failed to load versions')
    }
  }

  const loadReleases = async () => {
    setLoadingReleases(true)
    setKarateError(null)
    try {
      const rs = await karateApi.fetchReleases()
      setReleases(rs)
      if (rs.length > 0) setSelectedRelease(rs[0])
    } catch (e) {
      setKarateError(e instanceof Error ? e.message : 'Failed to fetch GitHub releases')
    } finally {
      setLoadingReleases(false)
    }
  }

  const handleAddVersion = async () => {
    if (!selectedRelease) return
    setAdding(true)
    setKarateError(null)
    try {
      await karateApi.addVersion(selectedRelease)
      await loadVersions()
    } catch (e) {
      setKarateError(e instanceof Error ? e.message : 'Failed to add version')
    } finally {
      setAdding(false)
    }
  }

  const handleRemoveVersion = async (version: string) => {
    if (!confirm(`Remove Karate ${version}? The JAR file on disk will not be deleted.`)) return
    try {
      await karateApi.removeVersion(version)
      loadVersions()
    } catch (e) {
      setKarateError(e instanceof Error ? e.message : 'Failed to remove version')
    }
  }

  // ── Shared styles ────────────────────────────────────────────────────────────
  const inputCls = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
  const selectCls = 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
  const labelCls = 'block text-xs font-medium text-gray-500 mb-1 dark:text-slate-400'

  return (
    <div className="space-y-8 p-8">
      <SectionHeader title="Settings" description="Manage application configuration and Karate versions." />

      {/* ── App Settings ────────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-1 text-base font-semibold text-gray-900 dark:text-slate-100">App Settings</h2>
        <p className="mb-4 text-sm text-gray-500 dark:text-slate-400">
          These values are written to{' '}
          <code className="rounded bg-gray-100 px-1 text-xs dark:bg-slate-800">
            {cfg?.configFile || 'config.yaml'}
          </code>
          . A restart is required for most changes to take effect.
        </p>

        {cfgError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">
            {cfgError}
          </div>
        )}

        {cfgForm ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>App Name</label>
                <input className={inputCls} value={cfgForm.appName}
                  onChange={(e) => handleCfgChange('appName', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>App URL</label>
                <input className={inputCls} value={cfgForm.appURL}
                  onChange={(e) => handleCfgChange('appURL', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Environment</label>
                <select className={inputCls} value={cfgForm.appEnv}
                  onChange={(e) => handleCfgChange('appEnv', e.target.value)}>
                  <option value="development">development</option>
                  <option value="production">production</option>
                  <option value="staging">staging</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Server Port</label>
                <input type="number" className={inputCls} value={cfgForm.serverPort}
                  onChange={(e) => handleCfgChange('serverPort', parseInt(e.target.value, 10) || 8080)} />
              </div>
              <div>
                <label className={labelCls}>Log Level</label>
                <select className={inputCls} value={cfgForm.logLevel}
                  onChange={(e) => handleCfgChange('logLevel', e.target.value)}>
                  <option value="debug">debug</option>
                  <option value="info">info</option>
                  <option value="warn">warn</option>
                  <option value="error">error</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Log Format</label>
                <select className={inputCls} value={cfgForm.logFormat}
                  onChange={(e) => handleCfgChange('logFormat', e.target.value)}>
                  <option value="text">text</option>
                  <option value="json">json</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Data Directory</label>
                <input className={inputCls} value={cfgForm.dataDir}
                  onChange={(e) => handleCfgChange('dataDir', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Max Executors</label>
                <input type="number" min={1} max={32} className={inputCls} value={cfgForm.maxExecutors}
                  onChange={(e) => handleCfgChange('maxExecutors', parseInt(e.target.value, 10) || 4)} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>App Description</label>
                <input className={inputCls} value={cfgForm.appDescription}
                  onChange={(e) => handleCfgChange('appDescription', e.target.value)} />
              </div>
            </div>

            <div className="mt-6 border-t border-gray-200 pt-6 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">AI Generation</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                Configure the OpenAI-compatible provider used for spec-based Gherkin generation. The API key is written to{' '}
                <code className="rounded bg-gray-100 px-1 text-xs dark:bg-slate-800">
                  {cfg?.configFile || 'config.yaml'}
                </code>
                .
              </p>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Provider</label>
                  <input
                    className={inputCls}
                    value={cfgForm.aiProvider}
                    onChange={(e) => handleCfgChange('aiProvider', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls}>Model</label>
                  <input
                    className={inputCls}
                    value={cfgForm.aiModel}
                    onChange={(e) => handleCfgChange('aiModel', e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Base URL</label>
                  <input
                    className={inputCls}
                    value={cfgForm.aiBaseURL}
                    onChange={(e) => handleCfgChange('aiBaseURL', e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>API Key</label>
                  <input
                    type="password"
                    className={inputCls}
                    value={aiApiKey}
                    placeholder={cfgForm.hasAiApiKey && !clearAiApiKey ? 'Saved API key configured' : 'sk-...'}
                    onChange={(e) => {
                      setAiApiKey(e.target.value)
                      if (e.target.value !== '') {
                        setClearAiApiKey(false)
                      }
                    }}
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                    {cfgForm.hasAiApiKey && !clearAiApiKey
                      ? 'Leave blank to keep the saved key unchanged, or paste a new one to replace it.'
                      : 'Add an API key to enable OpenAI-backed spec generation.'}
                  </p>
                </div>
              </div>

              {cfgForm.hasAiApiKey && (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setClearAiApiKey((value) => !value)
                      setAiApiKey('')
                    }}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    {clearAiApiKey ? 'Keep saved API key' : 'Remove saved API key'}
                  </button>
                  {clearAiApiKey && (
                    <span className="text-xs text-amber-700 dark:text-amber-300">
                      The saved API key will be removed when you save settings.
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                onClick={handleSaveCfg}
                disabled={savingCfg}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {savingCfg ? 'Saving…' : cfgSaved ? 'Saved ✓' : 'Save Settings'}
              </button>

              {cfgSaved && (
                <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-300">
                  <span>Restart the server for changes to take effect.</span>
                  <button
                    onClick={handleReload}
                    className="font-semibold underline underline-offset-2 hover:no-underline"
                  >
                    Reload page
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-400 dark:text-slate-500">Loading…</p>
        )}
      </section>

      {/* ── Karate Versions ─────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-1 text-base font-semibold text-gray-900 dark:text-slate-100">Karate Versions</h2>
        <p className="mb-4 text-sm text-gray-500 dark:text-slate-400">
          Add Karate versions here. JARs are downloaded automatically to{' '}
          <code className="rounded bg-gray-100 px-1 text-xs dark:bg-slate-800">data/bin/</code>.
        </p>

        {karateError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">
            {karateError}
          </div>
        )}

        {versions.length === 0 ? (
          <p className="mb-4 text-sm text-gray-400 dark:text-slate-500">No versions configured yet.</p>
        ) : (
          <div className="mb-4 space-y-2">
            {versions.map((v) => (
              <div key={v.version} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-medium text-gray-900 dark:text-slate-100">{v.version}</span>
                  {statusMap[v.version] === true && (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
                      Downloaded
                    </span>
                  )}
                  {statusMap[v.version] === false && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">
                      <Download className="h-3 w-3" /> Downloading…
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleRemoveVersion(v.version)}
                  className="rounded-lg border border-red-200 p-1.5 text-red-500 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                  title="Remove version"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-end gap-2">
          {releases.length === 0 ? (
            <button
              onClick={loadReleases}
              disabled={loadingReleases}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              {loadingReleases ? 'Loading…' : 'Load available releases'}
            </button>
          ) : (
            <>
              <select value={selectedRelease} onChange={(e) => setSelectedRelease(e.target.value)} className={selectCls}>
                <option value="">Select a version…</option>
                {releases.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <button
                onClick={handleAddVersion}
                disabled={!selectedRelease || adding}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {adding ? 'Adding…' : 'Add Version'}
              </button>
            </>
          )}
        </div>
      </section>

      {/* ── App metadata ────────────────────────────────────────────────────── */}
      {meta && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Application</h2>
            <dl className="mt-4 space-y-3 text-sm">
              {([['Name', meta.name], ['Environment', meta.environment], ['URL', meta.url]] as [string, string][]).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4 border-b border-gray-100 pb-3 last:border-0 last:pb-0 dark:border-slate-800">
                  <dt className="text-gray-500 dark:text-slate-400">{k}</dt>
                  <dd className="font-medium text-gray-900 dark:text-slate-100">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Build</h2>
            <dl className="mt-4 space-y-3 text-sm">
              {([['Version', meta.version.version], ['Commit', meta.version.commit], ['Build date', meta.version.buildDate]] as [string, string][]).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4 border-b border-gray-100 pb-3 last:border-0 last:pb-0 dark:border-slate-800">
                  <dt className="text-gray-500 dark:text-slate-400">{k}</dt>
                  <dd className="font-mono text-sm font-medium text-gray-900 dark:text-slate-100">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      )}
    </div>
  )
}
