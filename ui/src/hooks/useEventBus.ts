import { useEffect, useRef, useState } from 'react'

const STREAM_URL = (import.meta.env.VITE_API_BASE || '/api') + '/events/stream'

export interface BusEvent<T = unknown> {
  type: string
  payload: T
}

type Handler<T = unknown> = (event: BusEvent<T>) => void

/**
 * useEventBus subscribes to the global SSE stream.
 *
 * Returns { connected } and an `on(type, handler)` utility to register
 * per-event-type listeners. Listeners are deduplicated by reference and
 * cleaned up automatically on unmount.
 *
 * Usage:
 *   const { on, connected } = useEventBus()
 *   useEffect(() => on('queue.update', (e) => setItem(e.payload)), [on])
 */
export function useEventBus() {
  const [connected, setConnected] = useState(false)
  // Map from event type → set of handlers
  const listenersRef = useRef<Map<string, Set<Handler>>>(new Map())

  const on = <T>(type: string, handler: Handler<T>): () => void => {
    const map = listenersRef.current
    if (!map.has(type)) map.set(type, new Set())
    map.get(type)!.add(handler as Handler)
    return () => { map.get(type)?.delete(handler as Handler) }
  }

  useEffect(() => {
    const es = new EventSource(STREAM_URL)
    es.onopen = () => setConnected(true)
    es.onerror = () => setConnected(false)
    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as BusEvent
        const handlers = listenersRef.current.get(event.type)
        handlers?.forEach((h) => h(event))
      } catch { /* ignore */ }
    }
    return () => {
      es.close()
      setConnected(false)
    }
  }, [])

  return { connected, on }
}
