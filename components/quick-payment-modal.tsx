'use client'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import api from '@/lib/api'
import { showToast } from '@/lib/toast'
import { bulkPaymentSchema } from '@/lib/validations'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'

interface Student {
  _id: string
  studentId: string
  name: string
  monthlyRent: number
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
}

export function QuickPaymentModal({ student: initialStudent, isOpen, onClose }: QuickPaymentModalProps) {
  const queryClient = useQueryClient()
  const [activeStudent, setActiveStudent] = useState<Student | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Student[]>([])
  const [isSearching, setIsSearching] = useState(false)

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
        setSearchResults(response.data.data || [])
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
      })
    }
  }, [activeStudent, isOpen, reset])

  const paymentMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/residential/payments/bulk', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-due-status', activeStudent?._id] })
      queryClient.invalidateQueries({ queryKey: ['students'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      showToast(`Payment recorded for ${activeStudent?.name}`, 'success')
      onClose()
      reset()
    },
    onError: (error: any) => {
      showToast(error.response?.data?.message || 'Failed to record payment', 'error')
    },
  })

  const onSubmit = (data: PaymentFormData) => {
    if (!activeStudent) return

    paymentMutation.mutate({
      studentId: activeStudent._id,
      rentAmount: data.rentAmount ? parseFloat(data.rentAmount) : 0,
      securityAmount: data.securityAmount ? parseFloat(data.securityAmount) : 0,
      unionFeeAmount: data.unionFeeAmount ? parseFloat(data.unionFeeAmount) : 0,
      otherAmount: data.otherAmount ? parseFloat(data.otherAmount) : 0,
      billingMonth: data.rentAmount && parseFloat(data.rentAmount) > 0 && !data.isAdvance ? data.billingMonth : undefined,
      paymentMethod: data.paymentMethod,
      transactionId: data.transactionId,
      notes: data.notes || 'Quick Payment',
      isAdvance: data.isAdvance,
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
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
                      <p className="text-xs text-secondary">ID: {s.studentId}</p>
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
            
            <div className="grid grid-cols-2 gap-4">
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="billingMonth">Billing Month</Label>
                <Input
                  id="billingMonth"
                  type="month"
                  {...register('billingMonth')}
                  disabled={watch('isAdvance')}
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

            <div className="flex gap-3 pt-2">
              <Button variant="outline" type="button" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" disabled={paymentMutation.isPending} className="flex-1">
                {paymentMutation.isPending ? 'Recording...' : 'Record Payment'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
