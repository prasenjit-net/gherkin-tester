import { useEffect, useState } from 'react'
import { Download, Plus, Trash2 } from 'lucide-react'
import SectionHeader from '../components/SectionHeader'
import { karateApi, metaApi } from '../services/api'
import type { KarateVersion } from '../types'

export default function SettingsPage() {
  const [meta, setMeta] = useState<Awaited<ReturnType<typeof metaApi.get>> | null>(null)
  const [versions, setVersions] = useState<KarateVersion[]>([])
  const [releases, setReleases] = useState<string[]>([])
  const [selectedRelease, setSelectedRelease] = useState('')
  const [loadingReleases, setLoadingReleases] = useState(false)
  const [adding, setAdding] = useState(false)
  const [statusMap, setStatusMap] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    metaApi.get().then(setMeta).catch(() => {})
    loadVersions()
  }, [])

  const loadVersions = async () => {
    try {
      const vs = await karateApi.listVersions()
      setVersions(vs)
      vs.forEach(async (v) => {
        try {
          const s = await karateApi.versionStatus(v.version)
          setStatusMap((m) => ({ ...m, [v.version]: s.downloaded }))
        } catch {}
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load versions')
    }
  }

  const loadReleases = async () => {
    setLoadingReleases(true)
    setError(null)
    try {
      const rs = await karateApi.fetchReleases()
      setReleases(rs)
      if (rs.length > 0) setSelectedRelease(rs[0])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch GitHub releases')
    } finally {
      setLoadingReleases(false)
    }
  }

  const handleAdd = async () => {
    if (!selectedRelease) return
    setAdding(true)
    setError(null)
    try {
      await karateApi.addVersion(selectedRelease)
      await loadVersions()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add version')
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (version: string) => {
    if (!confirm(`Remove Karate ${version}? The JAR file on disk will not be deleted.`)) return
    try {
      await karateApi.removeVersion(version)
      loadVersions()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove version')
    }
  }

  const selectCls = 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'

  return (
    <div className="space-y-8 p-8">
      <SectionHeader title="Settings" description="Manage Karate versions and view application metadata." />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Karate Versions */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-1 text-base font-semibold text-gray-900 dark:text-slate-100">Karate Versions</h2>
        <p className="mb-4 text-sm text-gray-500 dark:text-slate-400">
          Add Karate versions here. JARs are downloaded automatically to{' '}
          <code className="rounded bg-gray-100 px-1 text-xs dark:bg-slate-800">data/bin/</code>.
        </p>

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
                  onClick={() => handleRemove(v.version)}
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
                onClick={handleAdd}
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

      {/* App metadata */}
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
