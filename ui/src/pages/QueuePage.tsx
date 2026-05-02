import { useEffect, useRef, useState } from 'react'
import { CheckCircle, ChevronDown, ChevronUp, Clock, ListOrdered, Loader2, PlayCircle, Trash2, XCircle } from 'lucide-react'
import { queueApi } from '../services/api'
import type { QueueItem } from '../types'

function statusIcon(status: QueueItem['status']) {
  switch (status) {
    case 'queued':   return <Clock className="w-4 h-4 text-slate-400" />
    case 'running':  return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
    case 'passed':   return <CheckCircle className="w-4 h-4 text-green-500" />
    case 'failed':   return <XCircle className="w-4 h-4 text-red-500" />
    case 'error':    return <XCircle className="w-4 h-4 text-orange-500" />
  }
}

function statusBadge(status: QueueItem['status']) {
  const base = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium'
  switch (status) {
    case 'queued':  return <span className={`${base} bg-slate-100 text-slate-600`}>{statusIcon(status)} Queued</span>
    case 'running': return <span className={`${base} bg-blue-50 text-blue-700`}>{statusIcon(status)} Running</span>
    case 'passed':  return <span className={`${base} bg-green-50 text-green-700`}>{statusIcon(status)} Passed</span>
    case 'failed':  return <span className={`${base} bg-red-50 text-red-700`}>{statusIcon(status)} Failed</span>
    case 'error':   return <span className={`${base} bg-orange-50 text-orange-700`}>{statusIcon(status)} Error</span>
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

  // Auto-expand when item finishes
  const prevStatus = useRef(item.status)
  useEffect(() => {
    if (prevStatus.current === 'running' && isDone) setExpanded(true)
    prevStatus.current = item.status
  }, [item.status, isDone])

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-4 p-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {statusBadge(item.status)}
            <span className="font-medium text-slate-800 truncate">{item.testName || item.testId}</span>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-slate-400">
            <span>#{item.id}</span>
            {item.startedAt && <span>⏱ {elapsed(item, tick)}</span>}
            {(item.scenarios ?? 0) > 0 && (
              <span className={item.failed ? 'text-red-500 font-medium' : 'text-green-600 font-medium'}>
                {item.passed}/{item.scenarios} scenarios{item.failed ? ` · ${item.failed} failed` : ' passed'}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {item.status === 'queued' && (
            <button
              onClick={() => queueApi.cancel(item.id).catch(() => {})}
              className="text-slate-400 hover:text-red-500 transition-colors"
              title="Cancel"
            >
              <XCircle className="w-5 h-5" />
            </button>
          )}
          {isDone && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-slate-400 hover:text-slate-700 transition-colors"
              title={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          )}
        </div>
      </div>

      {/* Expanded detail panel */}
      {expanded && isDone && (
        <div className="border-t border-slate-100 bg-slate-50 p-4 space-y-4">
          {/* Stats grid */}
          {(item.scenarios ?? 0) > 0 && (
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Duration', value: item.duration ? `${item.duration}ms` : '—', color: 'text-slate-700' },
                { label: 'Scenarios', value: item.scenarios ?? 0, color: 'text-slate-700' },
                { label: 'Passed', value: item.passed ?? 0, color: 'text-green-700' },
                { label: 'Failed', value: item.failed ?? 0, color: item.failed ? 'text-red-700 font-bold' : 'text-slate-400' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white rounded-lg p-3 border border-slate-100 text-center">
                  <p className="text-xs text-slate-400 mb-0.5">{label}</p>
                  <p className={`text-lg font-semibold ${color}`}>{value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Message */}
          {item.message && (
            <div className={`p-3 rounded-lg border text-sm ${
              item.status === 'passed'
                ? 'bg-green-50 border-green-200 text-green-800'
                : item.status === 'failed'
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : 'bg-orange-50 border-orange-200 text-orange-800'
            }`}>
              {item.message}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function QueuePage() {
  const [items, setItems] = useState<QueueItem[]>([])
  const [connected, setConnected] = useState(false)
  const [tick, setTick] = useState(0)
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    const es = new EventSource(queueApi.streamURL())
    esRef.current = es

    es.onopen = () => setConnected(true)
    es.onerror = () => setConnected(false)

    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as
          | { type: 'snapshot'; items: QueueItem[] }
          | { type: 'update'; item: QueueItem }

        if (msg.type === 'snapshot') {
          setItems(msg.items)
        } else if (msg.type === 'update') {
          setItems((prev) => {
            const idx = prev.findIndex((x) => x.id === msg.item.id)
            if (idx === -1) return [...prev, msg.item]
            const next = [...prev]
            next[idx] = msg.item
            return next
          })
        }
      } catch { /* ignore */ }
    }

    return () => {
      es.close()
      setConnected(false)
    }
  }, [])

  // Live elapsed ticker for running items
  useEffect(() => {
    const hasRunning = items.some((i) => i.status === 'running')
    if (!hasRunning) return
    const timer = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(timer)
  }, [items])

  const hasCompleted = items.some((i) => !['queued', 'running'].includes(i.status))

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ListOrdered className="w-7 h-7 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Execution Queue</h1>
            <p className="text-sm text-slate-500">Live test run status — results appear automatically</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className={`flex items-center gap-1.5 text-xs font-medium ${connected ? 'text-green-600' : 'text-slate-400'}`}>
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`} />
            {connected ? 'Live' : 'Disconnected'}
          </span>

          {hasCompleted && (
            <button
              onClick={() => queueApi.clearCompleted().catch(() => {})}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:text-red-600 border border-slate-200 rounded-lg hover:border-red-200 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Clear completed
            </button>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <PlayCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Queue is empty. Use the <strong>Queue</strong> button on any feature to run it.</p>
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
