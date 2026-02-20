'use client'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import api from '@/lib/api'
import { showToast } from '@/lib/toast'
import { bulkPaymentSchema } from '@/lib/validations'
import { useAuthStore } from '@/store/auth-store'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'

interface Student {
  _id: string
  studentId: string
  name: string
  monthlyRent: number
  roomId?: {
    _id: string
    name: string
  }
}

interface QuickPaymentModalProps {
  student?: Student | null
  isOpen: boolean
  onClose: () => void
}

type PaymentFormData = {
  rentAmount?: string
  securityAmount?: string
  unionFeeAmount?: string
  otherAmount?: string
  billingMonth?: string
  paymentMethod: 'cash' | 'bkash' | 'bank'
  transactionId?: string
  notes?: string
  isAdvance?: boolean
  paymentDate?: string
}

export function QuickPaymentModal({ student: initialStudent, isOpen, onClose }: QuickPaymentModalProps) {
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const [activeStudent, setActiveStudent] = useState<Student | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Student[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isPaid, setIsPaid] = useState(false)
  const [isCheckingStatus, setIsCheckingStatus] = useState(false)
  
  // Confirmation state
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingData, setPendingData] = useState<PaymentFormData | null>(null)

  useEffect(() => {
    setActiveStudent(initialStudent || null)
    if (!initialStudent) {
      setSearchQuery('')
      setSearchResults([])
    }
  }, [initialStudent, isOpen])

  // Search logic
  useEffect(() => {
    const searchStudents = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([])
        return
      }
      setIsSearching(true)
      try {
        const response = await api.get('/residential/students', {
          params: { search: searchQuery, limit: 10, status: 'active' }
        })
        const students: Student[] = response.data.data || []

        // Client-side Sort: 
        // 1. Exact Room Match (Top Priority)
        // 2. Room Name (Numeric Sort)
        students.sort((a, b) => {
          const roomA = a.roomId?.name || ''
          const roomB = b.roomId?.name || ''
          
          const aMatchesRoom = roomA.toLowerCase() === searchQuery.toLowerCase()
          const bMatchesRoom = roomB.toLowerCase() === searchQuery.toLowerCase()

          if (aMatchesRoom && !bMatchesRoom) return -1
          if (!aMatchesRoom && bMatchesRoom) return 1

          return roomA.localeCompare(roomB, undefined, { numeric: true })
        })

        setSearchResults(students)
      } catch (error) {
        console.error('Search failed', error)
      } finally {
        setIsSearching(false)
      }
    }

    const timer = setTimeout(searchStudents, 400)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<PaymentFormData>({
    resolver: zodResolver(bulkPaymentSchema),
    defaultValues: {
      billingMonth: new Date().toISOString().slice(0, 7),
      paymentMethod: 'cash',
      isAdvance: false,
    },
  })

  useEffect(() => {
    if (activeStudent && isOpen) {
      reset({
        rentAmount: activeStudent.monthlyRent.toString(),
        billingMonth: new Date().toISOString().slice(0, 7),
        paymentMethod: 'cash',
        isAdvance: false,
        paymentDate: new Date().toISOString().split('T')[0],
      })
      setIsPaid(false)
    }
  }, [activeStudent, isOpen, reset])

  // Check if month is already paid
  const selectedMonth = watch('billingMonth')
  const isAdvanceChecked = watch('isAdvance')

  useEffect(() => {
    const checkPaymentStatus = async () => {
      if (!activeStudent || !selectedMonth || isAdvanceChecked) {
        setIsPaid(false)
        return
      }

      setIsCheckingStatus(true)
      try {
        const response = await api.get(`/residential/students/${activeStudent._id}/payment-status`, {
          params: { month: selectedMonth }
        })
        setIsPaid(response.data.isPaid)
      } catch (error) {
        console.error('Failed to check payment status', error)
      } finally {
        setIsCheckingStatus(false)
      }
    }

    checkPaymentStatus()
  }, [activeStudent, selectedMonth, isAdvanceChecked])

  const rentAmountInput = watch('rentAmount')
  const isAdmin = user?.role === 'admin'
  const isStaff = user?.role === 'staff'

  const currentMonthStr = new Date().toISOString().slice(0, 7)
  const isFutureMonth = selectedMonth ? selectedMonth > currentMonthStr : false
  const isOverPaying = activeStudent && rentAmountInput ? parseFloat(rentAmountInput) > activeStudent.monthlyRent : false

  // Validation logic for button
  const isBlocked = isStaff && (isAdvanceChecked || isFutureMonth || isOverPaying || isPaid)

  const paymentMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/residential/payments/bulk', data)
      return response.data
    },
  })

  const onSubmit = (data: PaymentFormData) => {
    if (!activeStudent) return
    setPendingData(data)
    setShowConfirm(true)
  }

  const handleConfirmPayment = async () => {
    if (!activeStudent || !pendingData) return

    try {
      await paymentMutation.mutateAsync({
        studentId: activeStudent._id,
        rentAmount: pendingData.rentAmount ? parseFloat(pendingData.rentAmount) : 0,
        securityAmount: pendingData.securityAmount ? parseFloat(pendingData.securityAmount) : 0,
        unionFeeAmount: pendingData.unionFeeAmount ? parseFloat(pendingData.unionFeeAmount) : 0,
        otherAmount: pendingData.otherAmount ? parseFloat(pendingData.otherAmount) : 0,
        billingMonth: pendingData.rentAmount && parseFloat(pendingData.rentAmount) > 0 && !pendingData.isAdvance ? pendingData.billingMonth : undefined,
        paymentMethod: pendingData.paymentMethod,
        transactionId: pendingData.transactionId,
        notes: pendingData.notes || 'Quick Payment',
        isAdvance: pendingData.isAdvance,
        paymentDate: pendingData.paymentDate,
      })

      // Success handling
      queryClient.invalidateQueries({ queryKey: ['student-due-status', activeStudent?._id] })
      queryClient.invalidateQueries({ queryKey: ['students'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      
      showToast(`Payment recorded for ${activeStudent?.name}`, 'success')
      setShowConfirm(false) // Close confirmation modal
      onClose() // Close main modal
      reset() // Reset form
      setPendingData(null)
    } catch (error: any) {
      console.error('Payment failed', error)
      showToast(error.response?.data?.message || 'Failed to record payment', 'error')
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {activeStudent ? `Quick Payment - ${activeStudent.name}` : 'Find Student for Quick Rent'}
          </DialogTitle>
        </DialogHeader>

        {!activeStudent ? (
          <div className="space-y-4 pt-4">
            <div className="relative">
              <Input
                placeholder="Search by name, ID, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              {isSearching && (
                <div className="absolute right-3 top-3">
                  <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              )}
            </div>

            <div className="max-h-[300px] overflow-y-auto space-y-2">
              {searchResults.length > 0 ? (
                searchResults.map((s) => (
                  <button
                    key={s._id}
                    className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-primary/5 hover:border-primary/30 transition-all text-left"
                    onClick={() => setActiveStudent(s)}
                  >
                    <div>
                      <p className="font-semibold text-sm">{s.name}</p>
                      <div className="flex gap-2 text-xs text-secondary">
                        <span>ID: {s.studentId}</span>
                        {s.roomId && (
                           <span className="font-medium text-primary">Room: {s.roomId.name}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-primary">{s.monthlyRent} BDT</p>
                    </div>
                  </button>
                ))
              ) : searchQuery.length >= 2 && !isSearching ? (
                <p className="text-center py-4 text-sm text-secondary">No students found</p>
              ) : (
                <p className="text-center py-4 text-sm text-secondary">Start typing to search active students</p>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
            {/* Back button if it was a search */}
            {!initialStudent && (
              <Button 
                variant="ghost" 
                size="sm" 
                type="button" 
                onClick={() => setActiveStudent(null)}
                className="mb-2 -ml-2 h-8 text-secondary hover:text-primary"
              >
                ← Change Student
              </Button>
            )}
            
            {/* Student Info */}
            <div className="bg-muted/30 p-3 rounded-lg border">
              <div className="font-bold">{activeStudent.name}</div>
              <div className="text-sm text-secondary">ID: {activeStudent.studentId}</div>
              {activeStudent.roomId && (
                <div className="text-xs text-secondary mt-1">
                  Room: {activeStudent.roomId.name}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
                 {/* Admin Only: Backdate Payment */}
                 {user?.role === 'admin' && (
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="paymentDate">Payment Date (Backdate)</Label>
                    <Input
                      id="paymentDate"
                      type="date"
                      {...register('paymentDate')}
                      defaultValue={new Date().toISOString().split('T')[0]}
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Leave as today for normal payments, or select a past date.
                    </p>
                  </div>
                )}
                
              <div className="space-y-2">
                <Label htmlFor="rentAmount">Rent Amount (BDT)</Label>
                <Input
                  id="rentAmount"
                  type="number"
                  {...register('rentAmount')}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="securityAmount">Security Deposit</Label>
                <Input
                  id="securityAmount"
                  type="number"
                  {...register('securityAmount')}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="unionFeeAmount">Union Fee</Label>
                <Input
                  id="unionFeeAmount"
                  type="number"
                  {...register('unionFeeAmount')}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="otherAmount">Other Fee</Label>
                <Input
                  id="otherAmount"
                  type="number"
                  {...register('otherAmount')}
                  placeholder="0.00"
                />
              </div>
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-md">
                <input
                  type="checkbox"
                  id="isAdvance"
                  {...register('isAdvance')}
                  className="w-4 h-4"
                />
                <Label htmlFor="isAdvance" className="cursor-pointer font-medium text-sm">
                  Record Rent as Advance Payment
                </Label>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="billingMonth">Billing Month</Label>
                <Input
                  id="billingMonth"
                  type="month"
                  {...register('billingMonth')}
                  disabled={watch('isAdvance')}
                  max={isStaff ? currentMonthStr : undefined}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Method</Label>
                <Select id="paymentMethod" {...register('paymentMethod')}>
                  <option value="cash">Cash</option>
                  <option value="bkash">Bkash</option>
                  <option value="bank">Bank</option>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="transactionId">Transaction ID (Optional)</Label>
              <Input id="transactionId" {...register('transactionId')} />
            </div>

            {isPaid && isAdmin && (
              <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg animate-pulse">
                <p className="text-sm font-semibold text-warning">
                  ⚠️ Student has already paid for this month&apos;s rent. Are you sure you want to take money again?
                </p>
              </div>
            )}

            {isPaid && isStaff && (
              <div className="p-3 bg-danger/10 border border-danger/30 rounded-lg">
                <p className="text-sm font-semibold text-danger">
                  ❌ Rent for this month is already paid. Staff cannot record duplicate payments.
                </p>
              </div>
            )}

            {isStaff && isOverPaying && (
              <div className="p-3 bg-danger/10 border border-danger/30 rounded-lg">
                <p className="text-sm font-semibold text-danger">
                  ❌ Staff cannot take payment greater than the monthly rent.
                </p>
              </div>
            )}

            {isStaff && isFutureMonth && (
              <div className="p-3 bg-danger/10 border border-danger/30 rounded-lg">
                <p className="text-sm font-semibold text-danger">
                  ❌ Staff cannot record payments for future months.
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="outline" type="button" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={paymentMutation.isPending || isCheckingStatus || isBlocked} 
                className="flex-1"
              >
                {paymentMutation.isPending ? 'Recording...' : 'Record Payment'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>

      <ConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        onConfirm={handleConfirmPayment}
        title="Confirm Payment"
        description={
          <div className="space-y-2">
            <p>Are you sure you want to record this payment?</p>
            <div className="bg-muted p-3 rounded-md text-sm">
              <div className="flex justify-between">
                <span>Student:</span>
                <span className="font-medium">{activeStudent?.name}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span>Amount:</span>
                <span className="font-medium">
                  {(
                    (pendingData?.rentAmount ? parseFloat(pendingData.rentAmount) : 0) +
                    (pendingData?.securityAmount ? parseFloat(pendingData.securityAmount) : 0) +
                    (pendingData?.unionFeeAmount ? parseFloat(pendingData.unionFeeAmount) : 0) +
                    (pendingData?.otherAmount ? parseFloat(pendingData.otherAmount) : 0)
                  ).toLocaleString()} BDT
                </span>
              </div>
              <div className="flex justify-between mt-1">
                <span>Method:</span>
                <span className="font-medium capitalize">{pendingData?.paymentMethod}</span>
              </div>
               {pendingData?.isAdvance && (
                <div className="mt-2 text-xs text-primary font-medium">
                  * Marked as Advance Payment
                </div>
              )}
               {pendingData?.paymentDate && (
                <div className="mt-2 text-xs text-secondary font-medium border-t pt-1">
                  Payment Date: {new Date(pendingData.paymentDate).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        }
        confirmText="Confirm Payment"
        isLoading={paymentMutation.isPending}
      />
    </Dialog>
  )
}
