import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react'

export interface BusEvent<T = unknown> {
  type: string
  payload: T
}

type Handler<T = unknown> = (event: BusEvent<T>) => void

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

interface EventBusContextValue {
  status: ConnectionStatus
  on: <T>(type: string, handler: Handler<T>) => () => void
}

const EventBusContext = createContext<EventBusContextValue>({
  status: 'connecting',
  on: () => () => {},
})

function buildWsUrl(): string {
  const base = import.meta.env.VITE_API_BASE as string | undefined
  if (base && base.startsWith('http')) {
    return base.replace(/^http/, 'ws') + '/events/stream'
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const apiPath = base ?? '/api'
  return `${proto}//${window.location.host}${apiPath}/events/stream`
}

const WS_URL = buildWsUrl()
const MAX_RETRY_DELAY = 30_000

export function EventBusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const listenersRef = useRef<Map<string, Set<Handler>>>(new Map())
  const wsRef = useRef<WebSocket | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryDelayRef = useRef(1_000)
  const unmountedRef = useRef(false)

  const on = <T,>(type: string, handler: Handler<T>): () => void => {
    const map = listenersRef.current
    if (!map.has(type)) map.set(type, new Set())
    map.get(type)!.add(handler as Handler)
    return () => {
      map.get(type)?.delete(handler as Handler)
    }
  }

  useEffect(() => {
    unmountedRef.current = false

    const connect = () => {
      if (unmountedRef.current) return
      setStatus('connecting')

      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        setStatus('connected')
        retryDelayRef.current = 1_000
      }

      ws.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data as string) as BusEvent
          const handlers = listenersRef.current.get(event.type)
          handlers?.forEach((h) => h(event))
        } catch {
          /* ignore malformed frames */
        }
      }

      ws.onerror = () => {
        setStatus('disconnected')
      }

      ws.onclose = () => {
        setStatus('disconnected')
        wsRef.current = null
        if (!unmountedRef.current) {
          retryTimerRef.current = setTimeout(() => {
            retryDelayRef.current = Math.min(retryDelayRef.current * 2, MAX_RETRY_DELAY)
            connect()
          }, retryDelayRef.current)
        }
      }
    }

    connect()

    return () => {
      unmountedRef.current = true
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
      wsRef.current?.close()
    }
  }, [])

  return (
    <EventBusContext.Provider value={{ status, on }}>
      {children}
    </EventBusContext.Provider>
  )
}

/** Hook to subscribe to the shared WebSocket event bus. */
export function useEventBus() {
  return useContext(EventBusContext)
}
