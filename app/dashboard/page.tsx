'use client'

import { ProtectedRoute } from '@/components/protected-route'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import api from '@/lib/api'
import { maskCurrency, maskValue } from '@/lib/mask-value'
import { getPusher } from '@/lib/pusher'
import { useAuthStore } from '@/store/auth-store'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

interface DashboardStats {
  totalRooms: number
  activeStudents: number
  residentialDue: number
  coachingDue: number
  todayCollection?: number
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
    const pusher = getPusher()
    if (!pusher) return

    const channel = pusher.subscribe('main-channel')

    channel.bind('dashboard-update', (newStats: DashboardStats) => {
      setStats(newStats)
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-monthly-chart'] })
    })

    channel.bind('payment-update', () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-monthly-chart'] })
    })

    return () => {
      channel.unbind_all()
      pusher.unsubscribe('main-channel')
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

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card 
            className="bg-primary/5 border-primary/20 hover:shadow-lg transition-all shadow-sm cursor-pointer border-2"
            onClick={() => router.push('/dashboard/transactions')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold text-primary">Today&apos;s Total Collection</CardTitle>
              <span className="text-2xl animate-pulse">✨</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-primary">
                {maskCurrency(stats?.todayCollection || 0, user?.role === 'staff')}
              </div>
              <p className="text-xs text-primary/70 mt-1 font-medium">Real-time Cash Flow</p>
            </CardContent>
          </Card>

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
              <CardTitle className="text-sm font-medium">Residential Due</CardTitle>
              <span className="text-2xl">💰</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-danger">
                {maskCurrency(stats?.residentialDue, user?.role === 'staff')}
              </div>
              <p className="text-xs text-secondary mt-1">Outstanding Rent</p>
            </CardContent>
          </Card>

          <Card 
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => router.push('/dashboard/coaching?status=pending')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Coaching Due</CardTitle>
              <span className="text-2xl">📚</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-danger">
                {maskCurrency(stats?.coachingDue, user?.role === 'staff')}
              </div>
              <p className="text-xs text-secondary mt-1">Outstanding Fees</p>
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
