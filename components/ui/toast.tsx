import { cn } from '@/lib/utils'
import * as React from 'react'

interface ToastProps {
  message: string
  type?: 'success' | 'error' | 'info' | 'warning'
  onClose?: () => void
}

export function Toast({ message, type = 'info', onClose }: ToastProps) {
  const bgColor = {
    success: 'bg-success/10 border-success text-success',
    error: 'bg-danger/10 border-danger text-danger',
    info: 'bg-primary/10 border-primary text-primary',
    warning: 'bg-warning/10 border-warning text-warning',
  }[type]

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-50 p-4 rounded-md border shadow-lg max-w-md',
        bgColor
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-medium">{message}</p>
        {onClose && (
          <button
            onClick={onClose}
            className="text-current opacity-70 hover:opacity-100"
          >
            ×
          </button>
        )}
      </div>
    </div>
  )
}
