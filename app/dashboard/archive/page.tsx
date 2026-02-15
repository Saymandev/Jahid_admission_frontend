'use client'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { ProtectedRoute } from '@/components/protected-route'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import api from '@/lib/api'
import { maskCurrency } from '@/lib/mask-value'
import { showToast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

export default function ArchivePage() {
  const user = useAuthStore((state) => state.user)
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'students' | 'rooms' | 'admissions' | 'transactions'>('students')
  const [searchQuery, setSearchQuery] = useState('')
  const [
    restoreId,
    setRestoreId,
  ] = useState<string | null>(null)
  const [restoreType, setRestoreType] = useState<'student' | 'room' | 'admission' | 'payment' | null>(null)

  // Students Query
  const { data: students, isLoading: loadingStudents } = useQuery({
    queryKey: ['archived-students'],
    queryFn: async () => {
      const res = await api.get('/residential/students/archived')
      return res.data
    },
    enabled: activeTab === 'students',
  })

  // Rooms Query
  const { data: rooms, isLoading: loadingRooms } = useQuery({
    queryKey: ['archived-rooms'],
    queryFn: async () => {
      const res = await api.get('/residential/rooms/archived')
      return res.data
    },
    enabled: activeTab === 'rooms',
  })

  // Admissions Query
  const { data: admissions, isLoading: loadingAdmissions } = useQuery({
    queryKey: ['archived-admissions'],
    queryFn: async () => {
      const res = await api.get('/coaching/admissions/archived')
      return res.data
    },
    enabled: activeTab === 'admissions',
  })

  // Transactions Query
  const { data: transactions, isLoading: loadingTransactions } = useQuery({
    queryKey: ['archived-transactions'],
    queryFn: async () => {
      const res = await api.get('/residential/transactions', {
        params: { onlyDeleted: true }
      })
      return res.data.data // Pagination structure
    },
    enabled: activeTab === 'transactions',
  })

  // Restore Mutation
  const restoreMutation = useMutation({
    mutationFn: async ({ id, type }: { id: string; type: 'student' | 'room' | 'admission' | 'payment' }) => {
      let endpoint = ''
      if (type === 'student') endpoint = `/residential/students/${id}/restore`
      if (type === 'room') endpoint = `/residential/rooms/${id}/restore`
      if (type === 'admission') endpoint = `/coaching/admissions/${id}/restore`
      if (type === 'payment') endpoint = `/residential/payments/${id}/restore`
      
      const res = await api.post(endpoint)
      return res.data
    },
    onSuccess: () => {
      showToast('Restored successfully!', 'success')
      setRestoreId(null)
      setRestoreType(null)
      queryClient.invalidateQueries({ queryKey: [`archived-${activeTab}`] })
      // Also invalidate main lists to show restored items
      if (activeTab === 'students') queryClient.invalidateQueries({ queryKey: ['students'] })
      if (activeTab === 'rooms') queryClient.invalidateQueries({ queryKey: ['rooms'] })
      if (activeTab === 'admissions') queryClient.invalidateQueries({ queryKey: ['admissions'] })
      if (activeTab === 'transactions') queryClient.invalidateQueries({ queryKey: ['transactions'] })
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Failed to restore', 'error')
    }
  })

  const handleRestore = (id: string, type: 'student' | 'room' | 'admission' | 'payment') => {
    setRestoreId(id)
    setRestoreType(type)
  }

  const filteredData = (data: any[]) => {
    if (!data) return []
    if (!searchQuery) return data
    const lower = searchQuery.toLowerCase()
    return data.filter(item => {
      return Object.values(item).some(val => 
        String(val).toLowerCase().includes(lower)
      )
    })
  }

  if (user?.role !== 'admin') {
    return (
      <ProtectedRoute>
        <div className="p-6">You don&apos;t have permission to access the archive.</div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Archive</h1>
          <p className="text-secondary mt-1">View and restore deleted records</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b overflow-x-auto">
          {[
            { id: 'students', label: 'Students' },
            { id: 'rooms', label: 'Rooms' },
            { id: 'admissions', label: 'Admissions' },
            { id: 'transactions', label: 'Transactions' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                'px-4 py-2 font-medium border-b-2 transition-colors whitespace-nowrap',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-secondary hover:text-primary'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex justify-between items-center">
          <Input
            placeholder={`Search archived ${activeTab}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-md"
          />
          <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: [`archived-${activeTab}`] })}>
            Refresh
          </Button>
        </div>

        <div className="min-h-[300px]">
          {/* Students Tab */}
          {activeTab === 'students' && (
            <div className="space-y-4">
              {loadingStudents ? (
                <div className="text-center py-8">Loading...</div>
              ) : filteredData(students || []).length === 0 ? (
                <div className="text-center py-8 text-secondary">No archived students found</div>
              ) : (
                filteredData(students || []).map((student: any) => (
                  <Card key={student._id}>
                    <CardContent className="p-4 flex justify-between items-center">
                      <div>
                        <p className="font-semibold">{student.name} ({student.studentId})</p>
                        <p className="text-sm text-secondary">Phone: {student.phone}</p>
                        <p className="text-xs text-secondary mt-1">Deleted: {new Date(student.deletedAt).toLocaleDateString()}</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => handleRestore(student._id, 'student')}>
                        Restore
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* Rooms Tab */}
          {activeTab === 'rooms' && (
            <div className="space-y-4">
               {loadingRooms ? (
                <div className="text-center py-8">Loading...</div>
              ) : filteredData(rooms || []).length === 0 ? (
                <div className="text-center py-8 text-secondary">No archived rooms found</div>
              ) : (
                filteredData(rooms || []).map((room: any) => (
                  <Card key={room._id}>
                    <CardContent className="p-4 flex justify-between items-center">
                      <div>
                        <p className="font-semibold">{room.name} (Floor: {room.floor})</p>
                        <p className="text-xs text-secondary mt-1">Deleted: {new Date(room.deletedAt).toLocaleDateString()}</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => handleRestore(room._id, 'room')}>
                        Restore
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* Admissions Tab */}
          {activeTab === 'admissions' && (
            <div className="space-y-4">
               {loadingAdmissions ? (
                <div className="text-center py-8">Loading...</div>
              ) : filteredData(admissions || []).length === 0 ? (
                <div className="text-center py-8 text-secondary">No archived admissions found</div>
              ) : (
                filteredData(admissions || []).map((admission: any) => (
                  <Card key={admission._id}>
                    <CardContent className="p-4 flex justify-between items-center">
                      <div>
                        <p className="font-semibold">{admission.studentName} ({admission.admissionId})</p>
                         <p className="text-sm text-secondary">{admission.course} - {admission.batch}</p>
                        <p className="text-xs text-secondary mt-1">Deleted: {new Date(admission.deletedAt).toLocaleDateString()}</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => handleRestore(admission._id, 'admission')}>
                        Restore
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

           {/* Transactions Tab */}
           {activeTab === 'transactions' && (
            <div className="space-y-4">
               {loadingTransactions ? (
                <div className="text-center py-8">Loading...</div>
              ) : filteredData(transactions || []).length === 0 ? (
                <div className="text-center py-8 text-secondary">No archived transactions found</div>
              ) : (
                filteredData(transactions || []).map((txn: any) => (
                  <Card key={txn._id}>
                    <CardContent className="p-4 flex justify-between items-center">
                      <div>
                        <div className="flex gap-2 items-center">
                          <span className={cn(
                            "text-xs px-2 py-0.5 rounded uppercase font-bold",
                            txn.source === 'residential' ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                          )}>
                            {txn.source}
                          </span>
                          <span className="font-semibold">{maskCurrency(txn.amount || txn.paidAmount, user?.role === 'staff')}</span>
                        </div>
                        <p className="text-sm mt-1">
                           {txn.studentName} 
                           <span className="text-secondary mx-1">•</span>
                           {txn.paymentType}
                        </p>
                        
                        <p className="text-xs text-secondary mt-1">
                          Deleted: {txn.deletedAt ? new Date(txn.deletedAt).toLocaleDateString() : 'Unknown'}
                        </p>
                        {txn.notes && <p className="text-xs text-secondary italic">&quot;{txn.notes}&quot;</p>}
                      </div>
                      <Button variant="outline" size="sm" onClick={() => handleRestore(txn._id, 'payment')}>
                        Restore
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </div>

        <ConfirmDialog
          open={!!restoreId}
          onOpenChange={(open) => !open && setRestoreId(null)}
          onConfirm={() => restoreId && restoreType && restoreMutation.mutate({ id: restoreId, type: restoreType })}
          title={`Restore ${restoreType?.charAt(0).toUpperCase()}${restoreType?.slice(1)}`}
          description="Are you sure you want to restore this item? It will reappear in the active lists."
          confirmText="Restore"
           isLoading={restoreMutation.isPending}
        />
      </div>
    </ProtectedRoute>
  )
}
