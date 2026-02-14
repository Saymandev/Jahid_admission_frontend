'use client'

import { ProtectedRoute } from '@/components/protected-route'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import api from '@/lib/api'
import { maskCurrency } from '@/lib/mask-value'
import { getPusher } from '@/lib/pusher'
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
    enabled: isAdmin,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const params = new URLSearchParams()
      params.append('page', page.toString())
      params.append('limit', pageSize.toString())
      if (searchQuery) params.append('search', searchQuery)
      if (typeFilter !== 'all') params.append('typeFilter', typeFilter)
      if (userFilter) params.append('userFilter', userFilter)
      
      if (dateFilter !== 'all') {
        if (dateFilter === 'custom') {
            if (startDate) params.append('startDate', startDate)
            if (endDate) params.append('endDate', endDate)
        } else {
            const now = new Date()
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
            const weekStart = new Date(todayStart)
            weekStart.setDate(weekStart.getDate() - 7)
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
            
            if (dateFilter === 'today') params.append('startDate', todayStart.toISOString())
            if (dateFilter === 'week') params.append('startDate', weekStart.toISOString())
            if (dateFilter === 'month') params.append('startDate', monthStart.toISOString())
        }
      }

      const response = await api.get(`/residential/transactions?${params.toString()}`)
      const { data, total, totalAmount, totalPages } = response.data

      // Extract unique users for filter (optional: we could just keep availableUsers state if we have a separate users endpoint)
      // For now, the backend doesn't return users separately, so we can either keep using current logic or skip it if users are known.
      // Actually, keep it for now but it only sees current page users. Better to have a separate endpoint for staff.
      return {
        data: data.map((t: any) => ({
            ...t,
            type: t.source || 'residential',
            paymentType: t.paymentType || 'rent',
            studentName: t.studentName,
            admissionStudentName: t.source === 'coaching' ? t.studentName : undefined,
            recordedBy: t.recordedBy,
            updatedAt: t.updatedAt || t.createdAt,
        })),
        total,
        totalAmount,
        page,
        limit: pageSize,
        totalPages,
      }
    },
  })

  // Fetch all users for the filter
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    enabled: isAdmin,
    queryFn: async () => {
      const response = await api.get('/users?limit=100')
      return response.data.data || []
    }
  })

  const data = transactionsData?.data || []
  const totalPages = transactionsData?.totalPages || 0
  const totalTransactions = transactionsData?.total || 0
  const totalAmount = transactionsData?.totalAmount || 0

  // Reset to first page when filters change
  useEffect(() => {
    setPage(1)
  }, [searchQuery, typeFilter, userFilter, dateFilter, startDate, endDate])

  // Use users from query instead of local state
  const usersForFilter = usersData || []
  const selectedUserName = useMemo(() => {
    if (!userFilter) return null
    const user = usersForFilter.find((u: any) => u._id === userFilter)
    return user?.name || 'Unknown'
  }, [userFilter, usersForFilter])

  useEffect(() => {
    if (!isAdmin) return
    const pusher = getPusher()
    if (!pusher) return

    const channel = pusher.subscribe('main-channel')

    const handlePaymentUpdate = () => {
      // Invalidate and refetch transactions
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
    }

    channel.bind('payment-update', handlePaymentUpdate)

    return () => {
      channel.unbind('payment-update', handlePaymentUpdate)
      pusher.unsubscribe('main-channel')
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
                {usersForFilter.map((user: any) => (
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
                  <p className="text-[10px] text-secondary mt-1">
                    (Payments - Refunds). Adjustments excluded.
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
                      className={cn(
                        "flex items-center justify-between p-4 border rounded-lg transition-colors",
                        txn.paymentType === 'refund' ? "bg-danger/5 border-danger/20 hover:bg-danger/10" :
                        txn.paymentType === 'adjustment' ? "bg-primary/5 border-primary/20 hover:bg-primary/10" :
                        "hover:bg-accent/50"
                      )}
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
                                ? txn.paymentType === 'refund'
                                  ? 'Security Deposit Return'
                                  : txn.paymentType === 'adjustment'
                                    ? 'Security Applied to Due'
                                    : `Room Payment${txn.billingMonth ? ` - ${txn.billingMonth}` : ''}`
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
                          {txn.paymentType === 'adjustment' && (
                            <span className="text-[10px] text-secondary ml-2 font-normal">(Excluded from Total)</span>
                          )}
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
