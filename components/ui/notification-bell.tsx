'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { getUnreadCount } from '@/lib/notifications'
import { NotificationPanel } from './notification-panel'
import { getSocket } from '@/lib/socket'

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    const updateUnreadCount = () => {
      setUnreadCount(getUnreadCount())
    }

    // Initial count
    updateUnreadCount()

    // Listen for storage changes (when notifications are updated in other tabs)
    const handleStorageChange = () => {
      updateUnreadCount()
    }

    window.addEventListener('storage', handleStorageChange)
    
    // Listen for real-time notifications via Socket.IO
    const socket = getSocket()
    const handleNotification = () => {
      updateUnreadCount()
    }

    socket.on('notification', handleNotification)

    // Also listen for custom storage events (same-tab updates)
    const handleCustomStorage = () => {
      updateUnreadCount()
    }
    window.addEventListener('notification-updated', handleCustomStorage)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('notification-updated', handleCustomStorage)
      socket.off('notification', handleNotification)
    }
  }, [])

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="relative"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
      >
        <span className="text-xl">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-danger text-white text-xs rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>
      <NotificationPanel isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  )
}
