// Internal toast management
export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
  duration?: number
}

let toastListeners: ((toasts: Toast[]) => void)[] = []
let toasts: Toast[] = []

export const addToast = (toast: Omit<Toast, 'id'>) => {
  const id = Math.random().toString(36).substring(7)
  const newToast = { ...toast, id }
  toasts = [...toasts, newToast]
  toastListeners.forEach((listener) => listener([...toasts]))

  // Auto remove
  const duration = toast.duration || 5000
  setTimeout(() => {
    removeToast(id)
  }, duration)
}

export const removeToast = (id: string) => {
  toasts = toasts.filter((t) => t.id !== id)
  toastListeners.forEach((listener) => listener([...toasts]))
}

export const subscribeToToasts = (listener: (toasts: Toast[]) => void) => {
  toastListeners.push(listener)
  listener([...toasts])
  return () => {
    toastListeners = toastListeners.filter((l) => l !== listener)
  }
}
