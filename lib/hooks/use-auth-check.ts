import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth-store'
import api from '@/lib/api'

export function useAuthCheck() {
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(true)
  const accessToken = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const setAuth = useAuthStore((state) => state.setAuth)

  useEffect(() => {
    const checkAuth = async () => {
      if (!accessToken || !user) {
        // Try to refresh token if we have refresh token
        const refreshToken = localStorage.getItem('refreshToken')
        if (refreshToken) {
          try {
            const response = await api.post('/auth/refresh', { refreshToken })
            const { user: userData, accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data
            setAuth(userData, newAccessToken, newRefreshToken)
            setIsChecking(false)
            return
          } catch (error) {
            // Refresh failed, clear auth
            useAuthStore.getState().logout()
          }
        }
        router.push('/login')
        setIsChecking(false)
        return
      }

      // Validate token by making a test request
      try {
        const meResponse = await api.get('/auth/me')
        // Update user data if needed
        if (meResponse.data && meResponse.data.email !== user.email) {
          const refreshToken = localStorage.getItem('refreshToken')
          if (refreshToken) {
            const refreshResponse = await api.post('/auth/refresh', { refreshToken })
            const { user: userData, accessToken: newAccessToken, refreshToken: newRefreshToken } = refreshResponse.data
            setAuth(userData, newAccessToken, newRefreshToken)
          }
        }
        setIsChecking(false)
      } catch (error) {
        // Token invalid, try refresh
        const refreshToken = localStorage.getItem('refreshToken')
        if (refreshToken) {
          try {
            const response = await api.post('/auth/refresh', { refreshToken })
            const { user: userData, accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data
            setAuth(userData, newAccessToken, newRefreshToken)
            setIsChecking(false)
            return
          } catch (refreshError) {
            useAuthStore.getState().logout()
            router.push('/login')
            setIsChecking(false)
            return
          }
        }
        useAuthStore.getState().logout()
        router.push('/login')
        setIsChecking(false)
      }
    }

    checkAuth()
  }, [accessToken, user, router, setAuth])

  return { isChecking }
}
