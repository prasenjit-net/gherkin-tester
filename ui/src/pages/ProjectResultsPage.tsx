import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { CheckCircle, ChevronRight, Clock, XCircle } from 'lucide-react'
import SectionHeader from '../components/SectionHeader'
import { projectApi } from '../services/api'
import type { TestResult } from '../types'

function StatusBadge({ status }: { status: string }) {
  const base = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium'
  if (status === 'passed') return (
    <span className={`${base} bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300`}>
      <CheckCircle className="h-3.5 w-3.5" /> Passed
    </span>
  )
  if (status === 'failed') return (
    <span className={`${base} bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300`}>
      <XCircle className="h-3.5 w-3.5" /> Failed
    </span>
  )
  return (
    <span className={`${base} bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300`}>
      <Clock className="h-3.5 w-3.5" /> {status}
    </span>
  )
}

export default function ProjectResultsPage() {
  const { projectID, testID } = useParams<{ projectID: string; testID: string }>()
  const navigate = useNavigate()
  const [results, setResults] = useState<TestResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (projectID && testID) {
      projectApi.getTestHistory(projectID, testID)
        .then(setResults)
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load history'))
        .finally(() => setLoading(false))
    }
  }, [projectID, testID])

  if (loading) return <p className="p-8 text-sm text-gray-500 dark:text-slate-400">Loading…</p>

  return (
    <div className="space-y-8 p-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-slate-400">
        <Link to="/projects" className="transition-colors hover:text-blue-600 dark:hover:text-blue-400">Projects</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link to={`/projects/${projectID}/features`} className="transition-colors hover:text-blue-600 dark:hover:text-blue-400">{projectID}</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-gray-800 dark:text-slate-200">History</span>
      </nav>

      <div className="flex items-start justify-between gap-4">
        <SectionHeader title="Execution History" description="Past execution runs for this feature file." />
        <button
          onClick={() => navigate(`/projects/${projectID}/features`)}
          className="shrink-0 text-sm text-gray-500 transition-colors hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          ← Back
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">{error}</div>
      )}

      {results.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <Clock className="mx-auto mb-3 h-10 w-10 text-gray-300 dark:text-slate-700" />
          <p className="text-base font-medium text-gray-700 dark:text-slate-300">No executions yet</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">Queue the feature from the features list to run it.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {results.map((result) => (
            <section key={result.id} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-slate-500">Executed at</p>
                  <p className="mt-0.5 font-semibold text-gray-900 dark:text-slate-100">
                    {new Date(result.startedAt).toLocaleString()}
                  </p>
                </div>
                <StatusBadge status={result.status} />
              </div>

              <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  { label: 'Duration', value: `${result.duration}ms`, color: 'text-gray-900 dark:text-slate-100' },
                  { label: 'Scenarios', value: result.scenarios, color: 'text-gray-900 dark:text-slate-100' },
                  { label: 'Passed', value: result.passed, color: 'text-green-700 dark:text-green-400' },
                  { label: 'Failed', value: result.failed, color: result.failed ? 'text-red-700 dark:text-red-400 font-bold' : 'text-gray-400 dark:text-slate-500' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-lg border border-gray-100 p-3 text-center dark:border-slate-800">
                    <p className="text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wide">{label}</p>
                    <p className={`mt-0.5 text-lg font-semibold ${color}`}>{value}</p>
                  </div>
                ))}
              </dl>

              {result.message && (
                <p className={`mt-4 rounded-lg border p-3 text-sm ${
                  result.status === 'passed'
                    ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-800/50 dark:bg-green-900/20 dark:text-green-300'
                    : result.status === 'failed'
                      ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300'
                      : 'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800/50 dark:bg-orange-900/20 dark:text-orange-300'
                }`}>
                  {result.message}
                </p>
              )}

              {result.output && (
                <details className="mt-4">
                  <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100">
                    Execution Output
                  </summary>
                  <pre className="mt-2 max-h-80 overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-green-300 whitespace-pre-wrap break-words">
                    {result.output}
                  </pre>
                </details>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
