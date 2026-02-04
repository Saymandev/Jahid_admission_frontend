'use client'

import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface SidebarProps {
  navLinks: Array<{ href: string; label: string; icon: string }>
  isOpen: boolean
  onToggle: () => void
}

export function Sidebar({ navLinks, isOpen, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const user = useAuthStore((state) => state.user)

  if (!isOpen) {
    return (
      <>
        {/* Toggle Button - When Closed */}
        <button
          onClick={onToggle}
          className="hidden lg:flex fixed left-4 top-4 z-40 w-10 h-10 items-center justify-center bg-white border border-gray-200 rounded-lg shadow-lg hover:bg-gray-50 transition-all duration-300"
          aria-label="Open sidebar"
        >
          <span className="text-xl">☰</span>
        </button>
      </>
    )
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="hidden lg:block fixed inset-0 bg-black/50 z-30"
        onClick={onToggle}
      />

      {/* Toggle Button - When Open */}
      <button
        onClick={onToggle}
        className="hidden lg:flex fixed left-[calc(16rem+1rem)] top-4 z-40 w-10 h-10 items-center justify-center bg-white border border-gray-200 rounded-lg shadow-lg hover:bg-gray-50 transition-all duration-300"
        aria-label="Close sidebar"
      >
        <span className="text-xl">←</span>
      </button>

      {/* Sidebar */}
      <aside className="hidden lg:block fixed left-0 top-0 bottom-0 w-64 z-40 bg-white border-r border-gray-200 shadow-xl">
        <div className="h-full flex flex-col overflow-hidden">
          <div className="p-5 flex flex-col h-full">
            {/* Logo */}
            <div className="shrink-0 mb-6 pb-4 border-b border-gray-200">
              <Link href="/dashboard" className="flex items-center gap-2 group">
                <span className="text-2xl shrink-0">📊</span>
                <div className="flex flex-col leading-tight">
                  <span className="text-base font-bold text-primary whitespace-nowrap">Accounting</span>
                  <span className="text-base font-bold text-primary whitespace-nowrap">System</span>
                </div>
              </Link>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-2 overflow-y-auto min-h-0">
              {navLinks.map((link) => {
                const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname?.startsWith(link.href))
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={onToggle}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200',
                      isActive
                        ? 'bg-blue-500 text-white shadow-md font-semibold'
                        : 'text-gray-700 hover:text-blue-500 hover:bg-blue-50'
                    )}
                  >
                    <span className="text-xl shrink-0">{link.icon}</span>
                    <span className="font-medium">{link.label}</span>
                  </Link>
                )
              })}
            </nav>

            {/* User Info */}
            <div className="shrink-0 mt-auto pt-4 border-t border-gray-200">
              <div className="flex items-center gap-3 px-3 py-3 rounded-lg bg-gray-50">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <span className="text-sm font-semibold text-blue-600">
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{user?.name || 'User'}</p>
                  <p className="text-xs text-gray-500 capitalize">{user?.role || 'staff'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
