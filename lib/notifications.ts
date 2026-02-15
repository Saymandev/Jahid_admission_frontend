export type NotificationType = 'payment' | 'due' | 'student' | 'room' | 'coaching' | 'system' | 'login' | 'logout'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  link?: string
  timestamp: Date
  read?: boolean
}

const STORAGE_KEY = 'notifications'

export const getNotifications = (): Notification[] => {
  if (typeof window === 'undefined') return []
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return []
  try {
    const notifications = JSON.parse(stored)
    return notifications.map((n: any) => ({
      ...n,
      timestamp: new Date(n.timestamp),
    }))
  } catch {
    return []
  }
}

export const saveNotifications = (notifications: Notification[]) => {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications))
  } catch (error) {
    console.error('Failed to save notifications:', error)
  }
}

export const addNotification = (notification: Omit<Notification, 'read'>) => {
  const notifications = getNotifications()
  // Check if notification already exists (avoid duplicates)
  if (notifications.some((n) => n.id === notification.id)) {
    return notifications
  }
  const newNotification: Notification = {
    ...notification,
    read: false,
  }
  const updated = [newNotification, ...notifications].slice(0, 100) // Keep last 100
  saveNotifications(updated)
  // Dispatch custom event for same-tab updates
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('notification-updated'))
  }
  return updated
}

export const markAsRead = (id: string) => {
  const notifications = getNotifications()
  const updated = notifications.map((n) =>
    n.id === id ? { ...n, read: true } : n
  )
  saveNotifications(updated)
  // Dispatch custom event for same-tab updates
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('notification-updated'))
  }
  return updated
}

export const markAllAsRead = () => {
  const notifications = getNotifications()
  const updated = notifications.map((n) => ({ ...n, read: true }))
  saveNotifications(updated)
  // Dispatch custom event for same-tab updates
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('notification-updated'))
  }
  return updated
}

export const deleteNotification = (id: string) => {
  const notifications = getNotifications()
  const updated = notifications.filter((n) => n.id !== id)
  saveNotifications(updated)
  // Dispatch custom event for same-tab updates
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('notification-updated'))
  }
  return updated
}

export const clearAllNotifications = () => {
  saveNotifications([])
  return []
}

export const getUnreadCount = (): number => {
  const notifications = getNotifications()
  return notifications.filter((n) => !n.read).length
}
