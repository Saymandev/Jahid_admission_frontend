// Toast notification system
import { addToast } from './toast-internal'

export function showToast(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info', duration?: number) {
  addToast({ message, type, duration })
}
