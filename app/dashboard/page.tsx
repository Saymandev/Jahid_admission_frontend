'use client'

import { ProtectedRoute } from '@/components/protected-route'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import api from '@/lib/api'
import { getSocket } from '@/lib/socket'
import { useAuthStore } from '@/store/auth-store'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { maskCurrency, maskValue } from '@/lib/mask-value'

interface DashboardStats {
  totalRooms: number
  activeStudents: number
  totalDue: number
  twoPlusMonthsDueStudents: number
}

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user)
  const router = useRouter()
  const queryClient = useQueryClient()
  const [stats, setStats] = useState<DashboardStats | null>(null)

  const { data, refetch, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await api.get('/residential/dashboard/stats')
      return response.data
    },
  })

  const { data: monthlyChartData, isLoading: loadingChartData } = useQuery({
    queryKey: ['dashboard-monthly-chart'],
    queryFn: async () => {
      const response = await api.get('/residential/dashboard/monthly-chart')
      return response.data
    },
  })

  useEffect(() => {
    if (data) {
      setStats(data)
    }
  }, [data])

  useEffect(() => {
    const socket = getSocket()

    socket.on('dashboard-update', (newStats: DashboardStats) => {
      setStats(newStats)
      // Invalidate queries instead of refetching directly for better cache management
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-monthly-chart'] })
    })

    socket.on('payment-update', () => {
      // Invalidate queries instead of refetching directly
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-monthly-chart'] })
    })

    return () => {
      socket.off('dashboard-update')
      socket.off('payment-update')
    }
  }, [queryClient])

  // Use real data from API, fallback to empty array if loading
  const monthlyData = monthlyChartData || []

  if (isLoading && !stats) {
    return (
      <ProtectedRoute>
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-secondary mt-1">Welcome back, {user?.name}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card 
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => router.push('/dashboard/rooms')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Rooms</CardTitle>
              <span className="text-2xl">🏠</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{maskValue(stats?.totalRooms, user?.role === 'staff')}</div>
              <p className="text-xs text-secondary mt-1">Available & Occupied</p>
            </CardContent>
          </Card>

          <Card 
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => router.push('/dashboard/students?status=active')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Students</CardTitle>
              <span className="text-2xl">👥</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{maskValue(stats?.activeStudents, user?.role === 'staff')}</div>
              <p className="text-xs text-secondary mt-1">Currently Residing</p>
            </CardContent>
          </Card>

          <Card 
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => router.push('/dashboard/dues')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Due</CardTitle>
              <span className="text-2xl">💰</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-danger">
                {maskCurrency(stats?.totalDue, user?.role === 'staff')}
              </div>
              <p className="text-xs text-secondary mt-1">Outstanding Amount</p>
            </CardContent>
          </Card>

          <Card 
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => router.push('/dashboard/dues?filter=2plus')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">2+ Months Due</CardTitle>
              <span className="text-2xl">⚠️</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-danger">{maskValue(stats?.twoPlusMonthsDueStudents, user?.role === 'staff')}</div>
              <p className="text-xs text-secondary mt-1">Requires Attention</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Collection (Last 12 Months)</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingChartData ? (
                <div className="h-[300px] flex items-center justify-center">
                  <div className="text-secondary">Loading chart data...</div>
                </div>
              ) : monthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => `${maskCurrency(value, user?.role === 'staff')}`} />
                    <Bar dataKey="collection" fill="#4285F4" name="Collection" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center">
                  <div className="text-secondary">No data available</div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Due Trends (Last 12 Months)</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingChartData ? (
                <div className="h-[300px] flex items-center justify-center">
                  <div className="text-secondary">Loading chart data...</div>
                </div>
              ) : monthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => `${maskCurrency(value, user?.role === 'staff')}`} />
                    <Line type="monotone" dataKey="due" stroke="#EA4335" strokeWidth={2} name="Due Amount" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center">
                  <div className="text-secondary">No data available</div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  )
}
