'use client'

import { PaymentCalendar } from '@/components/payment-calendar'
import { ProtectedRoute } from '@/components/protected-route'
import { ReturnSecurityDepositForm, UseSecurityDepositForm } from '@/components/security-deposit-forms'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import api from '@/lib/api'
import { maskCurrency, maskValue } from '@/lib/mask-value'
import { exportCheckoutStatement, exportStudentLedger } from '@/lib/pdf-export'
import { showToast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { paymentSchema } from '@/lib/validations'
import { useAuthStore } from '@/store/auth-store'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'

type PaymentFormData = {
  billingMonth: string
  paidAmount: string
  paymentMethod: 'cash' | 'bkash' | 'bank'
  transactionId?: string
  notes?: string
  isAdvance?: boolean
}

export default function StudentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const studentId = params.id as string
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [showUseSecurityDeposit, setShowUseSecurityDeposit] = useState(false)
  const [showReturnSecurityDeposit, setShowReturnSecurityDeposit] = useState(false)
  const [useSecurityDepositForCheckout, setUseSecurityDepositForCheckout] = useState(false)
  const [showAdvanceApplications, setShowAdvanceApplications] = useState(false)
  const [showReactivateForm, setShowReactivateForm] = useState(false)
  const [reactivateRoomId, setReactivateRoomId] = useState('')

  const [selectedBillingMonth, setSelectedBillingMonth] = useState(new Date().toISOString().slice(0, 7))

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      billingMonth: new Date().toISOString().slice(0, 7),
      paymentMethod: 'cash',
    },
  })

  const billingMonthValue = watch('billingMonth')
  
  useEffect(() => {
    if (billingMonthValue) {
      setSelectedBillingMonth(billingMonthValue)
    }
  }, [billingMonthValue])

  const handleMonthSelect = (month: string) => {
    setValue('billingMonth', month)
    setSelectedBillingMonth(month)
    setShowPaymentForm(true)
  }

  const { data: student } = useQuery({
    queryKey: ['student', studentId],
    queryFn: async () => {
      const response = await api.get(`/residential/students/${studentId}`)
      return response.data
    },
  })

  const { data: dueStatus } = useQuery({
    queryKey: ['student-due-status', studentId],
    queryFn: async () => {
      const response = await api.get(`/residential/students/${studentId}/due-status`)
      return response.data
    },
  })

  const { data: advanceData, isLoading: loadingAdvanceApplications } = useQuery({
    queryKey: ['advance-applications', studentId],
    queryFn: async () => {
      const response = await api.get(`/residential/students/${studentId}/advance-applications`)
      return response.data
    },
    enabled: showAdvanceApplications && user?.role === 'admin',
  })

  const { data: rooms } = useQuery({
    queryKey: ['rooms'],
    queryFn: async () => {
      const response = await api.get('/residential/rooms')
      return response.data
    },
    enabled: showReactivateForm,
  })

  const advanceSources = advanceData?.sources || []
  const advanceApplications = advanceData?.applications || []

  const paymentMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/residential/payments', {
        ...data,
        studentId,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-due-status', studentId] })
      queryClient.invalidateQueries({ queryKey: ['student', studentId] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      setShowPaymentForm(false)
      reset()
      showToast('Payment recorded successfully!', 'success')
    },
    onError: (error: any) => {
      showToast(error.response?.data?.message || 'Failed to record payment', 'error')
    },
  })

  const checkoutMutation = useMutation({
    mutationFn: async (useSecurityDeposit: boolean = false) => {
      const response = await api.post(`/residential/students/${studentId}/checkout`, {
        useSecurityDeposit,
      })
      return response.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['student', studentId] })
      queryClient.invalidateQueries({ queryKey: ['students'] })
      // Export checkout statement
      exportCheckoutStatement(data)
      showToast('Student checked out successfully! Statement exported.', 'success')
      router.push('/dashboard/students')
    },
    onError: (error: any) => {
      showToast(error.response?.data?.message || 'Failed to checkout student', 'error')
    },
  })

  const reactivateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post(`/residential/students/${studentId}/reactivate`, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student', studentId] })
      queryClient.invalidateQueries({ queryKey: ['students'] })
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
      queryClient.invalidateQueries({ queryKey: ['student-due-status', studentId] })
      showToast('Student reactivated successfully!', 'success')
      setShowReactivateForm(false)
    },
    onError: (error: any) => {
      showToast(error.response?.data?.message || 'Failed to reactivate student', 'error')
    },
  })

  const onPaymentSubmit = (data: PaymentFormData) => {
    paymentMutation.mutate({
      studentId,
      billingMonth: data.isAdvance ? undefined : data.billingMonth,
      paidAmount: parseFloat(data.paidAmount),
      paymentMethod: data.paymentMethod,
      transactionId: data.transactionId,
      notes: data.notes,
      isAdvance: data.isAdvance || false,
    })
  }

  const handleExportLedger = () => {
    if (student && dueStatus) {
      exportStudentLedger(student, dueStatus.payments)
      showToast('Student ledger exported successfully!', 'success')
    }
  }

  if (!student) {
    return (
      <ProtectedRoute>
        <div className="p-6">Loading...</div>
      </ProtectedRoute>
    )
  }

  const dueStatusColor =
    dueStatus?.dueStatus === 'no_due'
      ? 'text-success'
      : dueStatus?.dueStatus === 'one_month'
      ? 'text-warning'
      : 'text-danger'

  return (
    <ProtectedRoute>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">{student.name}</h1>
            <p className="text-secondary mt-1">ID: {student.studentId}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push('/dashboard/students')}>
              Back
            </Button>
            <Button variant="outline" onClick={handleExportLedger}>
              Export Ledger
            </Button>
            {student.status === 'active' && user?.role === 'admin' && (
              <>
                {/* Checkout Confirmation Dialog */}
                <Button
                  variant="destructive"
                  onClick={() => {
                    const securityDeposit = student.securityDeposit || 0
                    const totalAdvance = dueStatus?.totalAdvance || 0
                    const totalDue = dueStatus?.totalDue || 0
                    const refundable = securityDeposit + totalAdvance
                    
                    if (totalDue > 0) {
                      // Due scenario - prefer using Security Deposit
                      const confirmMsg = `Student has outstanding dues: ${totalDue} BDT.
Security Deposit: ${securityDeposit} BDT
Advance: ${totalAdvance} BDT

Do you want to checkout and ADJUST dues from Security Deposit?`
                      if (confirm(confirmMsg)) {
                         setUseSecurityDepositForCheckout(true)
                         checkoutMutation.mutate(true)
                      }
                    } else {
                      // Refund scenario
                      const confirmMsg = `Ready to Checkout?

Refund Calculation:
+ Security Deposit: ${securityDeposit} BDT
+ Unused Advance: ${totalAdvance} BDT
--------------------------------
= Total Refundable: ${refundable} BDT

Do you want to proceed with Checkout and potentially record this Refund?`
                      if (confirm(confirmMsg)) {
                        setUseSecurityDepositForCheckout(false)
                        checkoutMutation.mutate(false)
                      }
                    }
                  }}
                  disabled={checkoutMutation.isPending}
                >
                  {checkoutMutation.isPending ? 'Processing...' : 'Checkout'}
                </Button>
              </>
            )}
            {student.status === 'left' && user?.role === 'admin' && (
              <Button
                variant="default"
                onClick={() => setShowReactivateForm(true)}
              >
                Reactivate Student
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Student Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-sm">
                <span className="text-secondary">Phone: </span>
                {student.phone}
              </div>
              <div className="text-sm">
                <span className="text-secondary">Room: </span>
                {student.roomId?.name} (Bed {student.bedNumber})
              </div>
              <div className="text-sm">
                <span className="text-secondary">Monthly Rent: </span>
                {maskCurrency(student.monthlyRent, user?.role === 'staff')}
              </div>
              <div className="text-sm">
                <span className="text-secondary">Security Deposit: </span>
                <span className="font-semibold text-primary">
                  {maskCurrency(student.securityDeposit || 0, user?.role === 'staff')}
                </span>
              </div>
              <div className="text-sm">
                <span className="text-secondary">Status: </span>
                <span className={student.status === 'active' ? 'text-success' : 'text-secondary'}>
                  {student.status.toUpperCase()}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Due Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-2xl font-bold">
                <span className={dueStatusColor}>
                  {maskCurrency(dueStatus?.totalDue || 0, user?.role === 'staff')}
                </span>
              </div>
              <div className="text-sm">
                <span className="text-secondary">Status: </span>
                <span className={dueStatusColor}>
                  {dueStatus?.dueStatus === 'no_due'
                    ? 'No Due'
                    : dueStatus?.dueStatus === 'one_month'
                    ? '1 Month Due'
                    : '2+ Months Due'}
                </span>
              </div>
              {dueStatus?.consecutiveDueMonths > 0 && (
                <div className="text-sm">
                  <span className="text-secondary">Consecutive Due Months: </span>
                  {maskValue(dueStatus.consecutiveDueMonths, user?.role === 'staff')}
                </div>
              )}
              {dueStatus?.totalAdvance > 0 && (
                <div className="pt-2 border-t">
                  <div className="text-sm">
                    <span className="text-secondary">Advance Available: </span>
                    <span className="font-semibold text-primary">
                      {maskCurrency(dueStatus.totalAdvance, user?.role === 'staff')}
                    </span>
                  </div>
                  <p className="text-xs text-secondary mt-1">
                    This advance will automatically apply to future months with dues
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Security Deposit Card */}
          {(student.status === 'active' || (student.status === 'left' && student.securityDeposit > 0)) && (
            <Card>
              <CardHeader>
                <CardTitle>Security Deposit</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-2xl font-bold text-primary">
                  {maskCurrency(student.securityDeposit || 0, user?.role === 'staff')}
                </div>
                {student.securityDeposit > 0 && user?.role === 'admin' && (
                  <div className="flex gap-2 flex-wrap">
                    {student.status === 'active' && dueStatus?.totalDue > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowUseSecurityDeposit(true)}
                      >
                        Use for Dues
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowReturnSecurityDeposit(true)}
                    >
                      Return Deposit
                    </Button>
                  </div>
                )}
                {student.status === 'left' && student.securityDeposit === 0 && (
                  <p className="text-xs text-secondary">Security deposit was returned during checkout</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Advance Payment Management & Report */}
          {user?.role === 'admin' && (dueStatus?.totalAdvance > 0 || student.status === 'left') && (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Advance Payment</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAdvanceApplications(!showAdvanceApplications)}
                  >
                    {showAdvanceApplications ? 'Hide Report' : 'View Report'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {dueStatus?.totalAdvance > 0 ? (
                  <>
                    <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg mb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-secondary">Total Advance Available</p>
                        <p className="text-2xl font-bold text-primary">
                          {maskCurrency(dueStatus.totalAdvance, false)}
                        </p>
                        <p className="text-xs text-secondary mt-1">
                          This advance will automatically apply to future months with outstanding dues
                        </p>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={async () => {
                          if (confirm(`Are you sure you want to delete the advance payment of ${maskCurrency(dueStatus.totalAdvance, false)}? This action cannot be undone if it has been applied to any months.`)) {
                            try {
                              await api.delete(`/residential/students/${studentId}/advance-payment`)
                              queryClient.invalidateQueries({ queryKey: ['student-due-status', studentId] })
                              queryClient.invalidateQueries({ queryKey: ['student', studentId] })
                              showToast('Advance payment deleted successfully!', 'success')
                            } catch (error: any) {
                              showToast(error.response?.data?.message || 'Failed to delete advance payment', 'error')
                            }
                          }
                        }}
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete Advance
                      </Button>
                    </div>
                  </div>
                  {showAdvanceApplications && (
                    <div className="mt-4 pt-4 border-t">
                      {loadingAdvanceApplications ? (
                        <div className="text-center py-4">Loading...</div>
                      ) : (
                        <div className="space-y-6">
                          {/* Advance Sources */}
                          <div>
                            <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Advance Sources
                            </h4>
                            {advanceSources && advanceSources.length > 0 ? (
                              <div className="space-y-2">
                                {advanceSources.map((source: any, index: number) => (
                                  <div
                                    key={index}
                                    className={cn(
                                      'p-3 border rounded-lg',
                                      source.type === 'explicit' ? 'bg-primary/5 border-primary/20' : 'bg-success/5 border-success/20'
                                    )}
                                  >
                                    <div className="flex justify-between items-start">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium text-sm">
                                            {source.type === 'explicit' ? 'Explicit Advance Payment' : `Overpayment from ${new Date(source.month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`}
                                          </span>
                                          <span className={cn(
                                            'text-xs px-2 py-0.5 rounded-full',
                                            source.type === 'explicit' ? 'bg-primary/20 text-primary' : 'bg-success/20 text-success'
                                          )}>
                                            {source.type === 'explicit' ? 'Future Payment' : 'Overpayment'}
                                          </span>
                                        </div>
                                        <div className="text-xs text-secondary mt-2 space-y-1">
                                          <div>
                                            <span className="font-medium">Advance Amount: </span>
                                            <span className="text-primary font-semibold">{maskCurrency(source.amount, false)}</span>
                                          </div>
                                          {source.type === 'overpayment' && (
                                            <>
                                              <div>
                                                Paid: {maskCurrency(source.paidAmount, false)} | Rent: {maskCurrency(source.rentAmount, false)}
                                              </div>
                                              <div>
                                                Extra: {maskCurrency(source.amount, false)} (became advance)
                                              </div>
                                            </>
                                          )}
                                          {source.type === 'explicit' && (
                                            <div>
                                              Total Paid: {maskCurrency(source.paidAmount, false)}
                                            </div>
                                          )}
                                          <div className="text-xs text-secondary">
                                            Date: {new Date(source.paymentDate).toLocaleDateString()}
                                          </div>
                                          {source.notes && (
                                            <div className="text-xs italic mt-1">{source.notes}</div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-4 text-secondary text-sm">
                                No advance sources found.
                              </div>
                            )}
                          </div>

                          {/* Advance Applications */}
                          <div className="pt-4 border-t">
                            <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Advance Applications (When Advance Was Used)
                            </h4>
                            {advanceApplications && advanceApplications.length > 0 ? (
                              <div className="space-y-2">
                                {advanceApplications.map((app: any) => (
                                  <div
                                    key={app._id}
                                    className="p-3 border rounded-lg bg-primary/5"
                                  >
                                    <div className="flex justify-between items-start">
                                      <div className="flex-1">
                                        <div className="font-medium text-sm">
                                          Applied to: {new Date(app.billingMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                        </div>
                                        <div className="text-xs text-secondary mt-1 space-y-1">
                                          <div>
                                            Amount Applied: <span className="font-medium text-success">{maskCurrency(app.advanceAmountApplied, false)}</span>
                                          </div>
                                          <div>
                                            Due Before: {maskCurrency(app.dueAmountBefore, false)} → Due After: {maskCurrency(app.dueAmountAfter, false)}
                                          </div>
                                          <div>
                                            Remaining Advance: {maskCurrency(app.remainingAdvance, false)}
                                          </div>
                                          <div className="text-xs text-secondary">
                                            Applied on: {new Date(app.createdAt).toLocaleString()}
                                          </div>
                                          {app.notes && (
                                            <div className="text-xs italic">{app.notes}</div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-4 text-secondary text-sm">
                                No advance applications recorded yet. Advance will be automatically applied when months have outstanding dues.
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  </>
                ) : (
                  <>
                    <div className="text-center py-4 text-secondary">
                      <p className="text-sm">No advance payment available</p>
                      <p className="text-xs mt-1">Advance payments will appear here when recorded</p>
                    </div>
                    {showAdvanceApplications && (
                      <div className="mt-4 pt-4 border-t">
                        {loadingAdvanceApplications ? (
                          <div className="text-center py-4">Loading...</div>
                        ) : (
                          <div className="space-y-6">
                            {/* Advance Sources */}
                            <div>
                              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Advance Sources
                              </h4>
                              {advanceSources && advanceSources.length > 0 ? (
                                <div className="space-y-2">
                                  {advanceSources.map((source: any, index: number) => (
                                    <div
                                      key={index}
                                      className={cn(
                                        'p-3 border rounded-lg',
                                        source.type === 'explicit' ? 'bg-primary/5 border-primary/20' : 'bg-success/5 border-success/20'
                                      )}
                                    >
                                      <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2">
                                            <span className="font-medium text-sm">
                                              {source.type === 'explicit' ? 'Explicit Advance Payment' : `Overpayment from ${new Date(source.month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`}
                                            </span>
                                            <span className={cn(
                                              'text-xs px-2 py-0.5 rounded-full',
                                              source.type === 'explicit' ? 'bg-primary/20 text-primary' : 'bg-success/20 text-success'
                                            )}>
                                              {source.type === 'explicit' ? 'Future Payment' : 'Overpayment'}
                                            </span>
                                          </div>
                                          <div className="text-xs text-secondary mt-2 space-y-1">
                                            <div>
                                              <span className="font-medium">Advance Amount: </span>
                                              <span className="text-primary font-semibold">{maskCurrency(source.amount, false)}</span>
                                            </div>
                                            {source.type === 'overpayment' && (
                                              <>
                                                <div>
                                                  Paid: {maskCurrency(source.paidAmount, false)} | Rent: {maskCurrency(source.rentAmount, false)}
                                                </div>
                                                <div>
                                                  Extra: {maskCurrency(source.amount, false)} (became advance)
                                                </div>
                                              </>
                                            )}
                                            {source.type === 'explicit' && (
                                              <div>
                                                Total Paid: {maskCurrency(source.paidAmount, false)}
                                              </div>
                                            )}
                                            <div className="text-xs text-secondary">
                                              Date: {new Date(source.paymentDate).toLocaleDateString()}
                                            </div>
                                            {source.notes && (
                                              <div className="text-xs italic mt-1">{source.notes}</div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-center py-4 text-secondary text-sm">
                                  No advance sources found.
                                </div>
                              )}
                            </div>

                            {/* Advance Applications */}
                            <div className="pt-4 border-t">
                              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Advance Applications (When Advance Was Used)
                              </h4>
                              {advanceApplications && advanceApplications.length > 0 ? (
                                <div className="space-y-2">
                                  {advanceApplications.map((app: any) => (
                                    <div
                                      key={app._id}
                                      className="p-3 border rounded-lg bg-primary/5"
                                    >
                                      <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                          <div className="font-medium text-sm">
                                            Applied to: {new Date(app.billingMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                          </div>
                                          <div className="text-xs text-secondary mt-1 space-y-1">
                                            <div>
                                              Amount Applied: <span className="font-medium text-success">{maskCurrency(app.advanceAmountApplied, false)}</span>
                                            </div>
                                            <div>
                                              Due Before: {maskCurrency(app.dueAmountBefore, false)} → Due After: {maskCurrency(app.dueAmountAfter, false)}
                                            </div>
                                            <div>
                                              Remaining Advance: {maskCurrency(app.remainingAdvance, false)}
                                            </div>
                                            <div className="text-xs text-secondary">
                                              Applied on: {new Date(app.createdAt).toLocaleString()}
                                            </div>
                                            {app.notes && (
                                              <div className="text-xs italic">{app.notes}</div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-center py-4 text-secondary text-sm">
                                  No advance applications recorded yet. Advance will be automatically applied when months have outstanding dues.
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Security Deposit Management Forms */}
        {showUseSecurityDeposit && (
          <Card>
            <CardHeader>
              <CardTitle>Use Security Deposit for Dues</CardTitle>
            </CardHeader>
            <CardContent>
              <UseSecurityDepositForm
                student={student}
                dueStatus={dueStatus}
                onSuccess={() => {
                  setShowUseSecurityDeposit(false)
                  queryClient.invalidateQueries({ queryKey: ['student', studentId] })
                  queryClient.invalidateQueries({ queryKey: ['student-due-status', studentId] })
                }}
                onCancel={() => setShowUseSecurityDeposit(false)}
              />
            </CardContent>
          </Card>
        )}

        {showReturnSecurityDeposit && (
          <Card>
            <CardHeader>
              <CardTitle>Return Security Deposit</CardTitle>
            </CardHeader>
            <CardContent>
              <ReturnSecurityDepositForm
                student={student}
                onSuccess={() => {
                  setShowReturnSecurityDeposit(false)
                  queryClient.invalidateQueries({ queryKey: ['student', studentId] })
                }}
                onCancel={() => setShowReturnSecurityDeposit(false)}
              />
            </CardContent>
          </Card>
        )}

        {showReactivateForm && student && (
          <Card>
            <CardHeader>
              <CardTitle>Reactivate Student</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const formData = new FormData(e.currentTarget)
                  const roomId = formData.get('roomId') as string
                  const bedNumber = formData.get('bedNumber') as string
                  const joiningDate = formData.get('joiningDate') as string
                  const monthlyRent = formData.get('monthlyRent') as string
                  const securityDeposit = formData.get('securityDeposit') as string

                  const selectedRoom = rooms?.find((r: any) => r._id === roomId)
                  const selectedBed = selectedRoom?.beds?.find((b: any) => b.name === bedNumber || String(b) === bedNumber)

                  reactivateMutation.mutate({
                    roomId,
                    bedName: selectedBed?.name ? bedNumber : undefined,
                    bedNumber: selectedBed?.name ? undefined : parseInt(bedNumber),
                    joiningDate,
                    monthlyRent: monthlyRent ? parseFloat(monthlyRent) : undefined,
                    securityDeposit: securityDeposit ? parseFloat(securityDeposit) : undefined,
                  })
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="reactivate-roomId">Room *</Label>
                    <Select
                      id="reactivate-roomId"
                      name="roomId"
                      value={reactivateRoomId}
                      onChange={(e) => {
                        setReactivateRoomId(e.target.value)
                        // Reset bed selection when room changes
                        const bedSelect = document.getElementById('reactivate-bedNumber') as HTMLSelectElement
                        if (bedSelect) bedSelect.value = ''
                      }}
                      required
                    >
                      <option value="">Select Room</option>
                      {rooms?.map((room: any) => (
                        <option key={room._id} value={room._id}>
                          {room.name} ({room.occupiedBeds}/{room.totalBeds} occupied)
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reactivate-bedNumber">Bed *</Label>
                    <Select id="reactivate-bedNumber" name="bedNumber" required>
                      <option value="">Select Bed</option>
                      {rooms
                        ?.find((r: any) => r._id === reactivateRoomId)
                        ?.beds?.filter((bed: any) => !bed.isOccupied)
                        .map((bed: any, index: number) => (
                          <option key={bed.name || index} value={bed.name || (index + 1)}>
                            {bed.name || `Bed ${index + 1}`} {bed.price ? `(${bed.price.toLocaleString()} BDT)` : ''}
                          </option>
                        ))}
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reactivate-joiningDate">New Joining Date *</Label>
                    <Input
                      id="reactivate-joiningDate"
                      name="joiningDate"
                      type="date"
                      defaultValue={new Date().toISOString().split('T')[0]}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reactivate-monthlyRent">Monthly Rent (BDT)</Label>
                    <Input
                      id="reactivate-monthlyRent"
                      name="monthlyRent"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Auto-filled from bed price"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reactivate-securityDeposit">Security Deposit (BDT)</Label>
                    <Input
                      id="reactivate-securityDeposit"
                      name="securityDeposit"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={student.securityDeposit || 0}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={reactivateMutation.isPending}>
                    {reactivateMutation.isPending ? 'Reactivating...' : 'Reactivate Student'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowReactivateForm(false)
                      setReactivateRoomId('')
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Payment History (Calendar View)</CardTitle>
              <Button onClick={() => setShowPaymentForm(!showPaymentForm)}>
                {showPaymentForm ? 'Cancel' : 'Add Payment'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {showPaymentForm && (
              <div className="mb-6 p-4 border border-border rounded-md">
                <form onSubmit={handleSubmit(onPaymentSubmit)} className="space-y-4">
                  <div className="flex items-center gap-2 mb-4 p-3 bg-primary/5 rounded-md">
                    <input
                      type="checkbox"
                      id="isAdvance"
                      {...register('isAdvance')}
                      className="w-4 h-4"
                    />
                    <Label htmlFor="isAdvance" className="cursor-pointer font-medium">
                      Record as Advance Payment (for future months)
                    </Label>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="billingMonth">
                        {watch('isAdvance') ? 'Reference Month (Optional)' : 'Billing Month *'}
                      </Label>
                      <Input
                        id="billingMonth"
                        type="month"
                        {...register('billingMonth')}
                        disabled={watch('isAdvance')}
                        min={student?.joiningDate ? new Date(student.joiningDate).toISOString().slice(0, 7) : undefined}
                      />
                      {watch('isAdvance') && (
                        <p className="text-xs text-secondary">
                          Advance payments will be applied to future months automatically
                        </p>
                      )}
                      {errors.billingMonth && (
                        <p className="text-sm text-danger">{errors.billingMonth.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="paidAmount">Paid Amount (BDT) *</Label>
                      <Input
                        id="paidAmount"
                        type="number"
                        min="0"
                        step="0.01"
                        {...register('paidAmount')}
                      />
                      {errors.paidAmount && (
                        <p className="text-sm text-danger">{errors.paidAmount.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="paymentMethod">Payment Method *</Label>
                      <Select
                        id="paymentMethod"
                        {...register('paymentMethod')}
                      >
                        <option value="cash">Cash</option>
                        <option value="bkash">Bkash</option>
                        <option value="bank">Bank</option>
                      </Select>
                      {errors.paymentMethod && (
                        <p className="text-sm text-danger">{errors.paymentMethod.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="transactionId">Transaction ID</Label>
                      <Input
                        id="transactionId"
                        {...register('transactionId')}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Input
                      id="notes"
                      {...register('notes')}
                    />
                  </div>
                  <Button type="submit" disabled={paymentMutation.isPending}>
                    {paymentMutation.isPending ? 'Processing...' : 'Record Payment'}
                  </Button>
                </form>
              </div>
            )}

            {dueStatus && (
              <>
                <PaymentCalendar
                  payments={dueStatus.payments}
                  student={student}
                  monthlyRent={student.monthlyRent}
                  totalAdvance={dueStatus.totalAdvance || 0}
                  selectedMonth={new Date(selectedBillingMonth + '-01')}
                  onMonthSelect={handleMonthSelect}
                />
                
                {/* Payment List View */}
                <div className="mt-6 space-y-2">
                  <h4 className="font-semibold text-sm mb-3">Monthly Payment Summary</h4>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {dueStatus.payments.map((payment: any) => (
                      <div
                        key={payment.month}
                        className={cn(
                          'p-3 border rounded-lg',
                          payment.status === 'paid'
                            ? payment.advanceApplied && payment.advanceApplied > 0
                              ? 'bg-primary/5 border-primary/30'
                              : 'bg-success/5 border-success/30'
                            : payment.status === 'partial'
                            ? 'bg-warning/5 border-warning/30'
                            : 'bg-danger/5 border-danger/30'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">
                                {new Date(payment.month + '-01').toLocaleDateString('en-US', {
                                  month: 'long',
                                  year: 'numeric',
                                })}
                              </span>
                              {payment.advanceApplied && payment.advanceApplied > 0 && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 font-medium flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                  </svg>
                                  Advance Paid
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-secondary mt-1 space-y-0.5">
                              <div>
                                Rent: {maskCurrency(payment.rentAmount, user?.role === 'staff')}
                              </div>
                              <div>
                                Paid: {maskCurrency(payment.paidAmount, user?.role === 'staff')}
                                {payment.advanceApplied && payment.advanceApplied > 0 && (
                                  <span className="text-primary ml-1">
                                    (Advance: {maskCurrency(payment.advanceApplied, user?.role === 'staff')})
                                  </span>
                                )}
                              </div>
                              {payment.dueAmount > 0 && (
                                <div className="text-danger">
                                  Due: {maskCurrency(payment.dueAmount, user?.role === 'staff')}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <span
                              className={cn(
                                'text-xs px-2 py-1 rounded-full font-medium',
                                payment.status === 'paid'
                                  ? payment.advanceApplied && payment.advanceApplied > 0
                                    ? 'bg-primary/20 text-primary'
                                    : 'bg-success/20 text-success'
                                  : payment.status === 'partial'
                                  ? 'bg-warning/20 text-warning'
                                  : 'bg-danger/20 text-danger'
                              )}
                            >
                              {payment.status === 'paid'
                                ? payment.advanceApplied && payment.advanceApplied > 0
                                  ? 'Paid (Advance)'
                                  : 'Paid'
                                : payment.status === 'partial'
                                ? 'Partial'
                                : 'Unpaid'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  )
}
