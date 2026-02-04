'use client'

import { removeToast, subscribeToToasts, type Toast } from '@/lib/toast-internal'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'

export function Toaster() {
  const [currentToasts, setCurrentToasts] = useState<Toast[]>([])

  useEffect(() => {
    const unsubscribe = subscribeToToasts((newToasts) => {
      setCurrentToasts(newToasts)
    })

    return unsubscribe
  }, [])

  if (currentToasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-md pointer-events-none px-4 md:px-0">
      {currentToasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const bgColor = {
    success: 'bg-success/95 border-success text-success-foreground',
    error: 'bg-danger/95 border-danger text-danger-foreground',
    info: 'bg-primary/95 border-primary text-primary-foreground',
    warning: 'bg-warning/95 border-warning text-warning-foreground',
  }[toast.type]

  const icon = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '⚠',
  }[toast.type]

  return (
    <div
      className={cn(
        'p-4 rounded-lg border shadow-lg pointer-events-auto animate-in slide-in-from-bottom-5 fade-in',
        bgColor
      )}
    >
      <div className="flex items-start gap-3">
        <span className="text-lg font-bold">{icon}</span>
        <div className="flex-1">
          <p className="text-sm font-medium">{toast.message}</p>
        </div>
        <button
          onClick={onClose}
          className="text-current opacity-70 hover:opacity-100 transition-opacity text-lg leading-none"
          aria-label="Close"
        >
          ×
        </button>
      </div>
    </div>
  )
}
