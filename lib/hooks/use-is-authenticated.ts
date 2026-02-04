import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/auth-store'

export const useIsAuthenticated = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const accessToken = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)

  useEffect(() => {
    setIsAuthenticated(!!accessToken && !!user)
  }, [accessToken, user])

  return isAuthenticated
}
