'use client'

import { ProtectedRoute } from '@/components/protected-route'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import api from '@/lib/api'
import { maskCurrency, maskValue } from '@/lib/mask-value'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

interface StudentDue {
  _id: string
  studentName: string
  studentPhone: string
  studentRoom: {
    name: string
  }
  monthlyRent: number
  totalDue: number
  consecutiveDueMonths: number
  studentId: string
  payments: Array<{
    month: string
    rentAmount: number
    paidAmount: number
    dueAmount: number
    status: 'paid' | 'partial' | 'unpaid'
  }>
  dueStatus: 'no_due' | 'one_month' | 'two_plus_months'
}

export default function DuesPage() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const searchParams = useSearchParams()
  const filter = searchParams.get('filter') || 'all'
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10
  const isStaff = user?.role === 'staff'

  const { data: studentsData, isLoading, error: studentsError } = useQuery({
    queryKey: ['students', 'active', 'dues', filter],
    queryFn: async () => {
      // Fetch all active students for dues calculation (use high limit)
      const response = await api.get('/residential/students?status=active&limit=1000')
      // Handle both paginated and non-paginated responses
      if (response.data?.data) {
        return response.data
      }
      return { data: Array.isArray(response.data) ? response.data : [], total: 0 }
    },
  })

  // Extract students array from paginated response
  const students = studentsData?.data || []

  const { data: dueStatuses, isLoading: loadingDues } = useQuery({
    queryKey: ['student-due-statuses', students?.map((s: any) => s._id)],
    queryFn: async () => {
      if (!students || students.length === 0) return []
      const statusPromises = students.map((student: any) =>
        api.get(`/residential/students/${student._id}/due-status`).then(res => ({
          ...res.data,
          studentId: student._id,
          studentName: res.data.student?.name || student.name,
          studentPhone: res.data.student?.phone || student.phone,
          studentRoom: res.data.student?.roomId || student.roomId,
          monthlyRent: res.data.student?.monthlyRent || student.monthlyRent,
          payments: res.data.payments || [],
        }))
      )
      return Promise.all(statusPromises)
    },
    enabled: !!students && students.length > 0,
  })

  // Reset to first page when filters change
  useEffect(() => {
    setPage(1)
  }, [searchQuery, filter])

  const filteredDues = useMemo(() => {
    if (!dueStatuses || !Array.isArray(dueStatuses)) return []
    
    return dueStatuses.filter((due: StudentDue) => {
      const matchesSearch =
        due.studentName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        due.studentId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        due.studentPhone?.includes(searchQuery) ||
        due.studentRoom?.name?.toLowerCase().includes(searchQuery.toLowerCase())
      
      // Count total months with due (not just consecutive)
      const monthsWithDue = due.payments?.filter((p: any) => p.dueAmount > 0).length || 0
      
      const matchesFilter = 
        filter === 'all' ||
        (filter === '2plus' && due.consecutiveDueMonths >= 2) ||
        (filter === 'one' && (due.consecutiveDueMonths === 1 || monthsWithDue === 1)) ||
        (filter === 'nodue' && due.consecutiveDueMonths === 0)
      
      // For 'all' filter, show all students (including those with no due)
      // For other filters, only show students with dues matching the filter
      if (filter === 'all') {
        return matchesSearch
      }
      
      return matchesSearch && matchesFilter && due.totalDue > 0
    })
  }, [dueStatuses, searchQuery, filter])

  // Sort by due amount (highest first) or by consecutive months
  const sortedDues = useMemo(() => {
    return [...filteredDues].sort((a: StudentDue, b: StudentDue) => {
      if (filter === '2plus') {
        return b.consecutiveDueMonths - a.consecutiveDueMonths || b.totalDue - a.totalDue
      }
      return b.totalDue - a.totalDue
    })
  }, [filteredDues, filter])

  const paginatedDues = useMemo(() => {
    const startIndex = (page - 1) * pageSize
    return sortedDues.slice(startIndex, startIndex + pageSize)
  }, [sortedDues, page, pageSize])

  const totalPages = Math.ceil(sortedDues.length / pageSize)

  if (isLoading || loadingDues) {
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

  // Show error if students failed to load
  if (studentsError) {
    return (
      <ProtectedRoute>
        <div className="p-6">
          <Card>
            <CardContent className="p-12 text-center">
              <div className="text-6xl mb-4">⚠️</div>
              <h3 className="text-lg font-semibold mb-2">Error loading students</h3>
              <p className="text-secondary text-sm">Please try refreshing the page</p>
            </CardContent>
          </Card>
        </div>
      </ProtectedRoute>
    )
  }

  const totalDueAmount = sortedDues.reduce((sum: number, due: StudentDue) => sum + (due.totalDue || 0), 0)

  return (
    <ProtectedRoute>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Student Dues</h1>
            <p className="text-secondary mt-1">
              {filter === '2plus' 
                ? 'Students with 2+ months due' 
                : filter === 'one'
                ? 'Students with 1 month due'
                : 'All student dues and payment status'}
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push('/dashboard')}>
            ← Back to Dashboard
          </Button>
        </div>

        {/* Summary Card */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-secondary">Total Outstanding</p>
                <p className="text-2xl font-bold text-danger">
                  {maskCurrency(totalDueAmount, isStaff)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-secondary">Students with Due</p>
                <p className="text-2xl font-bold">{maskValue(sortedDues.length, isStaff)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="flex gap-4">
          <Input
            placeholder="Search by name, ID, phone, or room..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-md"
          />
          <div className="flex gap-2">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => router.push('/dashboard/dues')}
            >
              All Dues
            </Button>
            <Button
              variant={filter === '2plus' ? 'default' : 'outline'}
              size="sm"
              onClick={() => router.push('/dashboard/dues?filter=2plus')}
            >
              2+ Months Due
            </Button>
            <Button
              variant={filter === 'one' ? 'default' : 'outline'}
              size="sm"
              onClick={() => router.push('/dashboard/dues?filter=one')}
            >
              1 Month Due
            </Button>
          </div>
        </div>

        {/* Dues List */}
        <div className="space-y-4">
          {paginatedDues.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <div className="text-6xl mb-4">✅</div>
                <h3 className="text-lg font-semibold mb-2">No dues found</h3>
                <p className="text-secondary text-sm">
                  {searchQuery || filter !== 'all'
                    ? 'Try adjusting your search or filter criteria'
                    : 'All students are up to date with payments!'}
                </p>
              </CardContent>
            </Card>
          ) : (
            paginatedDues.map((due: StudentDue) => (
              <Card 
                key={due.studentId} 
                className={cn(
                  'hover:shadow-md transition-shadow',
                  due.consecutiveDueMonths >= 2 && 'border-danger/50 bg-danger/5'
                )}
              >
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <span>👤</span>
                        {due.studentName}
                      </CardTitle>
                      <p className="text-sm text-secondary mt-1">ID: {due.studentId}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-danger">
                        {maskCurrency(due.totalDue, isStaff)}
                      </div>
                      <p className="text-xs text-secondary">
                        {maskValue(due.consecutiveDueMonths, isStaff)} month{due.consecutiveDueMonths !== 1 ? 's' : ''} due
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                    <div>
                      <span className="text-secondary block mb-1">Room</span>
                      <span className="font-medium">🏠 {due.studentRoom?.name || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-secondary block mb-1">Phone</span>
                      <span className="font-medium">📞 {due.studentPhone}</span>
                    </div>
                    <div>
                      <span className="text-secondary block mb-1">Monthly Rent</span>
                      <span className="font-medium">💰 {due.monthlyRent.toLocaleString()} BDT</span>
                    </div>
                    <div>
                      <span className="text-secondary block mb-1">Status</span>
                      <span
                        className={cn(
                          'font-medium px-2 py-1 rounded text-xs',
                          due.dueStatus === 'no_due'
                            ? 'bg-success/10 text-success'
                            : due.dueStatus === 'one_month'
                            ? 'bg-warning/10 text-warning'
                            : 'bg-danger/10 text-danger'
                        )}
                      >
                        {due.dueStatus === 'no_due'
                          ? '✓ No Due'
                          : due.dueStatus === 'one_month'
                          ? '⚠ 1 Month Due'
                          : '⚠ 2+ Months Due'}
                      </span>
                    </div>
                  </div>

                  {/* Monthly Breakdown */}
                  {due.payments && due.payments.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm font-medium mb-3">Monthly Payment Breakdown:</p>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {due.payments
                          .filter((p: any) => p.dueAmount > 0 || p.paidAmount > 0)
                          .slice()
                          .reverse()
                          .map((payment: any, idx: number) => {
                            const monthDate = new Date(payment.month + '-01')
                            const monthName = monthDate.toLocaleString('default', { month: 'long', year: 'numeric' })
                            
                            return (
                              <div
                                key={idx}
                                className={cn(
                                  'p-3 rounded-lg border',
                                  payment.dueAmount > 0
                                    ? 'bg-danger/10 border-danger/30'
                                    : 'bg-success/10 border-success/30'
                                )}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <div className="font-medium text-sm">{monthName}</div>
                                    <div className="flex gap-4 mt-1 text-xs">
                                      <span className="text-secondary">
                                        Rent: <span className="font-medium">{maskCurrency(payment.rentAmount, isStaff)}</span>
                                      </span>
                                      <span className={cn(
                                        payment.paidAmount > 0 ? 'text-success' : 'text-secondary'
                                      )}>
                                        Paid: <span className="font-medium">{maskCurrency(payment.paidAmount, isStaff)}</span>
                                      </span>
                                      {payment.dueAmount > 0 && (
                                        <span className="text-danger">
                                          Due: <span className="font-medium">{maskCurrency(payment.dueAmount, isStaff)}</span>
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="ml-4">
                                    <span
                                      className={cn(
                                        'px-2 py-1 rounded text-xs font-medium',
                                        payment.status === 'paid'
                                          ? 'bg-success text-success-foreground'
                                          : payment.status === 'partial'
                                          ? 'bg-warning text-warning-foreground'
                                          : 'bg-danger text-danger-foreground'
                                      )}
                                    >
                                      {payment.status === 'paid'
                                        ? '✓ Paid'
                                        : payment.status === 'partial'
                                        ? '~ Partial'
                                        : '✕ Unpaid'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex gap-2">
                    <Link href={`/dashboard/students/${due.studentId}`}>
                      <Button variant="outline" size="sm">
                        View Details →
                      </Button>
                    </Link>
                    {due.totalDue > 0 && (
                      <Link href={`/dashboard/students/${due.studentId}`}>
                        <Button size="sm">
                          Record Payment
                        </Button>
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-sm text-secondary">
              Page {page} of {totalPages} ({sortedDues.length} total)
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPage((p) => Math.max(1, p - 1))
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPage((p) => Math.min(totalPages, p + 1))
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}
