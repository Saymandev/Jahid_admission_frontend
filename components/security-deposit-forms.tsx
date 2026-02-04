'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { showToast } from '@/lib/toast'
import { useState } from 'react'

export function UseSecurityDepositForm({ student, dueStatus, onSuccess, onCancel }: any) {
  const [billingMonth, setBillingMonth] = useState(new Date().toISOString().slice(0, 7))
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post(`/residential/students/${student._id}/security-deposit/use`, data)
      return response.data
    },
    onSuccess: () => {
      showToast('Security deposit used successfully!', 'success')
      queryClient.invalidateQueries({ queryKey: ['student', student._id] })
      queryClient.invalidateQueries({ queryKey: ['student-due-status', student._id] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      onSuccess()
    },
    onError: (error: any) => {
      showToast(error.response?.data?.message || 'Failed to use security deposit', 'error')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const amountNum = parseFloat(amount)
    if (amountNum <= 0 || amountNum > student.securityDeposit) {
      showToast('Invalid amount', 'error')
      return
    }
    mutation.mutate({
      billingMonth,
      amount: amountNum,
      notes,
    })
  }

  const maxAmount = Math.min(student.securityDeposit, dueStatus?.totalDue || 0)

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="billingMonth">Billing Month *</Label>
        <Input
          id="billingMonth"
          type="month"
          value={billingMonth}
          onChange={(e) => setBillingMonth(e.target.value)}
          min={student?.joiningDate ? new Date(student.joiningDate).toISOString().slice(0, 7) : undefined}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="amount">Amount (BDT) *</Label>
        <Input
          id="amount"
          type="number"
          min="0"
          max={student.securityDeposit}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={`Max: ${maxAmount.toLocaleString()} BDT`}
          required
        />
        <p className="text-xs text-secondary">
          Available: {student.securityDeposit.toLocaleString()} BDT | 
          Due: {dueStatus?.totalDue?.toLocaleString() || 0} BDT
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Input
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes..."
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Processing...' : 'Use Security Deposit'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

export function ReturnSecurityDepositForm({ student, onSuccess, onCancel }: any) {
  const [amount, setAmount] = useState(student.securityDeposit.toString())
  const [notes, setNotes] = useState('')
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post(`/residential/students/${student._id}/security-deposit/return`, data)
      return response.data
    },
    onSuccess: () => {
      showToast('Security deposit returned successfully!', 'success')
      queryClient.invalidateQueries({ queryKey: ['student', student._id] })
      onSuccess()
    },
    onError: (error: any) => {
      showToast(error.response?.data?.message || 'Failed to return security deposit', 'error')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const amountNum = parseFloat(amount)
    if (amountNum <= 0 || amountNum > student.securityDeposit) {
      showToast('Invalid amount', 'error')
      return
    }
    mutation.mutate({
      amount: amountNum,
      notes,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="returnAmount">Amount to Return (BDT) *</Label>
        <Input
          id="returnAmount"
          type="number"
          min="0"
          max={student.securityDeposit}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={`Max: ${student.securityDeposit.toLocaleString()} BDT`}
          required
        />
        <p className="text-xs text-secondary">
          Available: {student.securityDeposit.toLocaleString()} BDT
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="returnNotes">Notes</Label>
        <Input
          id="returnNotes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes (e.g., reason for return)..."
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Processing...' : 'Return Security Deposit'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
