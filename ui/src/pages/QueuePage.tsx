import { useEffect, useRef, useState } from 'react'
import { CheckCircle, Clock, ListOrdered, Loader2, PlayCircle, Trash2, XCircle } from 'lucide-react'
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

function elapsed(item: QueueItem): string {
  if (!item.startedAt) return ''
  const start = new Date(item.startedAt).getTime()
  const end = item.endedAt ? new Date(item.endedAt).getTime() : Date.now()
  const ms = end - start
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
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
      } catch {
        // ignore parse errors
      }
    }

    return () => {
      es.close()
      setConnected(false)
    }
  }, [])

  // Ticker to refresh elapsed time for running items
  useEffect(() => {
    const hasRunning = items.some((i) => i.status === 'running')
    if (!hasRunning) return
    const timer = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(timer)
  }, [items])

  void tick // used only to trigger re-render for live elapsed

  async function handleCancel(id: string) {
    try { await queueApi.cancel(id) } catch { /* server will broadcast update */ }
  }

  async function handleClear() {
    try { await queueApi.clearCompleted() } catch { /* server will broadcast snapshot */ }
  }

  const hasCompleted = items.some((i) => !['queued', 'running'].includes(i.status))

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ListOrdered className="w-7 h-7 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Execution Queue</h1>
            <p className="text-sm text-slate-500">Live test run status</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className={`flex items-center gap-1.5 text-xs font-medium ${connected ? 'text-green-600' : 'text-slate-400'}`}>
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`} />
            {connected ? 'Live' : 'Disconnected'}
          </span>

          {hasCompleted && (
            <button
              onClick={handleClear}
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
          <p className="text-sm">No items in the queue. Run a test from a project feature to add one.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-100 shadow-sm"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {statusBadge(item.status)}
                  <span className="font-medium text-slate-800 truncate">{item.testName || item.testId}</span>
                </div>
                <div className="flex gap-4 text-xs text-slate-400">
                  <span>#{item.id}</span>
                  {item.startedAt && <span>⏱ {elapsed(item)}</span>}
                  {item.scenarios != null && item.scenarios > 0 && (
                    <span>
                      {item.passed}/{item.scenarios} scenarios
                      {item.failed ? ` · ${item.failed} failed` : ''}
                    </span>
                  )}
                  {item.message && <span className="truncate max-w-xs" title={item.message}>{item.message}</span>}
                </div>
              </div>

              {item.status === 'queued' && (
                <button
                  onClick={() => handleCancel(item.id)}
                  className="text-slate-400 hover:text-red-500 transition-colors"
                  title="Cancel"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
