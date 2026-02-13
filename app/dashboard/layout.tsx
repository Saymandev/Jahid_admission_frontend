'use client'

import { QuickPaymentModal } from '@/components/quick-payment-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MobileMenu } from '@/components/ui/mobile-menu'
import { NotificationBell } from '@/components/ui/notification-bell'
import { Sidebar } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isQuickRentOpen, setIsQuickRentOpen] = useState(false)

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      // Navigate to search results or filter current page
      router.push(`/dashboard/search?q=${encodeURIComponent(searchQuery)}`)
      setSearchQuery('')
    }
  }

      const navLinks = [
        { href: '/dashboard', label: 'Dashboard', icon: '📊' },
        { href: '/dashboard/rooms', label: 'Rooms', icon: '🏠' },
        { href: '/dashboard/students', label: 'Students', icon: '👥' },
        { href: '/dashboard/coaching', label: 'Coaching', icon: '📚' },
        ...(user?.role === 'admin' ? [
          { href: '/dashboard/transactions', label: 'Transactions', icon: '💳' },
          { href: '/dashboard/users', label: 'Users', icon: '👤' },
          { href: '/dashboard/archive', label: 'Archive', icon: '📦' },
        ] : []),
        { href: '/dashboard/settings', label: 'Settings', icon: '⚙️' },
      ]

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation - Mobile & Tablet */}
      <nav className="lg:hidden border-b border-border bg-card shadow-sm sticky top-0 z-40">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex items-center space-x-4 flex-1 min-w-0">
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open menu"
              >
                ☰
              </Button>
              <Link href="/dashboard" className="text-xl font-bold text-primary flex items-center gap-2 shrink-0">
                <span>📊</span>
                <span className="hidden sm:inline">Accounting System</span>
              </Link>
              <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-md">
                <Input
                  type="search"
                  placeholder="Search rooms, students, transactions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                />
              </form>
              <div className="hidden md:flex space-x-1">
                {navLinks.map((link) => {
                  const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname?.startsWith(link.href))
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={cn(
                        'px-3 py-2 text-sm font-medium rounded-md transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-secondary hover:text-primary hover:bg-primary/10'
                      )}
                    >
                      <span className="mr-2">{link.icon}</span>
                      {link.label}
                    </Link>
                  )
                })}
              </div>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <form onSubmit={handleSearch} className="md:hidden">
                <Input
                  type="search"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-32"
                />
              </form>
               <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsQuickRentOpen(true)}
                title="Quick Rent"
              >
                ⚡
              </Button>
              <NotificationBell />
              <div className="hidden sm:flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-medium text-primary">
                    {user?.name?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="hidden md:flex flex-col">
                  <span className="text-sm font-medium">{user?.name}</span>
                  <span className="text-xs text-secondary">{user?.role}</span>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Top Bar - Large Screens (with sidebar) */}
      <nav className="hidden lg:block border-b border-border bg-card shadow-sm sticky top-0 z-40">
        <div className={cn('mr-4 transition-all duration-300', sidebarOpen ? 'ml-[calc(16rem+1rem)]' : 'ml-[calc(4rem+1rem)]')}>
          <div className="flex h-16 items-center justify-between gap-4 px-4">
            <form onSubmit={handleSearch} className="flex-1 max-w-2xl">
              <Input
                type="search"
                placeholder="Search rooms, students, transactions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </form>
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsQuickRentOpen(true)}
                className="flex items-center gap-2"
              >
                <span>⚡</span>
                <span className="hidden xl:inline">Quick Rent</span>
              </Button>
              <NotificationBell />
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && <MobileMenu navLinks={navLinks} onClose={() => setMobileMenuOpen(false)} />}

      {/* Floating Sidebar - Large Screens */}
      <Sidebar navLinks={navLinks} isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      {/* Main Content */}
      <main className={cn('lg:mr-4 lg:mt-4 min-h-[calc(100vh-4rem)] transition-all duration-300', sidebarOpen ? 'lg:ml-[calc(16rem+1rem)]' : 'lg:ml-[calc(4rem+1rem)]')}>
        {children}
      </main>

      <QuickPaymentModal
        isOpen={isQuickRentOpen}
        onClose={() => setIsQuickRentOpen(false)}
      />
    </div>
  )
}
