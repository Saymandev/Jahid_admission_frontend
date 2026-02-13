'use client'

import { ProtectedRoute } from '@/components/protected-route'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import api from '@/lib/api'
import { maskCurrency } from '@/lib/mask-value'
import { getSocket } from '@/lib/socket'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'


interface Transaction {
  _id: string
  type: 'residential' | 'coaching'
  paymentType?: string

  studentName?: string
  admissionStudentName?: string
  amount: number
  paidAmount?: number
  paymentMethod: string
  billingMonth?: string
  course?: string
  createdAt: string
  updatedAt?: string
  recordedBy?: {
    _id: string
    name: string
    email: string
  }
}

export default function TransactionsPage() {
  const user = useAuthStore((state) => state.user)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'residential' | 'coaching'>('all')
  const [page, setPage] = useState(1)
  const pageSize = 10

  // Date and time filters
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [availableUsers, setAvailableUsers] = useState<Array<{ _id: string; name: string; email: string }>>([])

  const isAdmin = user?.role === 'admin'
  const queryClient = useQueryClient()

  const { data: transactionsData, isLoading, refetch } = useQuery<{
    data: Transaction[]
    total: number
    totalAmount: number
    page: number
    limit: number
    totalPages: number
  }>({
    queryKey: ['transactions', page, searchQuery, typeFilter, userFilter, dateFilter, startDate, endDate],
    enabled: isAdmin, // Only fetch if admin
    refetchOnWindowFocus: true, // Refetch when window regains focus (user returns to tab)
    // Note: We rely on Socket.IO for real-time updates instead of polling
    queryFn: async () => {
      const params = new URLSearchParams()
      params.append('page', page.toString())
      params.append('limit', pageSize.toString())
      if (searchQuery) params.append('search', searchQuery)

      const response = await api.get(`/residential/payments?${params.toString()}`)
      const residentialData = response.data

      // For now, still fetch coaching payments (can be paginated later)
      const coachingResponse = await api.get('/coaching/payments')

      const residential = residentialData.data.map((p: any) => ({
        ...p,
        type: 'residential' as const,
        paymentType: p.type || 'rent',
        studentName: p.studentId?.name,

        recordedBy: p.recordedBy,
        updatedAt: p.updatedAt || p.createdAt,
      }))

      const coaching = coachingResponse.data.map((p: any) => ({
        ...p,
        type: 'coaching' as const,
        admissionStudentName: p.admissionId?.studentName,
        course: p.admissionId?.course,
        recordedBy: p.recordedBy,
        paidAmount: p.paidAmount,
        updatedAt: p.updatedAt || p.createdAt,
      }))

      // Filter by type, user, and date on frontend (since we're combining two sources)
      let filtered = [...residential, ...coaching]

      if (typeFilter !== 'all') {
        filtered = filtered.filter(t => t.type === typeFilter)
      }

      if (userFilter) {
        filtered = filtered.filter(t => t.recordedBy?._id === userFilter)
      }

      if (dateFilter !== 'all') {
        const now = new Date()
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const weekStart = new Date(todayStart)
        weekStart.setDate(weekStart.getDate() - 7)
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

        filtered = filtered.filter((t: Transaction) => {
          const txnDate = new Date(t.createdAt)
          if (dateFilter === 'today') return txnDate >= todayStart
          if (dateFilter === 'week') return txnDate >= weekStart
          if (dateFilter === 'month') return txnDate >= monthStart
          if (dateFilter === 'custom') {
            if (startDate) {
              const start = new Date(startDate)
              start.setHours(0, 0, 0, 0)
              if (txnDate < start) return false
            }
            if (endDate) {
              const end = new Date(endDate)
              end.setHours(23, 59, 59, 999)
              if (txnDate > end) return false
            }
          }
          return true
        })
      }

      // Sort by updatedAt (or createdAt) to show most recently updated first
      filtered.sort((a, b) => {
        const aDate = new Date(a.updatedAt || a.createdAt).getTime()
        const bDate = new Date(b.updatedAt || b.createdAt).getTime()
        return bDate - aDate // Descending order (newest first)
      })

      // Extract unique users for filter
      const users = new Map<string, { _id: string; name: string; email: string }>()
      filtered.forEach((t: any) => {
        if (t.recordedBy && t.recordedBy._id) {
          users.set(t.recordedBy._id, {
            _id: t.recordedBy._id,
            name: t.recordedBy.name || 'Unknown',
            email: t.recordedBy.email || '',
          })
        }
      })
      setAvailableUsers(Array.from(users.values()))

      // Paginate the filtered results
      const start = (page - 1) * pageSize
      const paginated = filtered.slice(start, start + pageSize)

      // Calculate total amount for all filtered results (not just current page)
      const filteredTotalAmount = filtered.reduce((sum: number, txn: any) => {
        if (txn.paymentMethod === 'adjustment') {
          return sum
        }
        const amount = (txn.paidAmount || txn.amount || 0)
        if (txn.paymentType === 'refund' || txn.type === 'refund') {
          return sum - amount
        }
        return sum + amount
      }, 0)

      return {
        data: paginated,
        total: filtered.length,
        totalAmount: filteredTotalAmount,
        page,
        limit: pageSize,
        totalPages: Math.ceil(filtered.length / pageSize),
      }
    },
  })

  const data = transactionsData?.data || []
  const totalPages = transactionsData?.totalPages || 0
  const totalTransactions = transactionsData?.total || 0

  // Reset to first page when filters change
  useEffect(() => {
    setPage(1)
  }, [searchQuery, typeFilter, userFilter, dateFilter, startDate, endDate])

  // Use total amount from the filtered transactions data
  const totalAmount = transactionsData?.totalAmount || 0

  // Get selected user name
  const selectedUserName = useMemo(() => {
    if (!userFilter) return null
    const user = availableUsers.find(u => u._id === userFilter)
    return user?.name || 'Unknown'
  }, [userFilter, availableUsers])

  useEffect(() => {
    if (!isAdmin) return
    const socket = getSocket()

    const handlePaymentUpdate = () => {
      // Invalidate and refetch transactions
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
    }

    socket.on('payment-update', handlePaymentUpdate)

    return () => {
      socket.off('payment-update', handlePaymentUpdate)
    }
  }, [isAdmin, queryClient])

  // Only admins can access transactions page
  if (!isAdmin) {
    return (
      <ProtectedRoute>
        <div className="p-6">You don't have permission to access this page.</div>
      </ProtectedRoute>
    )
  }

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Transaction History</h1>
          <p className="text-secondary mt-1">View all payment transactions</p>
        </div>

        <div className="space-y-4">
          {/* Search and Type Filter */}
          <div className="flex gap-4 flex-wrap">
            <Input
              placeholder="Search by student name or payment method..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-md flex-1"
            />
            <Select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value as any)
                setPage(1)
              }}
            >
              <option value="all">All Types</option>
              <option value="residential">Residential</option>
              <option value="coaching">Coaching</option>
            </Select>
          </div>

          {/* Date and User Filters */}
          <div className="flex gap-4 flex-wrap items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-1 block">Time Period</label>
              <Select
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value as any)
                  setPage(1)
                }}
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">This Month</option>
                <option value="custom">Custom Range</option>
              </Select>
            </div>

            {dateFilter === 'custom' && (
              <>
                <div className="flex-1 min-w-[150px]">
                  <label className="text-sm font-medium mb-1 block">Start Date</label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value)
                      setPage(1)
                    }}
                  />
                </div>
                <div className="flex-1 min-w-[150px]">
                  <label className="text-sm font-medium mb-1 block">End Date</label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value)
                      setPage(1)
                    }}
                  />
                </div>
              </>
            )}

            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-1 block">Recorded By</label>
              <Select
                value={userFilter}
                onChange={(e) => {
                  setUserFilter(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">All Users (All Transactions)</option>
                {availableUsers.map((user) => (
                  <option key={user._id} value={user._id}>
                    {user.name} ({user.email})
                  </option>
                ))}
              </Select>
            </div>

            {(dateFilter !== 'all' || userFilter) && (
              <Button
                variant="outline"
                onClick={() => {
                  setDateFilter('all')
                  setStartDate('')
                  setEndDate('')
                  setUserFilter('')
                  setPage(1)
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        </div>

        {/* Summary Card - Shows total when filters are applied */}
        {(dateFilter !== 'all' || userFilter || searchQuery) && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-secondary">Filtered Results Summary</p>
                  <div className="mt-2 space-y-1">
                    {selectedUserName && (
                      <p className="text-sm">
                        <span className="font-medium">Staff:</span> {selectedUserName}
                      </p>
                    )}
                    {dateFilter !== 'all' && (
                      <p className="text-sm">
                        <span className="font-medium">Period:</span>{' '}
                        {dateFilter === 'today' && 'Today'}
                        {dateFilter === 'week' && 'Last 7 Days'}
                        {dateFilter === 'month' && 'This Month'}
                        {dateFilter === 'custom' && startDate && endDate && `${startDate} to ${endDate}`}
                        {dateFilter === 'custom' && startDate && !endDate && `From ${startDate}`}
                      </p>
                    )}
                    <p className="text-sm">
                      <span className="font-medium">Transactions:</span> {totalTransactions}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-secondary">Total Amount Received</p>
                  <p className="text-3xl font-bold text-primary">
                    {maskCurrency(totalAmount, false)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Transactions ({totalTransactions})</CardTitle>
              {selectedUserName && (
                <p className="text-sm text-secondary">
                  Showing transactions recorded by <span className="font-medium">{selectedUserName}</span>
                </p>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {data.length === 0 ? (
              <div className="p-12 text-center">
                <div className="text-6xl mb-4">💳</div>
                <h3 className="text-lg font-semibold mb-2">No transactions found</h3>
                <p className="text-secondary text-sm">
                  {searchQuery || typeFilter !== 'all'
                    ? 'Try adjusting your search or filter criteria'
                    : 'Transactions will appear here once payments are made'}
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {data.map((txn: Transaction) => (
                    <div
                      key={txn._id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-primary/5 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">
                            {txn.type === 'residential' ? '🏠' : '📚'}
                          </span>
                          <div>
                            <Link href={`/dashboard/transactions/${txn._id}`} className="hover:underline">
                              <p className="font-medium">
                                {txn.studentName || txn.admissionStudentName || 'Unknown'}
                              </p>
                            </Link>
                            <p className="text-sm text-secondary">
                              {txn.type === 'residential'
                                ? `Room Payment${txn.billingMonth ? ` - ${txn.billingMonth}` : ''}`
                                : `Coaching - ${txn.course || 'N/A'}`}
                            </p>
                            {txn.recordedBy && (
                              <p className="text-xs text-secondary mt-1">
                                Recorded by: <span className="font-medium">{txn.recordedBy.name}</span>
                                {txn.recordedBy.email && ` (${txn.recordedBy.email})`}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={cn("font-bold text-lg", txn.paymentType === 'refund' && "text-danger")}>
                          {txn.paymentType === 'refund' && '-'} {maskCurrency(txn.paidAmount || txn.amount || 0, false)}
                        </p>

                        <p className="text-sm text-secondary">
                          {txn.paymentMethod}
                        </p>
                        <p className="text-xs text-secondary mt-1">
                          Created: {new Date(txn.createdAt).toLocaleDateString()} {new Date(txn.createdAt).toLocaleTimeString()}
                        </p>
                        {txn.updatedAt && txn.updatedAt !== txn.createdAt && (
                          <p className="text-xs text-secondary">
                            Updated: {new Date(txn.updatedAt).toLocaleDateString()} {new Date(txn.updatedAt).toLocaleTimeString()}
                          </p>
                        )}
                      </div>
                      <Link href={`/dashboard/transactions/${txn._id}`}>
                        <Button variant="outline" size="sm">
                          View Details →
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t">
                    <p className="text-sm text-secondary">
                      Page {page} of {totalPages} ({totalTransactions} total)
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  )
}
