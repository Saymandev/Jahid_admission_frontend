'use client'

import { ProtectedRoute } from '@/components/protected-route'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import api from '@/lib/api'
import { exportStudentLedger } from '@/lib/pdf-export'
import { showToast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'

interface TransactionDetails {
  _id: string
  type: 'residential' | 'coaching'
  studentId?: {
    _id: string
    name: string
    studentId: string
    phone: string
    roomId?: {
      name: string
    }
  }
  admissionId?: {
    _id: string
    studentName: string
    course: string
    batch: string
    phone: string
  }
  billingMonth?: string
  rentAmount?: number
  paidAmount: number
  dueAmount?: number
  advanceAmount?: number
  paymentMethod: string
  transactionId?: string
  notes?: string
  recordedBy?: {
    name: string
    email: string
  }
  paymentDate?: string
  createdAt: string
  updatedAt: string
}

export default function TransactionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const transactionId = params.id as string

  const { data: transaction, isLoading } = useQuery({
    queryKey: ['transaction', transactionId],
    queryFn: async () => {
      // Try to find in residential payments first
      try {
        const residentialResponse = await api.get('/residential/payments?limit=100')
        // Residential returns paginated response { data: [...], total: ... }
        const payments = residentialResponse.data.data || []
        const found = payments.find((p: any) => p._id === transactionId)
        if (found) {
          return { ...found, type: 'residential' as const }
        }
      } catch (error) {
        console.error('Error fetching residential payments:', error)
      }

      // Try coaching payments
      try {
        const coachingResponse = await api.get('/coaching/payments')
        const found = coachingResponse.data.find((p: any) => p._id === transactionId)
        if (found) {
          return { ...found, type: 'coaching' as const }
        }
      } catch (error) {
        console.error('Error fetching coaching payments:', error)
      }

      throw new Error('Transaction not found')
    },
  })

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

  if (!transaction) {
    return (
      <ProtectedRoute>
        <div className="p-6">
          <Card>
            <CardContent className="p-12 text-center">
              <div className="text-6xl mb-4">❌</div>
              <h3 className="text-lg font-semibold mb-2">Transaction not found</h3>
              <Button onClick={() => router.push('/dashboard/transactions')}>
                Back to Transactions
              </Button>
            </CardContent>
          </Card>
        </div>
      </ProtectedRoute>
    )
  }

  const txn = transaction as TransactionDetails
  const studentName = txn.type === 'residential' 
    ? txn.studentId?.name 
    : txn.admissionId?.studentName

  return (
    <ProtectedRoute>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Transaction Details</h1>
            <p className="text-secondary mt-1">View complete payment information</p>
          </div>
          <Button variant="outline" onClick={() => router.push('/dashboard/transactions')}>
            ← Back to Transactions
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">{txn.type === 'residential' ? '🏠' : '📚'}</span>
                Payment Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-secondary">Transaction ID</span>
                <span className="font-medium">{txn._id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">Type</span>
                <span
                  className={cn(
                    'px-2 py-1 rounded text-xs font-medium',
                    txn.type === 'residential'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-orange-100 text-orange-700'
                  )}
                >
                  {txn.type === 'residential' ? 'Residential' : 'Coaching'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">Student Name</span>
                <span className="font-medium">{studentName || 'N/A'}</span>
              </div>
              {txn.type === 'residential' && txn.studentId && (
                <>
                  <div className="flex justify-between">
                    <span className="text-secondary">Student ID</span>
                    <span className="font-medium">{txn.studentId.studentId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary">Room</span>
                    <span className="font-medium">{txn.studentId.roomId?.name || 'N/A'}</span>
                  </div>
                  {txn.billingMonth && (
                    <div className="flex justify-between">
                      <span className="text-secondary">Billing Month</span>
                      <span className="font-medium">{txn.billingMonth}</span>
                    </div>
                  )}
                </>
              )}
              {txn.type === 'coaching' && txn.admissionId && (
                <>
                  <div className="flex justify-between">
                    <span className="text-secondary">Course</span>
                    <span className="font-medium">{txn.admissionId.course}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary">Batch</span>
                    <span className="font-medium">{txn.admissionId.batch}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Financial Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {txn.type === 'residential' && txn.rentAmount !== undefined && (
                <div className="flex justify-between">
                  <span className="text-secondary">Monthly Rent</span>
                  <span className="font-medium">{txn.rentAmount.toLocaleString()} BDT</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-secondary">Paid Amount</span>
                <span className="font-bold text-lg text-success">
                  {txn.paidAmount.toLocaleString()} BDT
                </span>
              </div>
              {txn.dueAmount !== undefined && (
                <div className="flex justify-between">
                  <span className="text-secondary">Due Amount</span>
                  <span className={cn('font-medium', txn.dueAmount > 0 ? 'text-danger' : 'text-success')}>
                    {txn.dueAmount.toLocaleString()} BDT
                  </span>
                </div>
              )}
              {txn.advanceAmount !== undefined && txn.advanceAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-secondary">Advance Amount</span>
                  <span className="font-medium text-success">
                    {txn.advanceAmount.toLocaleString()} BDT
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-secondary">Payment Method</span>
                <span className="font-medium capitalize">{txn.paymentMethod}</span>
              </div>
              {txn.transactionId && (
                <div className="flex justify-between">
                  <span className="text-secondary">Transaction ID</span>
                  <span className="font-medium">{txn.transactionId}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-secondary">Payment Date</span>
                <span className="font-medium">
                  {new Date(txn.paymentDate || txn.createdAt).toLocaleDateString()}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Additional Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {txn.notes && (
                <div>
                  <span className="text-secondary block mb-2">Notes</span>
                  <p className="font-medium">{txn.notes}</p>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-secondary">Recorded By</span>
                <span className="font-medium">{txn.recordedBy?.name || 'System'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">Recorded Date</span>
                <span className="font-medium">
                  {new Date(txn.createdAt).toLocaleString()}
                </span>
              </div>
              {txn.updatedAt && txn.updatedAt !== txn.createdAt && (
                <div className="flex justify-between">
                  <span className="text-secondary">Last Updated</span>
                  <span className="font-medium">
                    {new Date(txn.updatedAt).toLocaleString()}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {txn.type === 'residential' && txn.studentId && (
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push(`/dashboard/students/${txn.studentId?._id}`)}
                >
                  View Student Details
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    if (txn.studentId) {
                      // Create a payment entry from transaction for the ledger
                      const paymentEntry = {
                        month: txn.billingMonth || new Date(txn.createdAt).toISOString().slice(0, 7),
                        rentAmount: txn.rentAmount || 0,
                        paidAmount: txn.paidAmount || 0,
                        dueAmount: txn.dueAmount || 0,
                        advanceAmount: txn.advanceAmount || 0,
                        status: txn.dueAmount && txn.dueAmount > 0 ? 'partial' : 'paid',
                      }
                      exportStudentLedger(txn.studentId, [paymentEntry])
                      showToast('Receipt exported successfully!', 'success')
                    }
                  }}
                >
                  Export Receipt
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}
