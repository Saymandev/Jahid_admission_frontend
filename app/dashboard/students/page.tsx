'use client'

import { ProtectedRoute } from '@/components/protected-route'
import { QuickPaymentModal } from '@/components/quick-payment-modal'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import api from '@/lib/api'
import { showToast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { studentSchema } from '@/lib/validations'
import { useAuthStore } from '@/store/auth-store'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'

interface Student {
  _id: string
  studentId: string
  name: string
  phone: string
  roomId: {
    _id: string
    name: string
    beds?: {
      name: string
    }[]
  }
  bedNumber: number
  bedName?: string
  guardianName?: string
  guardianPhone?: string
  joiningDate?: string
  securityDeposit?: number
  unionFee?: number
  monthlyRent: number
  status: 'active' | 'left'
}

type StudentFormData = {
  name: string
  phone: string
  guardianName?: string
  guardianPhone?: string
  roomId: string
  bedNumber: string
  joiningDate: string
  monthlyRent?: string
  securityDeposit?: string
  unionFee?: string
  initialRentPaid?: string
}


export default function StudentsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const statusParam = searchParams.get('status') as 'active' | 'left' | null
  const user = useAuthStore((state) => state.user)
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  // Use statusParam directly, fallback to 'all'
  const statusFilter = (statusParam || 'all') as 'all' | 'active' | 'left'
  const [page, setPage] = useState(1)
  const pageSize = 10
  const [foundStudent, setFoundStudent] = useState<any>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [selectedStudentForPayment, setSelectedStudentForPayment] = useState<any>(null)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)

  // Reset to page 1 when status param changes
  useEffect(() => {
    setPage(1)
  }, [statusParam])

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<StudentFormData>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      joiningDate: new Date().toISOString().split('T')[0],
    },
  })

  const { data: roomsData } = useQuery<{
    data: any[]
    total: number
    page: number
    limit: number
    totalPages: number
  }>({
    queryKey: ['rooms'],
    queryFn: async () => {
      // Fetch all rooms for the form (use high limit to get all)
      const response = await api.get('/residential/rooms?limit=1000')
      return response.data
    },
  })

  const rooms = useMemo(() => roomsData?.data || [], [roomsData])

  const selectedRoomId = watch('roomId')
  const selectedBedName = watch('bedNumber')

  // Find selected room and available beds
  const selectedRoom = useMemo(() => {
    return rooms?.find((r: any) => r._id === selectedRoomId)
  }, [rooms, selectedRoomId])

  const availableBeds = useMemo(() => {
    return selectedRoom?.beds?.filter((bed: any) => {
      // If the bed is not occupied, it's available
      if (!bed.isOccupied) return true;
      
      // If we are editing a student, and this bed belongs to the student, it should be available
      // Check bedName first (new system), then mapped bedNumber (legacy)
      if (editingStudent && editingStudent.roomId?._id === selectedRoom._id) {
         if (editingStudent.bedName && bed.name === editingStudent.bedName) return true;
         // Handle legacy case: student has bedNumber but no bedName
         if (!editingStudent.bedName && editingStudent.bedNumber) {
            // Check if this bed corresponds to the numeric index
            const bedIndex = parseInt(bed.name.split(' ').pop() || '0');
            if (bedIndex === editingStudent.bedNumber) return true;
         }
      }
      return false;
    }) || []
  }, [selectedRoom, editingStudent])

  // Reset bed and monthly rent when room changes
  useEffect(() => {
    if (selectedRoomId && !editingStudent) {
      setValue('bedNumber', '')
      setValue('monthlyRent', '')
    }
  }, [selectedRoomId, setValue, editingStudent])

  // Search for existing student when phone or name is entered
  const phoneValue = watch('phone')
  const nameValue = watch('name')

  useEffect(() => {
    const searchForStudent = async () => {
      // Only search if we have at least 3 characters in phone or name
      const phoneLength = phoneValue?.trim().length || 0
      const nameLength = nameValue?.trim().length || 0

      if (phoneLength < 3 && nameLength < 3) {
        setFoundStudent(null)
        return
      }

      // If phone is entered, try the cross-module lookup for auto-fill
      if (phoneLength >= 10) {
        try {
          const lookupResponse = await api.get('/residential/students/lookup', {
            params: { phone: phoneValue.trim() }
          })
          const match = lookupResponse.data
          if (match) {
            if (!watch('name')) setValue('name', match.name)
            if (!watch('guardianName')) setValue('guardianName', match.guardianName)
            if (!watch('guardianPhone')) setValue('guardianPhone', match.guardianPhone)
            if (match.source === 'coaching') {
              showToast(`Found student details from Coaching: ${match.name}`, 'info')
            }
          }
        } catch (error) {
          console.error('Lookup error:', error)
        }
      }

      setIsSearching(true)
      try {
        const response = await api.get('/residential/students/search', {
          params: {
            phone: phoneValue?.trim() || undefined,
            name: nameValue?.trim() || undefined,
          },
        })
        const student = response.data
        if (student && student.status === 'left') {
          setFoundStudent(student)
          // Auto-fill form with student data (only if fields are empty or match)
          if (!nameValue || nameValue.trim() === '') {
            setValue('name', student.name)
          }
          if (!phoneValue || phoneValue.trim() === '') {
            setValue('phone', student.phone)
          }
          if (!watch('guardianName')) {
            setValue('guardianName', student.guardianName || '')
          }
          if (!watch('guardianPhone')) {
            setValue('guardianPhone', student.guardianPhone || '')
          }
          if (!watch('securityDeposit')) {
            setValue('securityDeposit', student.securityDeposit?.toString() || '0')
          }
          // Don't auto-fill room/bed - user needs to select new ones
          showToast(`Found returning student: ${student.name}. Previous data auto-filled.`, 'info')
        } else if (student && student.status === 'active') {
          showToast(`Student "${student.name}" is already active.`, 'warning')
          setFoundStudent(null)
        } else {
          setFoundStudent(null)
        }
      } catch (error: any) {
        // Student not found - that's fine, continue with new student
        setFoundStudent(null)
      } finally {
        setIsSearching(false)
      }
    }

    const timeoutId = setTimeout(searchForStudent, 500) // Debounce 500ms
    return () => clearTimeout(timeoutId)
  }, [phoneValue, nameValue, setValue, watch])

  const { data: studentsData } = useQuery<{
    data: Student[]
    total: number
    page: number
    limit: number
    totalPages: number
  }>({
    queryKey: ['students', statusFilter, page, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.append('status', statusFilter)
      params.append('page', page.toString())
      params.append('limit', pageSize.toString())
      if (searchQuery) params.append('search', searchQuery)

      const response = await api.get(`/residential/students?${params.toString()}`)
      return response.data
    },
  })

  const students = studentsData?.data || []
  const totalPages = studentsData?.totalPages || 0
  const totalStudents = studentsData?.total || 0

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/residential/students', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
      setShowForm(false)
      setFoundStudent(null)
      reset({
        joiningDate: new Date().toISOString().split('T')[0],
      })
      showToast('Student created successfully!', 'success')
    },
    onError: (error: any) => {
      showToast(error.response?.data?.message || 'Failed to create student', 'error')
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!editingStudent) return
      return api.patch(`/residential/students/${editingStudent._id}`, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
      setShowForm(false)
      setEditingStudent(null)
      reset({
        joiningDate: new Date().toISOString().split('T')[0],
      })
      showToast('Student updated successfully!', 'success')
    },
    onError: (error: any) => {
      showToast(error.response?.data?.message || 'Failed to update student', 'error')
    },
  })

  const onSubmit = async (data: StudentFormData) => {
    // Determine if we should send bedNumber or bedName based on the room type
    // If the room has beds defined (length > 0), we selected from a dropdown, so send bedName
    // If the room has NO beds defined, we entered a number manually, so send bedNumber
    
    let bedName: string | undefined = undefined
    let bedNumber: number | undefined = undefined

    if (selectedRoom && selectedRoom.beds && selectedRoom.beds.length > 0) {
      // Dropdown selection (even if the name looks like a number like "1", treat as name)
      bedName = data.bedNumber
    } else {
      // Manual input (must be a number)
      const parsed = parseInt(data.bedNumber)
      if (!isNaN(parsed)) {
        bedNumber = parsed
      }
    }

    const payload = {
      ...data,
      monthlyRent: data.monthlyRent ? parseFloat(data.monthlyRent) : undefined,
      securityDeposit: data.securityDeposit ? parseFloat(data.securityDeposit) : undefined,
      unionFee: data.unionFee ? parseFloat(data.unionFee) : undefined,
      initialRentPaid: data.initialRentPaid ? parseFloat(data.initialRentPaid) : undefined,
      bedNumber,
      bedName,
    }

    if (editingStudent) {
      updateMutation.mutate(payload)
    } else {
      createMutation.mutate(payload)
    }
  }

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    setPage(1)
  }, [searchQuery, statusFilter])

  const isAdmin = user?.role === 'admin'
  const isStaff = user?.role === 'staff'
  const canCreate = isAdmin || isStaff

  return (
    <ProtectedRoute>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Students</h1>
            {!canCreate && (
              <p className="text-sm text-secondary mt-1">View-only mode - You can record payments</p>
            )}
          </div>
          {canCreate && (
            <Button
              onClick={() => {
                if (showForm) {
                  setShowForm(false)
                  setFoundStudent(null)
                  reset({
                    joiningDate: new Date().toISOString().split('T')[0],
                  })
                } else {
                  setShowForm(true)
                }
              }}
            >
              {showForm ? 'Cancel' : 'Add Student'}
            </Button>
          )}
        </div>

        {/* Search and Filter */}
        <div className="flex gap-4">
          <Input
            placeholder="Search by name, ID, phone, or room..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setPage(1)
            }}
            className="max-w-md"
          />
          <Select
            value={statusFilter}
            onChange={(e) => {
              const newStatus = e.target.value as 'all' | 'active' | 'left'
              if (newStatus === 'all') {
                router.push('/dashboard/students')
              } else {
                router.push(`/dashboard/students?status=${newStatus}`)
              }
              setPage(1)
            }}
            className="w-40"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="left">Left</option>
          </Select>
        </div>



        <div className="space-y-4">
          {students.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <div className="text-6xl mb-4">📭</div>
                <h3 className="text-lg font-semibold mb-2">
                  {searchQuery || statusFilter !== 'all'
                    ? 'No students found'
                    : 'No students yet'}
                </h3>
                <p className="text-secondary text-sm">
                  {searchQuery || statusFilter !== 'all'
                    ? 'Try adjusting your search or filter criteria'
                    : 'Get started by adding your first student'}
                </p>
              </CardContent>
            </Card>
          ) : (
            students.map((student: Student) => (
              <Card key={student._id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <span>👤</span>
                        {student.name}
                      </CardTitle>
                      <p className="text-sm text-secondary mt-1">ID: {student.studentId}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setSelectedStudentForPayment(student)
                          setIsPaymentModalOpen(true)
                        }}
                      >
                        ⚡ Quick Rent
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/dashboard/students/${student._id}`)}
                      >
                        View Details →
                      </Button>
                      {isAdmin && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-primary/30 text-primary hover:bg-primary/5"
                          onClick={() => {
                            let bedValue = student.bedName || student.bedNumber.toString()
                            
                            // Try to map numeric bedNumber (e.g., 1) to bedName (e.g., "Bed 1") for legacy students
                            // We look up the room in the `rooms` list because student.roomId might not have the populated beds array
                            const existingRoom = rooms.find((r: any) => r._id === (student.roomId?._id || student.roomId))
                            
                            if (!student.bedName && existingRoom && existingRoom.beds && existingRoom.beds.length > 0) {
                              const numericBed = parseInt(student.bedNumber.toString())
                              if (!isNaN(numericBed) && numericBed > 0 && numericBed <= existingRoom.beds.length) {
                                bedValue = existingRoom.beds[numericBed - 1].name
                              }
                            }

                            reset({
                              name: student.name,
                              phone: student.phone,
                              guardianName: student.guardianName,
                              guardianPhone: student.guardianPhone,
                              roomId: student.roomId?._id,
                              bedNumber: bedValue, 
                              monthlyRent: student.monthlyRent?.toString(),
                              joiningDate: student.joiningDate ? new Date(student.joiningDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                              securityDeposit: student.securityDeposit?.toString(),
                              unionFee: student.unionFee?.toString(),
                            })
                            setShowForm(true)
                          }}
                        >
                          Edit
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-secondary block mb-1">Room</span>
                      <span className="font-medium">🏠 {student.roomId?.name} (Bed {student.bedNumber})</span>
                    </div>
                    <div>
                      <span className="text-secondary block mb-1">Phone</span>
                      <span className="font-medium">📞 {student.phone}</span>
                    </div>
                    <div>
                      <span className="text-secondary block mb-1">Monthly Rent</span>
                      <span className="font-medium">💰 {student.monthlyRent.toLocaleString()} BDT</span>
                    </div>
                    <div>
                      <span className="text-secondary block mb-1">Status</span>
                      <span
                        className={cn(
                          'font-medium px-2 py-1 rounded text-xs',
                          student.status === 'active'
                            ? 'bg-success/10 text-success'
                            : 'bg-secondary/10 text-secondary'
                        )}
                      >
                        {student.status === 'active' ? '✓ Active' : 'Left'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Pagination */}
        {/* ... pagination ... */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-sm text-secondary">
              Page {page} of {totalPages} ({totalStudents} total)
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

        {/* Add Student Modal */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingStudent ? 'Edit Student Details' : 'Add New Student'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <div className="relative">
                      <Input
                        id="name"
                        {...register('name')}
                      />
                      {isSearching && (
                        <div className="absolute right-2 top-2">
                          <svg className="animate-spin h-4 w-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        </div>
                      )}
                    </div>
                    {errors.name && (
                      <p className="text-sm text-danger">{errors.name.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone *</Label>
                    <div className="relative">
                      <Input
                        id="phone"
                        {...register('phone')}
                      />
                      {isSearching && (
                        <div className="absolute right-2 top-2">
                          <svg className="animate-spin h-4 w-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        </div>
                      )}
                    </div>
                    {errors.phone && (
                      <p className="text-sm text-danger">{errors.phone.message}</p>
                    )}
                    {foundStudent && (
                      <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 mt-2">
                        <div className="flex items-start gap-2">
                          <svg className="w-5 h-5 text-primary mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-primary">Returning Student Detected!</p>
                            <p className="text-xs text-secondary mt-1">
                              Previous data has been auto-filled. Previous Student ID: {foundStudent.studentId}
                            </p>
                            {foundStudent.roomId && (
                              <p className="text-xs text-secondary mt-1">
                                Previous Room: {foundStudent.roomId.name} (Bed {foundStudent.bedNumber})
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="guardianName">Guardian Name</Label>
                    <Input
                      id="guardianName"
                      {...register('guardianName')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="guardianPhone">Guardian Phone</Label>
                    <Input
                      id="guardianPhone"
                      {...register('guardianPhone')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="roomId">Room *</Label>
                    <Select
                      id="roomId"
                      {...register('roomId')}
                    >
                      <option value="">Select Room</option>
                      {rooms?.map((room: any) => (
                        <option key={room._id} value={room._id}>
                          {room.name} ({room.occupiedBeds}/{room.totalBeds})
                        </option>
                      ))}
                    </Select>
                    {errors.roomId && (
                      <p className="text-sm text-danger">{errors.roomId.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bedNumber" className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                      Bed *
                    </Label>
                    {selectedRoomId && selectedRoom?.beds && selectedRoom.beds.length > 0 ? (
                      <>
                        <Select
                          id="bedNumber"
                          className="h-10"
                          {...register('bedNumber', { required: 'Bed is required' })}
                          disabled={!!editingStudent}
                          onChange={(e) => {
                            const value = e.target.value
                            setValue('bedNumber', value, { shouldValidate: true })
                            // Auto-fill monthly rent if bed is selected
                            const bed = selectedRoom.beds.find((b: any) => b.name === value)
                            if (bed) {
                              setValue('monthlyRent', bed.price.toString())
                            }
                          }}
                        >
                          <option value="">Select Bed</option>
                          {availableBeds.map((bed: any, index: number) => (
                            <option key={index} value={bed.name}>
                              {bed.name} - {bed.price.toLocaleString()} BDT
                            </option>
                          ))}
                        </Select>
                        {!!editingStudent && (
                           <p className="text-xs text-primary mt-1">Changing the bed will update the student&apos;s location. The old bed will be freed.</p>
                        )}
                        {availableBeds.length === 0 && !editingStudent && (
                          <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
                            <p className="text-sm text-warning flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              No available beds in this room
                            </p>
                          </div>
                        )}
                      </>
                    ) : selectedRoomId ? (
                      <Input
                        id="bedNumber"
                        type="number"
                        min="1"
                        placeholder="Enter bed number"
                        className="h-10"
                        {...register('bedNumber')}
                      />
                    ) : (
                      <Input
                        id="bedNumber"
                        type="text"
                        placeholder="Select a room first"
                        disabled={true}
                        className="h-10"
                        {...register('bedNumber')}
                      />
                    )}
                    {errors.bedNumber && (
                      <p className="text-sm text-danger mt-1">{errors.bedNumber.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="joiningDate">Joining Date *</Label>
                    <Input
                      id="joiningDate"
                      type="date"
                      {...register('joiningDate')}
                    />
                    {errors.joiningDate && (
                      <p className="text-sm text-danger">{errors.joiningDate.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="monthlyRent">Monthly Rent (BDT)</Label>
                    <Input
                      id="monthlyRent"
                      type="number"
                      min="0"
                      step="0.01"
                      {...register('monthlyRent')}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="securityDeposit">Security Deposit (BDT)</Label>
                    <Input
                      id="securityDeposit"
                      type="number"
                      min="0"
                      step="0.01"
                      {...register('securityDeposit')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unionFee">Union Fee (BDT)</Label>
                    <Input
                      id="unionFee"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="One-time non-refundable fee"
                      {...register('unionFee')}
                    />
                  </div>
                  {!editingStudent && (
                    <div className="space-y-2">
                      <Label htmlFor="initialRentPaid">Initial Rent Paid (BDT)</Label>
                      <Input
                        id="initialRentPaid"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Amount paid today for rent"
                        {...register('initialRentPaid')}
                      />
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowForm(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="h-10 font-semibold"
                  >
                    {createMutation.isPending || updateMutation.isPending ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        {editingStudent ? 'Update Student' : 'Create Student'}
                      </>
                    )}
                  </Button>
                </div>
              </form>
          </DialogContent>
        </Dialog>

        {/* Quick Payment Modal */}
        <QuickPaymentModal
          student={selectedStudentForPayment}
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
        />
      </div>
    </ProtectedRoute>
  )
}
