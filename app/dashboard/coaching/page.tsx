'use client'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { ProtectedRoute } from '@/components/protected-route'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import api from '@/lib/api'
import { exportToCSV } from '@/lib/csv-export'
import { maskCurrency, maskValue } from '@/lib/mask-value'
import { exportAdmissionReceipt } from '@/lib/pdf-export'
import { showToast } from '@/lib/toast'
import { admissionPaymentSchema, admissionSchema } from '@/lib/validations'
import { useAuthStore } from '@/store/auth-store'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'

interface Admission {
  _id: string
  admissionId: string
  studentName: string
  phone: string
  course: string
  batch: string
  totalFee: number
  paidAmount: number
  dueAmount: number
  status: 'pending' | 'completed' | 'cancelled'
  admissionDate: string
}

type AdmissionFormData = {
  studentName: string
  phone: string
  guardianName?: string
  guardianPhone?: string
  course: string
  batch: string
  totalFee: string
  admissionDate: string
  paidAmount?: string
}

type PaymentFormData = {
  paidAmount: string
  paymentMethod: 'cash' | 'bkash' | 'bank'
  transactionId?: string
  notes?: string
}

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export default function CoachingPage() {
  const user = useAuthStore((state) => state.user)
  const queryClient = useQueryClient()
  const [showAdmissionForm, setShowAdmissionForm] = useState(false)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [selectedAdmission, setSelectedAdmission] = useState<string | null>(null)
  const [selectedStudentDetails, setSelectedStudentDetails] = useState<Admission | null>(null)
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed' | 'cancelled'>('all')
  const [batchFilter, setBatchFilter] = useState('all')
  const [courseFilter, setCourseFilter] = useState('all')

  const [createNewCourse, setCreateNewCourse] = useState(false)
  const [createNewBatch, setCreateNewBatch] = useState(false)
  const [newCourseValue, setNewCourseValue] = useState('')
  const [newBatchValue, setNewBatchValue] = useState('')
  const [showManageCourses, setShowManageCourses] = useState(false)
  const [showManageBatches, setShowManageBatches] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 10
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [paymentToDelete, setPaymentToDelete] = useState<string | null>(null)

  const {
    register: registerAdmission,
    handleSubmit: handleAdmissionSubmit,
    formState: { errors: admissionErrors },
    reset: resetAdmission,
    watch: watchAdmission,
    setValue: setAdmissionValue,
  } = useForm<AdmissionFormData>({
    resolver: zodResolver(admissionSchema),
    defaultValues: {
      admissionDate: new Date().toISOString().split('T')[0],
    },
  })

  const {
    register: registerPayment,
    handleSubmit: handlePaymentSubmit,
    formState: { errors: paymentErrors },
    reset: resetPayment,
  } = useForm<PaymentFormData>({
    resolver: zodResolver(admissionPaymentSchema),
  })

  const { data: admissionsData } = useQuery<{
    data: Admission[]
    total: number
    page: number
    limit: number
    totalPages: number
  }>({
    queryKey: ['admissions', statusFilter, batchFilter, courseFilter, page, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (batchFilter !== 'all') params.append('batch', batchFilter)
      if (courseFilter !== 'all') params.append('course', courseFilter)
      params.append('page', page.toString())
      params.append('limit', pageSize.toString())
      if (searchQuery) params.append('search', searchQuery)
      
      const response = await api.get(`/coaching/admissions?${params.toString()}`)
      return response.data
    },
  })

  const admissions = admissionsData?.data || []
  const totalPages = admissionsData?.totalPages || 0
  const totalAdmissions = admissionsData?.total || 0

  const { data: stats } = useQuery({
    queryKey: ['coaching-stats', statusFilter, batchFilter, courseFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (batchFilter !== 'all') params.append('batch', batchFilter)
      if (courseFilter !== 'all') params.append('course', courseFilter)
      
      const response = await api.get(`/coaching/stats?${params.toString()}`)
      return response.data
    },
  })

  const { data: coachingPayments } = useQuery({
    queryKey: ['coaching-payments', selectedStudentDetails?._id],
    queryFn: async () => {
      if (!selectedStudentDetails) return []
      const response = await api.get(`/coaching/admissions/${selectedStudentDetails._id}/payments`)
      return response.data
    },
    enabled: !!selectedStudentDetails,
  })

  const coachingAdmissionPhone = watchAdmission('phone')

  useEffect(() => {
    const lookupStudent = async () => {
      if (!coachingAdmissionPhone || coachingAdmissionPhone.trim().length < 10) return

      try {
        const response = await api.get('/residential/students/lookup', {
          params: { phone: coachingAdmissionPhone.trim() }
        })
        const match = response.data
        if (match) {
          if (!watchAdmission('studentName')) setAdmissionValue('studentName', match.name)
          if (!watchAdmission('guardianName')) setAdmissionValue('guardianName', match.guardianName)
          if (!watchAdmission('guardianPhone')) setAdmissionValue('guardianPhone', match.guardianPhone)
          
          if (match.source === 'residential') {
            showToast(`Found student details from Residential: ${match.name}`, 'info')
          }
        }
      } catch (error) {
        console.error('Lookup error:', error)
      }
    }

    lookupStudent()
  }, [coachingAdmissionPhone, setAdmissionValue, watchAdmission])

  const admissionMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/coaching/admissions', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admissions'] })
      queryClient.invalidateQueries({ queryKey: ['coaching-stats'] })
      setShowAdmissionForm(false)
      resetAdmission()
      setCreateNewCourse(false)
      setCreateNewBatch(false)
      setNewCourseValue('')
      setNewBatchValue('')
      showToast('Admission created successfully!', 'success')
    },
    onError: (error: any) => {
      showToast(error.response?.data?.message || 'Failed to create admission', 'error')
    },
  })

  const paymentMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/coaching/admissions/payments', {
        ...data,
        admissionId: selectedAdmission,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admissions'] })
      queryClient.invalidateQueries({ queryKey: ['coaching-stats'] })
      setShowPaymentForm(false)
      setSelectedAdmission(null)
      resetPayment()
      showToast('Payment recorded successfully!', 'success')
    },
    onError: (error: any) => {
      showToast(error.response?.data?.message || 'Failed to record payment', 'error')
    },
  })

  const deletePaymentMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const response = await api.delete(`/coaching/admissions/payments/${paymentId}`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admissions'] })
      queryClient.invalidateQueries({ queryKey: ['coaching-stats'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['coaching-payments', selectedStudentDetails?._id] })
      showToast('Payment deleted successfully!', 'success')
      setIsDeleteDialogOpen(false)
      setPaymentToDelete(null)
    },
    onError: (error: any) => {
      showToast(error.response?.data?.message || 'Failed to delete payment', 'error')
    },
  })

  const handleDeletePayment = (paymentId: string) => {
    setPaymentToDelete(paymentId)
    setIsDeleteDialogOpen(true)
  }
  const [showConfirmAdmission, setShowConfirmAdmission] = useState(false)
  const [pendingAdmissionData, setPendingAdmissionData] = useState<AdmissionFormData | null>(null)

  // ...

  const onAdmissionSubmit = (data: AdmissionFormData) => {
    setPendingAdmissionData(data)
    setShowConfirmAdmission(true)
  }

  const handleConfirmAdmission = () => {
    if (!pendingAdmissionData) return

    admissionMutation.mutate({
      ...pendingAdmissionData,
      totalFee: parseFloat(pendingAdmissionData.totalFee),
      paidAmount: pendingAdmissionData.paidAmount ? parseFloat(pendingAdmissionData.paidAmount) : 0,
    })
    setShowConfirmAdmission(false)
  }


  const [showConfirmPayment, setShowConfirmPayment] = useState(false)
  const [pendingPaymentData, setPendingPaymentData] = useState<PaymentFormData | null>(null)

  const onPaymentSubmit = (data: PaymentFormData) => {
    setPendingPaymentData(data)
    setShowConfirmPayment(true)
  }

  const handleConfirmPayment = () => {
    if (!pendingPaymentData) return

    paymentMutation.mutate({
      ...pendingPaymentData,
      paidAmount: parseFloat(pendingPaymentData.paidAmount),
    })
    setShowConfirmPayment(false)
  }


  const handleExportReceipt = async (admissionId: string) => {
    try {
      const admission = admissions?.find((a: Admission) => a._id === admissionId)
      if (!admission) return

      const paymentsResponse = await api.get(`/coaching/admissions/${admissionId}/payments`)
      exportAdmissionReceipt(admission, paymentsResponse.data)
      showToast('Receipt exported successfully!', 'success')
    } catch (error: any) {
      showToast('Failed to export receipt', 'error')
    }
  }

  const handleExportSheet = async () => {
    try {
      // Fetch all admissions for export (ignoring pagination, but keeping filters)
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (batchFilter !== 'all') params.append('batch', batchFilter)
      if (courseFilter !== 'all') params.append('course', courseFilter)
      params.append('limit', '1000') // Fetch up to 1000
      if (searchQuery) params.append('search', searchQuery)

      const response = await api.get(`/coaching/admissions?${params.toString()}`)
      const dataToExport = response.data.data.map((ad: Admission) => ({
        'Student ID': ad.admissionId,
        'Name': ad.studentName,
        'Phone': ad.phone,
        'Course': ad.course,
        'Batch': ad.batch,
        'Total Fee': ad.totalFee,
        'Paid Amount': ad.paidAmount,
        'Due Amount': ad.dueAmount,
        'Status': ad.status,
        'Admission Date': new Date(ad.admissionDate).toLocaleDateString(),
      }))

      exportToCSV(dataToExport, `admissions-export-${new Date().toISOString().split('T')[0]}.csv`)
      showToast('Exported successfully!', 'success')
    } catch (error) {
      showToast('Failed to export data', 'error')
    }
  }

  const handleDeleteCourse = (courseName: string) => {
    // Note: This is a frontend-only operation
    // In a real app, you'd want to update admissions to remove this course
    // For now, we'll just show a message
    showToast(`Course "${courseName}" cannot be deleted while it's in use`, 'warning')
  }

  const handleDeleteBatch = (batchName: string) => {
    // Note: This is a frontend-only operation
    // In a real app, you'd want to update admissions to remove this batch
    // For now, we'll just show a message
    showToast(`Batch "${batchName}" cannot be deleted while it's in use`, 'warning')
  }

  // Extract unique courses and batches from admissions with usage count
  const uniqueCourses = useMemo(() => {
    if (!admissions) return []
    const courseMap = new Map<string, number>()
    admissions.forEach((admission: Admission) => {
      if (admission.course && admission.course.trim() !== '') {
        courseMap.set(admission.course, (courseMap.get(admission.course) || 0) + 1)
      }
    })
    return Array.from(courseMap.entries())
      .map(([course, count]) => ({ name: course, count }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [admissions])

  const uniqueBatches = useMemo(() => {
    if (!admissions) return []
    const batchMap = new Map<string, number>()
    admissions.forEach((admission: Admission) => {
      if (admission.batch && admission.batch.trim() !== '') {
        batchMap.set(admission.batch, (batchMap.get(admission.batch) || 0) + 1)
      }
    })
    return Array.from(batchMap.entries())
      .map(([batch, count]) => ({ name: batch, count }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [admissions])

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    setPage(1)
  }, [searchQuery, statusFilter, batchFilter, courseFilter])

  const isAdmin = user?.role === 'admin'
  const isStaff = user?.role === 'staff'
  const canCreate = isAdmin || isStaff
  // Staff can view admissions and record payments but not create/edit/delete (now staff can create admissions)

  return (
    <ProtectedRoute>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Coaching Admissions</h1>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowManageCourses(!showManageCourses)
                setShowManageBatches(false)
              }}
            >
              Manage Courses
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowManageBatches(!showManageBatches)
                setShowManageCourses(false)
              }}
            >
              Manage Batches
            </Button>
            <Button onClick={() => setShowAdmissionForm(!showAdmissionForm)}>
              {showAdmissionForm ? 'Cancel' : 'New Admission'}
            </Button>
            <Button variant="secondary" onClick={handleExportSheet}>
              Download CSV
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-wrap gap-4">
          <Input
            placeholder="Search by name, ID, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-xs"
          />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-32"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </Select>
          
          <Select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="w-32"
          >
            <option value="all">All Courses</option>
            {uniqueCourses.map(c => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </Select>

          <Select
            value={batchFilter}
            onChange={(e) => setBatchFilter(e.target.value)}
            className="w-32"
          >
            <option value="all">All Batches</option>
            {uniqueBatches.map(b => (
              <option key={b.name} value={b.name}>{b.name}</option>
            ))}
          </Select>
        </div>

        {/* Manage Courses */}
        {isAdmin && showManageCourses && (
          <Card>
            <CardHeader>
              <CardTitle>Manage Courses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {uniqueCourses.length === 0 ? (
                  <p className="text-secondary">No courses found (in current view)</p>
                ) : (
                  uniqueCourses.map((course) => (
                    <div
                      key={course.name}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-primary/5 transition-colors"
                    >
                      <div>
                        <span className="font-medium">{course.name}</span>
                        <span className="text-sm text-secondary ml-2">
                          ({course.count} admission{course.count !== 1 ? 's' : ''})
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteCourse(course.name)}
                        disabled={course.count > 0}
                        className={course.count > 0 ? 'opacity-50 cursor-not-allowed' : ''}
                      >
                        Delete
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Manage Batches */}
        {isAdmin && showManageBatches && (
          <Card>
            <CardHeader>
              <CardTitle>Manage Batches</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {uniqueBatches.length === 0 ? (
                  <p className="text-secondary">No batches found (in current view)</p>
                ) : (
                  uniqueBatches.map((batch) => (
                    <div
                      key={batch.name}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-primary/5 transition-colors"
                    >
                      <div>
                        <span className="font-medium">{batch.name}</span>
                        <span className="text-sm text-secondary ml-2">
                          ({batch.count} admission{batch.count !== 1 ? 's' : ''})
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteBatch(batch.name)}
                        disabled={batch.count > 0}
                        className={batch.count > 0 ? 'opacity-50 cursor-not-allowed' : ''}
                      >
                        Delete
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {stats && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Admissions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{maskValue(stats.totalAdmissions, user?.role === 'staff')}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Pending</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-warning">{maskValue(stats.pendingAdmissions, user?.role === 'staff')}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Due</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-danger">
                  {maskCurrency(stats.totalDue, user?.role === 'staff')}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">
                  {maskCurrency(stats.totalCollected, user?.role === 'staff')}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="space-y-4">
          {admissions.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-secondary">
                {searchQuery || statusFilter !== 'all'
                  ? 'No admissions found matching your criteria'
                  : 'No admissions found'}
              </CardContent>
            </Card>
          ) : (
            admissions.map((admission: Admission) => (
              <Card key={admission._id}>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>{admission.studentName}</CardTitle>
                      <p className="text-sm text-secondary mt-1">ID: {admission.admissionId}</p>
                      <p className="text-sm text-secondary">Phone: {admission.phone}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedStudentDetails(admission)}
                      >
                        View Details
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExportReceipt(admission._id)}
                      >
                        Export Receipt
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedAdmission(admission._id)
                          setShowPaymentForm(true)
                        }}
                        disabled={admission.status === 'completed'}
                      >
                        Add Payment
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-secondary">Course: </span>
                      {admission.course} - {admission.batch}
                    </div>
                    <div>
                      <span className="text-secondary">Total Fee: </span>
                      {admission.totalFee.toLocaleString()} BDT
                    </div>
                    <div>
                      <span className="text-secondary">Paid: </span>
                      <span className="text-success">{admission.paidAmount.toLocaleString()} BDT</span>
                    </div>
                    <div>
                      <span className="text-secondary">Due: </span>
                      <span className={admission.dueAmount > 0 ? 'text-danger' : 'text-success'}>
                        {admission.dueAmount.toLocaleString()} BDT
                      </span>
                    </div>
                    <div>
                      <span className="text-secondary">Status: </span>
                      <span
                        className={
                          admission.status === 'completed'
                            ? 'text-success'
                            : admission.status === 'pending'
                            ? 'text-warning'
                            : 'text-secondary'
                        }
                      >
                        {admission.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-sm text-secondary">
              Page {page} of {totalPages} ({totalAdmissions} total)
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

        {/* Student Details Dialog */}
        <Dialog open={!!selectedStudentDetails} onOpenChange={(open: boolean) => !open && setSelectedStudentDetails(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Student Details</DialogTitle>
            </DialogHeader>
            {selectedStudentDetails && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-x-12 gap-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-secondary mb-1">Student Information</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between border-b pb-1">
                        <span className="text-secondary">Name:</span>
                        <span className="font-semibold">{selectedStudentDetails.studentName}</span>
                      </div>
                      <div className="flex justify-between border-b pb-1">
                        <span className="text-secondary">ID:</span>
                        <span className="font-mono">{selectedStudentDetails.admissionId}</span>
                      </div>
                      <div className="flex justify-between border-b pb-1">
                        <span className="text-secondary">Phone:</span>
                        <span>{selectedStudentDetails.phone}</span>
                      </div>
                      <div className="flex justify-between border-b pb-1">
                        <span className="text-secondary">Admission Date:</span>
                        <span>{new Date(selectedStudentDetails.admissionDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-secondary mb-1">Course Details</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between border-b pb-1">
                        <span className="text-secondary">Course:</span>
                        <span className="font-semibold">{selectedStudentDetails.course}</span>
                      </div>
                      <div className="flex justify-between border-b pb-1">
                        <span className="text-secondary">Batch:</span>
                        <span>{selectedStudentDetails.batch}</span>
                      </div>
                      <div className="flex justify-between border-b pb-1">
                        <span className="text-secondary">Status:</span>
                        <span className={cn(
                          "px-2 py-0.5 rounded text-xs font-semibold",
                          selectedStudentDetails.status === 'completed' ? "bg-success/10 text-success" :
                          selectedStudentDetails.status === 'pending' ? "bg-warning/10 text-warning" :
                          "bg-secondary/10 text-secondary"
                        )}>
                          {selectedStudentDetails.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-secondary mb-2">Payment Summary</h3>
                  <div className="grid grid-cols-3 gap-4 p-4 bg-secondary/5 rounded-lg">
                    <div className="text-center">
                      <div className="text-sm text-secondary">Total Fee</div>
                      <div className="text-xl font-bold">{selectedStudentDetails.totalFee.toLocaleString()} BDT</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-secondary">Paid Amount</div>
                      <div className="text-xl font-bold text-success">{selectedStudentDetails.paidAmount.toLocaleString()} BDT</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-secondary">Due Amount</div>
                      <div className="text-xl font-bold text-danger">{selectedStudentDetails.dueAmount.toLocaleString()} BDT</div>
                    </div>
                  </div>
                </div>

                {coachingPayments && coachingPayments.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-secondary mb-2">Transaction History</h3>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-secondary/5 border-b">
                          <tr>
                            <th className="px-4 py-2 text-left font-medium">Date</th>
                            <th className="px-4 py-2 text-left font-medium">Method</th>
                            <th className="px-4 py-2 text-right font-medium">Amount</th>
                            {isAdmin && <th className="px-4 py-2 text-right font-medium">Action</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {coachingPayments.map((p: any) => (
                            <tr key={p._id} className="hover:bg-secondary/5 transition-colors">
                              <td className="px-4 py-2">
                                {new Date(p.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </td>
                              <td className="px-4 py-2 capitalize">{p.paymentMethod}</td>
                              <td className="px-4 py-2 text-right font-semibold text-success">
                                {p.paidAmount.toLocaleString()} BDT
                              </td>
                              {isAdmin && (
                                <td className="px-4 py-2 text-right">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-danger hover:bg-danger/10"
                                    onClick={() => handleDeletePayment(p._id)}
                                  >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                  </Button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => setSelectedStudentDetails(null)}>
                    Close
                  </Button>
                  <Button onClick={() => handleExportReceipt(selectedStudentDetails._id)}>
                    Download Receipt
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={() => paymentToDelete && deletePaymentMutation.mutate(paymentToDelete)}
        title="Delete Coaching Payment"
        description="Are you sure you want to delete this payment? This will reverse the paid/due amounts on the admission record."
        confirmText="Delete"
        variant="danger"
        isLoading={deletePaymentMutation.isPending}
      />

      <ConfirmDialog
        open={showConfirmAdmission}
        onOpenChange={setShowConfirmAdmission}
        onConfirm={handleConfirmAdmission}
        title="Confirm New Admission"
        description={
          pendingAdmissionData ? (
            <div className="space-y-2">
              <p>Are you sure you want to admit <strong>{pendingAdmissionData.studentName}</strong>?</p>
              <div className="bg-secondary/10 p-3 rounded-md text-sm">
                 <div className="flex justify-between">
                  <span>Course:</span>
                  <span className="font-medium">{pendingAdmissionData.course}</span>
                </div>
                 <div className="flex justify-between">
                  <span>Batch:</span>
                  <span className="font-medium">{pendingAdmissionData.batch}</span>
                </div>
                <div className="flex justify-between mt-2 pt-2 border-t border-secondary/20">
                  <span>Total Fee:</span>
                  <span className="font-medium">{maskCurrency(parseFloat(pendingAdmissionData.totalFee), false)}</span>
                </div>
                {pendingAdmissionData.paidAmount && (
                  <div className="flex justify-between">
                    <span>Initial Payment:</span>
                    <span className="font-medium text-success">{maskCurrency(parseFloat(pendingAdmissionData.paidAmount), false)}</span>
                  </div>
                )}
              </div>
            </div>
          ) : 'Are you sure you want to proceed?'
        }
        confirmText="Confirm & Admit"
        isLoading={admissionMutation.isPending}
      />
      <ConfirmDialog
        open={showConfirmPayment}
        onOpenChange={setShowConfirmPayment}
        onConfirm={handleConfirmPayment}
        title="Confirm Payment"
        description={
          pendingPaymentData && selectedStudentDetails ? (
            <div className="space-y-2">
              <p>Are you sure you want to record a payment for <strong>{selectedStudentDetails.studentName}</strong>?</p>
              <div className="bg-secondary/10 p-3 rounded-md text-sm">
                <div className="flex justify-between">
                  <span>Amount:</span>
                  <span className="font-medium text-success">{maskCurrency(parseFloat(pendingPaymentData.paidAmount), false)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Method:</span>
                  <span className="font-medium capitalize">{pendingPaymentData.paymentMethod}</span>
                </div>
                 {pendingPaymentData.transactionId && (
                  <div className="flex justify-between">
                    <span>Trx ID:</span>
                    <span className="font-medium">{pendingPaymentData.transactionId}</span>
                  </div>
                )}
              </div>
            </div>
          ) : 'Are you sure you want to proceed?'
        }
        confirmText="Confirm Payment"
        isLoading={paymentMutation.isPending}
      />
    </ProtectedRoute>
  )
}
