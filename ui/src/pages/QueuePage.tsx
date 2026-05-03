import { useEffect, useRef, useState } from 'react'
import { CheckCircle, ChevronDown, ChevronUp, Clock, ListOrdered, Loader2, PlayCircle, Trash2, XCircle } from 'lucide-react'
import { queueApi } from '../services/api'
import { useEventBus } from '../context/EventBusContext'
import type { QueueItem } from '../types'

function statusBadge(status: QueueItem['status']) {
  const base = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium'
  switch (status) {
    case 'queued':  return <span className={`${base} bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300`}><Clock className="h-3.5 w-3.5" /> Queued</span>
    case 'running': return <span className={`${base} bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300`}><Loader2 className="h-3.5 w-3.5 animate-spin" /> Running</span>
    case 'passed':  return <span className={`${base} bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300`}><CheckCircle className="h-3.5 w-3.5" /> Passed</span>
    case 'failed':  return <span className={`${base} bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300`}><XCircle className="h-3.5 w-3.5" /> Failed</span>
    case 'error':   return <span className={`${base} bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300`}><XCircle className="h-3.5 w-3.5" /> Error</span>
  }
}

function elapsed(item: QueueItem, _tick: number): string {
  if (!item.startedAt) return '—'
  const start = new Date(item.startedAt).getTime()
  const end = item.endedAt ? new Date(item.endedAt).getTime() : Date.now()
  const ms = end - start
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

function ItemRow({ item, tick }: { item: QueueItem; tick: number }) {
  const [expanded, setExpanded] = useState(false)
  const isDone = !['queued', 'running'].includes(item.status)

  const prevStatus = useRef(item.status)
  useEffect(() => {
    if (prevStatus.current === 'running' && isDone) setExpanded(true)
    prevStatus.current = item.status
  }, [item.status, isDone])

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-4 p-4">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            {statusBadge(item.status)}
            <span className="truncate font-medium text-gray-900 dark:text-slate-100">{item.testName || item.testId}</span>
            {item.environmentId && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-medium">
                🌐 {item.environmentId}
              </span>
            )}
            {item.tags && item.tags.length > 0 && item.tags.map(tag => (
              <span key={tag} className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400 text-xs font-mono">
                @{tag.replace(/^@/, '')}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-gray-400 dark:text-slate-500">
            <span>#{item.id}</span>
            {item.startedAt && <span>⏱ {elapsed(item, tick)}</span>}
            {(item.scenarios ?? 0) > 0 && (
              <span className={item.failed ? 'font-medium text-red-500 dark:text-red-400' : 'font-medium text-green-600 dark:text-green-400'}>
                {item.passed}/{item.scenarios} scenarios{item.failed ? ` · ${item.failed} failed` : ' passed'}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {item.status === 'queued' && (
            <button
              onClick={() => queueApi.cancel(item.id).catch(() => {})}
              className="text-gray-400 transition-colors hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400"
              title="Cancel"
            >
              <XCircle className="h-5 w-5" />
            </button>
          )}
          {isDone && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-gray-400 transition-colors hover:text-gray-700 dark:text-slate-500 dark:hover:text-slate-200"
              title={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
          )}
        </div>
      </div>

      {expanded && isDone && (
        <div className="space-y-4 border-t border-gray-100 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
          {(item.scenarios ?? 0) > 0 && (
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Duration', value: item.duration ? `${item.duration}ms` : '—', color: 'text-gray-900 dark:text-slate-100' },
                { label: 'Scenarios', value: item.scenarios ?? 0, color: 'text-gray-900 dark:text-slate-100' },
                { label: 'Passed', value: item.passed ?? 0, color: 'text-green-700 dark:text-green-400' },
                { label: 'Failed', value: item.failed ?? 0, color: item.failed ? 'font-bold text-red-700 dark:text-red-400' : 'text-gray-400 dark:text-slate-500' },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-lg border border-gray-100 bg-white p-3 text-center dark:border-slate-700 dark:bg-slate-900">
                  <p className="text-xs uppercase tracking-wide text-gray-400 dark:text-slate-500">{label}</p>
                  <p className={`mt-0.5 text-lg font-semibold ${color}`}>{value}</p>
                </div>
              ))}
            </div>
          )}

          {item.message && (
            <div className={`rounded-lg border p-3 text-sm ${
              item.status === 'passed'
                ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-800/50 dark:bg-green-900/20 dark:text-green-300'
                : item.status === 'failed'
                  ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300'
                  : 'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800/50 dark:bg-orange-900/20 dark:text-orange-300'
            }`}>
              {item.message}
            </div>
          )}

          {item.output && (
            <details open>
              <summary className="mb-2 cursor-pointer select-none text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100">
                Execution Output
              </summary>
              <pre className="max-h-96 overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-green-300 whitespace-pre-wrap break-words">
                {item.output}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  )
}

export default function QueuePage() {
  const [items, setItems] = useState<QueueItem[]>([])
  const [tick, setTick] = useState(0)
  const { on } = useEventBus()

  // Fetch initial queue state, then keep in sync via SSE.
  useEffect(() => {
    queueApi.list().then(setItems).catch(() => {})
  }, [])

  useEffect(() => on<{ items: QueueItem[] }>('queue.snapshot', (e) => {
    setItems(e.payload.items)
  }), [on])

  useEffect(() => on<QueueItem>('queue.update', (e) => {
    setItems((prev) => {
      const idx = prev.findIndex((x) => x.id === e.payload.id)
      if (idx === -1) return [e.payload, ...prev]
      const next = [...prev]
      next[idx] = e.payload
      return next
    })
  }), [on])

  useEffect(() => {
    const hasRunning = items.some((i) => i.status === 'running')
    if (!hasRunning) return
    const timer = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(timer)
  }, [items])

  const hasCompleted = items.some((i) => !['queued', 'running'].includes(i.status))

  return (
    <div className="space-y-8 p-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <ListOrdered className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Execution Queue</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">Live test run status — results appear automatically</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {hasCompleted && (
            <button
              onClick={() => queueApi.clearCompleted().catch(() => {})}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:border-red-200 hover:text-red-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-red-800 dark:hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" /> Clear completed
            </button>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <PlayCircle className="mx-auto mb-3 h-12 w-12 text-gray-200 dark:text-slate-700" />
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Queue is empty. Use the <strong className="text-gray-700 dark:text-slate-300">Queue</strong> button on any feature to run it.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <ItemRow key={item.id} item={item} tick={tick} />
          ))}
        </div>
      )}
    </div>
  )
}
