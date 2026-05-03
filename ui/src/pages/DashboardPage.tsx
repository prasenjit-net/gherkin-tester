import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock,
  FolderKanban,
  ListOrdered,
  TestTube2,
  XCircle,
} from 'lucide-react'
import { healthApi, statsApi } from '../services/api'
import type { TestResult } from '../types'

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'passed') return <CheckCircle2 className="h-4 w-4 text-green-500" />
  if (status === 'failed') return <XCircle className="h-4 w-4 text-red-500" />
  return <AlertCircle className="h-4 w-4 text-amber-500" />
}

function ExecutionRow({ exec }: { exec: TestResult }) {
  const historyLink =
    exec.projectId && exec.testId
      ? `/projects/${exec.projectId}/features/${exec.testId}/history`
      : `/queue`

  return (
    <Link
      to={historyLink}
      className="flex items-center gap-4 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 transition-colors hover:border-indigo-200 hover:bg-indigo-50 dark:border-slate-800 dark:bg-slate-800/50 dark:hover:border-indigo-700 dark:hover:bg-indigo-900/20"
    >
      <StatusIcon status={exec.status} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900 dark:text-slate-100">
          {exec.testName || exec.testId}
        </p>
        <p className="text-xs text-gray-500 dark:text-slate-400">
          {exec.scenarios} scenarios · {exec.passed} passed
          {exec.failed > 0 && ` · ${exec.failed} failed`}
          {exec.message && ` · ${exec.message}`}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-slate-500">
          <Clock className="h-3 w-3" />
          {formatDuration(exec.duration)}
        </span>
        <span className="text-xs text-gray-400 dark:text-slate-500">{timeAgo(exec.startedAt)}</span>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 dark:text-slate-600" />
    </Link>
  )
}

export default function DashboardPage() {
  const healthQuery = useQuery({ queryKey: ['health'], queryFn: healthApi.get, refetchInterval: 15_000 })
  const statsQuery = useQuery({ queryKey: ['stats'], queryFn: statsApi.get, refetchInterval: 15_000 })

  if (healthQuery.isLoading || statsQuery.isLoading) {
    return (
      <div className="space-y-8 p-8 animate-pulse">
        <div className="h-8 w-48 rounded bg-gray-200 dark:bg-slate-800" />
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-gray-200 dark:bg-slate-800" />
          ))}
        </div>
        <div className="h-64 rounded-xl bg-gray-200 dark:bg-slate-800" />
      </div>
    )
  }

  const health = healthQuery.data
  const stats = statsQuery.data

  const passRate =
    stats && stats.totalExecutions > 0
      ? Math.round((stats.passedCount / stats.totalExecutions) * 100)
      : null

  const statCards = [
    {
      label: 'Projects',
      value: stats?.projectCount ?? 0,
      icon: FolderKanban,
      tone: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-300',
      link: '/projects',
    },
    {
      label: 'Tests',
      value: stats?.testCount ?? 0,
      icon: TestTube2,
      tone: 'bg-sky-50 text-sky-600 dark:bg-sky-900/20 dark:text-sky-300',
      link: '/projects',
    },
    {
      label: 'Executions',
      value: stats?.totalExecutions ?? 0,
      icon: ListOrdered,
      tone: 'bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-300',
      link: '/queue',
    },
    {
      label: passRate !== null ? 'Pass rate' : 'Server',
      value: passRate !== null ? `${passRate}%` : (health?.status ?? '—'),
      icon: Activity,
      tone:
        passRate === null
          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300'
          : passRate >= 80
          ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-300'
          : passRate >= 50
          ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-300'
          : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-300',
      link: '/queue',
    },
  ]

  return (
    <div className="space-y-8 p-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
          Overview of your Karate test projects and recent execution results.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {statCards.map((card) => (
          <Link
            key={card.label}
            to={card.link}
            className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.tone}`}>
              <card.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{card.value}</p>
              <p className="text-sm text-gray-500 dark:text-slate-400">{card.label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Execution breakdown bar */}
      {stats && stats.totalExecutions > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Execution breakdown</h2>
            <span className="text-xs text-gray-400 dark:text-slate-500">{stats.totalExecutions} total</span>
          </div>
          <div className="flex h-3 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-800">
            {stats.passedCount > 0 && (
              <div
                className="bg-green-500"
                style={{ width: `${(stats.passedCount / stats.totalExecutions) * 100}%` }}
              />
            )}
            {stats.failedCount > 0 && (
              <div
                className="bg-red-500"
                style={{ width: `${(stats.failedCount / stats.totalExecutions) * 100}%` }}
              />
            )}
            {stats.errorCount > 0 && (
              <div
                className="bg-amber-400"
                style={{ width: `${(stats.errorCount / stats.totalExecutions) * 100}%` }}
              />
            )}
          </div>
          <div className="mt-2 flex gap-4 text-xs text-gray-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-green-500" /> {stats.passedCount} passed
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-500" /> {stats.failedCount} failed
            </span>
            {stats.errorCount > 0 && (
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-400" /> {stats.errorCount} error
              </span>
            )}
          </div>
        </div>
      )}

      {/* Recent executions */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Recent executions</h2>
          <Link
            to="/queue"
            className="flex items-center gap-1 text-sm text-indigo-600 hover:underline dark:text-indigo-400"
          >
            View all <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {!stats || stats.recentExecutions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <TestTube2 className="h-8 w-8 text-gray-300 dark:text-slate-600" />
            <p className="text-sm text-gray-500 dark:text-slate-400">
              No executions yet. Run a test to see results here.
            </p>
            <Link
              to="/projects"
              className="mt-1 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Go to Projects →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {stats.recentExecutions.map((exec) => (
              <ExecutionRow key={exec.id} exec={exec} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
