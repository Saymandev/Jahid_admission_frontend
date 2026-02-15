'use client'

import { Button } from '@/components/ui/button'
import { getUnreadCount } from '@/lib/notifications'
import { getPusher } from '@/lib/pusher'
import { useAuthStore } from '@/store/auth-store'
import { useEffect, useState } from 'react'
import { NotificationPanel } from './notification-panel'

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const user = useAuthStore((state) => state.user)
  const isAdmin = user?.role === 'admin'

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
    
    // Listen for real-time notifications via Pusher
    const pusher = getPusher()
    const channels: any[] = []

    if (isAdmin) {
      channels.push(pusher?.subscribe('main-channel'))
    }

    if (user?.id) {
      channels.push(pusher?.subscribe(`user-${user.id}`))
    }
    
    const handleNotification = () => {
      updateUnreadCount()
    }

    channels.forEach(channel => {
      channel?.bind('notification', handleNotification)
    })

    // Also listen for custom storage events (same-tab updates)
    const handleCustomStorage = () => {
      updateUnreadCount()
    }
    window.addEventListener('notification-updated', handleCustomStorage)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('notification-updated', handleCustomStorage)
      channels.forEach(channel => {
        channel?.unbind('notification', handleNotification)
      })
      if (isAdmin) pusher?.unsubscribe('main-channel')
      if (user?.id) pusher?.unsubscribe(`user-${user.id}`)
    }
  }, [isAdmin, user?.id])

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
