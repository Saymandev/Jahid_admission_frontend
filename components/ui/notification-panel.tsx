'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
  getUnreadCount,
  type Notification,
} from '@/lib/notifications'
import { getSocket } from '@/lib/socket'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface NotificationPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function NotificationPanel({ isOpen, onClose }: NotificationPanelProps) {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    // Load notifications from storage
    const loadNotifications = () => {
      const stored = getNotifications()
      setNotifications(stored)
      setUnreadCount(getUnreadCount())
    }

    loadNotifications()

    // Listen for new notifications via socket
    const socket = getSocket()
    const handleNotification = (notification: Omit<Notification, 'read'>) => {
      const { addNotification: addNotif } = require('@/lib/notifications')
      const updated = addNotif(notification)
      setNotifications(updated)
      setUnreadCount(getUnreadCount())
    }

    socket.on('notification', handleNotification)

    return () => {
      socket.off('notification', handleNotification)
    }
  }, [])

  const handleMarkAsRead = (id: string) => {
    const updated = markAsRead(id)
    setNotifications(updated)
    setUnreadCount(getUnreadCount())
  }

  const handleMarkAllAsRead = () => {
    const updated = markAllAsRead()
    setNotifications(updated)
    setUnreadCount(0)
  }

  const handleDelete = (id: string) => {
    const updated = deleteNotification(id)
    setNotifications(updated)
    setUnreadCount(getUnreadCount())
  }

  const handleClearAll = () => {
    clearAllNotifications()
    setNotifications([])
    setUnreadCount(0)
  }

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      handleMarkAsRead(notification.id)
    }
    if (notification.link) {
      router.push(notification.link)
      onClose()
    }
  }

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'payment':
        return '💳'
      case 'due':
        return '⚠️'
      case 'student':
        return '👤'
      case 'room':
        return '🏠'
      case 'coaching':
        return '📚'
      case 'system':
        return '🔔'
      default:
        return '📢'
    }
  }

  const getNotificationColor = (type: Notification['type']) => {
    switch (type) {
      case 'payment':
        return 'bg-green-100 text-green-700 border-green-300'
      case 'due':
        return 'bg-red-100 text-red-700 border-red-300'
      case 'student':
        return 'bg-blue-100 text-blue-700 border-blue-300'
      case 'room':
        return 'bg-purple-100 text-purple-700 border-purple-300'
      case 'coaching':
        return 'bg-orange-100 text-orange-700 border-orange-300'
      case 'system':
        return 'bg-gray-100 text-gray-700 border-gray-300'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300'
    }
  }

  const formatTime = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString()
  }

  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40 lg:z-50"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-card border-l border-border shadow-xl z-50 overflow-hidden flex flex-col">
        <CardHeader className="border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <span>🔔</span>
              Notifications
              {unreadCount > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-primary text-primary-foreground text-xs rounded-full">
                  {unreadCount}
                </span>
              )}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              ✕
            </Button>
          </div>
          {notifications.length > 0 && (
            <div className="flex gap-2 mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkAllAsRead}
                disabled={unreadCount === 0}
              >
                Mark all read
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearAll}
              >
                Clear all
              </Button>
            </div>
          )}
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-0">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <div className="text-6xl mb-4">🔔</div>
              <h3 className="text-lg font-semibold mb-2">No notifications</h3>
              <p className="text-sm text-secondary">
                You're all caught up! New notifications will appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    'p-4 hover:bg-primary/5 transition-colors cursor-pointer',
                    !notification.read && 'bg-primary/10'
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0 border-2',
                        getNotificationColor(notification.type)
                      )}
                    >
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h4 className="font-semibold text-sm">{notification.title}</h4>
                          <p className="text-sm text-secondary mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-secondary mt-1">
                            {formatTime(notification.timestamp)}
                          </p>
                        </div>
                        {!notification.read && (
                          <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1" />
                        )}
                      </div>
                      <div className="flex gap-2 mt-2">
                        {notification.link && (
                          <Link
                            href={notification.link}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-primary hover:underline"
                          >
                            View →
                          </Link>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(notification.id)
                          }}
                          className="text-xs text-danger hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </div>
    </>
  )
}
