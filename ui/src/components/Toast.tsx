import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { CheckCircle, Info, XCircle, X } from 'lucide-react'

type ToastKind = 'success' | 'error' | 'info'

interface ToastMessage {
  id: number
  message: string
  kind: ToastKind
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

const DURATION = 3500

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const counter = useRef(0)

  const toast = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = ++counter.current
    setToasts((prev) => [...prev, { id, message, kind }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), DURATION)
  }, [])

  const dismiss = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id))

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-50 flex flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast: t, onDismiss }: { toast: ToastMessage; onDismiss: (id: number) => void }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Trigger enter animation on next frame
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  const icon = {
    success: <CheckCircle className="h-4 w-4 text-green-500" />,
    error:   <XCircle className="h-4 w-4 text-red-500" />,
    info:    <Info className="h-4 w-4 text-blue-500" />,
  }[t.kind]

  const border = {
    success: 'border-green-200 dark:border-green-800',
    error:   'border-red-200 dark:border-red-800',
    info:    'border-blue-200 dark:border-blue-800',
  }[t.kind]

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 rounded-xl border bg-white px-4 py-3 shadow-lg transition-all duration-300 dark:bg-slate-900 ${border} ${
        visible ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'
      }`}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <p className="text-sm text-gray-800 dark:text-slate-100">{t.message}</p>
      <button
        onClick={() => onDismiss(t.id)}
        className="ml-2 shrink-0 text-gray-400 transition-colors hover:text-gray-700 dark:text-slate-500 dark:hover:text-slate-200"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
