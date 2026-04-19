'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useIsAuthenticated } from '@/lib/hooks/use-is-authenticated'
import { useAuthCheck } from '@/lib/hooks/use-auth-check'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const isAuthenticated = useIsAuthenticated()
  const { isChecking } = useAuthCheck()

  useEffect(() => {
    if (!isChecking && !isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, isChecking, router])

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-secondary italic">Redirecting to login...</p>
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mx-auto"></div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
