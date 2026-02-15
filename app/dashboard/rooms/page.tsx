'use client'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { ProtectedRoute } from '@/components/protected-route'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select
} from '@/components/ui/select'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import api from '@/lib/api'
import { maskCurrency } from '@/lib/mask-value'
import { showToast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

// Local schema for simplified room creation
const createRoomSchema = z.object({
  name: z.string().min(1, 'Room name is required'),
  floor: z.string().optional(),
  totalBeds: z.string().refine((val) => {
    const num = parseInt(val)
    return !isNaN(num) && num > 0
  }, 'Total beds must be a positive number'),
  monthlyRentPerBed: z.string().min(1, 'Monthly rent is required').refine((val) => {
    const num = parseFloat(val)
    return !isNaN(num) && num >= 0
  }, 'Monthly rent must be a valid number'),
})
interface Bed {
  name: string
  price: number
  isOccupied: boolean
}

interface Room {
  _id: string
  name: string
  floor?: string
  beds?: Bed[]
  totalBeds: number
  monthlyRentPerBed: number
  status: 'available' | 'full'
  occupiedBeds: number
}

type RoomFormData = z.infer<typeof createRoomSchema>

type RentFormData = {
  name: string
  phone: string
  guardianName?: string
  guardianPhone?: string
  joiningDate: string
  monthlyRent?: string
  securityDeposit?: string
  unionFee?: string
  initialRentPaid?: string
}


export default function RoomsPage() {
  const user = useAuthStore((state) => state.user)
  const router = useRouter()
  const queryClient = useQueryClient()
  const isAdmin = user?.role === 'admin'
  const isStaff = user?.role === 'staff'
  const [showForm, setShowForm] = useState(false)
  const [showRentForm, setShowRentForm] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingRentData, setPendingRentData] = useState<RentFormData | null>(null)
  const [selectedBed, setSelectedBed] = useState<{ roomId: string; bedName: string; bedPrice: number } | null>(null)
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [editingRoom, setEditingRoom] = useState<Room | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const pageSize = 10

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    control,
    watch,
  } = useForm<RoomFormData>({
    resolver: zodResolver(createRoomSchema),
    defaultValues: {
      totalBeds: '',
      monthlyRentPerBed: '',
    },
  })

  const {
    register: registerRent,
    handleSubmit: handleSubmitRent,
    formState: { errors: rentErrors },
    reset: resetRent,
  } = useForm<RentFormData>({
    defaultValues: {
      joiningDate: new Date().toISOString().split('T')[0],
    },
  })

  const { data: roomsData } = useQuery<{
    data: Room[]
    total: number
    page: number
    limit: number
    totalPages: number
  }>({
    queryKey: ['rooms', page, searchQuery, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.append('page', page.toString())
      params.append('limit', pageSize.toString())
      if (searchQuery) params.append('search', searchQuery)
      if (statusFilter !== 'all') params.append('status', statusFilter)

      const response = await api.get(`/residential/rooms?${params.toString()}`)
      return response.data
    },
  })

  const rooms = roomsData?.data || []
  const totalPages = roomsData?.totalPages || 0
  const totalRooms = roomsData?.total || 0

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/residential/rooms', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
      showToast('Room created successfully', 'success')
      setShowForm(false)
      reset()
    },
    onError: (error: any) => {
      showToast(error.response?.data?.message || 'Failed to create room', 'error')
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (data: RoomFormData) => {
      if (!editingRoom) return
      return api.patch(`/residential/rooms/${editingRoom._id}`, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
      showToast('Room updated successfully', 'success')
      setShowForm(false)
      setEditingRoom(null)
      reset()
    },
    onError: (error: any) => {
      showToast(error.response?.data?.message || 'Failed to update room', 'error')
    },
  })

  const onSubmit = async (data: RoomFormData) => {
    if (editingRoom) {
      const rentPerBed = parseFloat(data.monthlyRentPerBed)
      const totalBedsCount = parseInt(data.totalBeds)

      updateMutation.mutate({
        name: data.name,
        floor: data.floor || undefined,
        totalBeds: totalBedsCount,
        monthlyRentPerBed: rentPerBed,
      } as any)
    } else {
      const rentPerBed = parseFloat(data.monthlyRentPerBed)
      const totalBedsCount = parseInt(data.totalBeds)

      // Auto-generate beds
      const beds = Array.from({ length: totalBedsCount }, (_, index) => ({
        name: `Bed ${index + 1}`,
        price: rentPerBed,
      }))

      createMutation.mutate({
        name: data.name,
        floor: data.floor || undefined,
        beds,
        totalBeds: totalBedsCount,
        monthlyRentPerBed: rentPerBed,
      })
    }
  }

  const rentMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/residential/students', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
      queryClient.invalidateQueries({ queryKey: ['students'] })
      setShowRentForm(false)
      setSelectedBed(null)
      resetRent()
      showToast('Student created and bed rented successfully!', 'success')
    },
    onError: (error: any) => {
      showToast(error.response?.data?.message || 'Failed to rent bed', 'error')
    },
  })

  const onRentSubmit = (data: RentFormData) => {
    setPendingRentData(data)
    setShowConfirm(true)
  }

  const handleConfirmRent = () => {
    if (!selectedBed || !pendingRentData) return

    rentMutation.mutate({
      name: pendingRentData.name,
      phone: pendingRentData.phone,
      guardianName: pendingRentData.guardianName || undefined,
      guardianPhone: pendingRentData.guardianPhone || undefined,
      roomId: selectedBed.roomId,
      bedName: selectedBed.bedName,
      joiningDate: new Date(pendingRentData.joiningDate).toISOString(),
      monthlyRent: pendingRentData.monthlyRent ? parseFloat(pendingRentData.monthlyRent) : undefined,
      securityDeposit: pendingRentData.securityDeposit ? parseFloat(pendingRentData.securityDeposit) : undefined,
      unionFee: pendingRentData.unionFee ? parseFloat(pendingRentData.unionFee) : undefined,
      initialRentPaid: pendingRentData.initialRentPaid ? parseFloat(pendingRentData.initialRentPaid) : undefined,
    })
    setShowConfirm(false)
  }


  const handleRentBed = (roomId: string, bedName: string, bedPrice: number) => {
    setSelectedBed({ roomId, bedName, bedPrice })
    setShowRentForm(true)
    resetRent({
      joiningDate: new Date().toISOString().split('T')[0],
      monthlyRent: bedPrice.toString(),
    })
  }

  const handleEditRoom = (room: Room) => {
    setEditingRoom(room)
    reset({
      name: room.name,
      floor: room.floor || '',
      totalBeds: room.totalBeds.toString(),
      monthlyRentPerBed: room.monthlyRentPerBed.toString(),
    })
    setShowForm(true)
  }

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    setPage(1)
  }, [searchQuery, statusFilter])

  useEffect(() => {
    if (!showForm) {
      setEditingRoom(null)
      reset({
        name: '',
        floor: '',
        totalBeds: '',
        monthlyRentPerBed: '',
      })
    }
  }, [showForm, reset])

  return (
    <ProtectedRoute>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Rooms</h1>
            {!isAdmin && !isStaff && (
              <p className="text-sm text-secondary mt-1">View-only mode - Contact admin for changes</p>
            )}
          </div>
          {isAdmin && (
            <Button
              onClick={() => setShowForm(!showForm)}
              className="h-10 px-6 font-semibold"
            >
              {showForm ? (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cancel
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Room
                </>
              )}
            </Button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <Input
            placeholder="Search by room name or floor..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setPage(1)
            }}
            className="flex-1 max-w-md"
          />
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            className="w-full sm:w-[180px]"
          >
            <option value="all">All Rooms</option>
            <option value="available">Available</option>
            <option value="full">Full / Booking</option>
          </Select>
        </div>

        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                {editingRoom ? 'Edit Room' : 'Add New Room'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Room Name/Number *</Label>
                  <Input
                    id="name"
                    {...register('name')}
                    placeholder="e.g., Room 101"
                  />
                  {errors.name && (
                    <p className="text-sm text-danger">{errors.name.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="floor">Floor</Label>
                  <Input
                    id="floor"
                    {...register('floor')}
                    placeholder="e.g., 1st Floor"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="monthlyRentPerBed">Monthly Rent per Bed (BDT) *</Label>
                  <Input
                    id="monthlyRentPerBed"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g., 5000"
                    {...register('monthlyRentPerBed')}
                  />
                  {errors.monthlyRentPerBed && (
                    <p className="text-sm text-danger">{errors.monthlyRentPerBed.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="totalBeds">Total Beds *</Label>
                  <Input
                    id="totalBeds"
                    type="number"
                    min="1"
                    placeholder="e.g., 4"
                    {...register('totalBeds')}
                  />
                  {errors.totalBeds && (
                    <p className="text-sm text-danger">{errors.totalBeds.message}</p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false)
                    setEditingRoom(null)
                    reset()
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-8 font-semibold"
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
                    'Create Room'
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Rent Form Modal */}
        {showRentForm && selectedBed && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto border-2 shadow-2xl">
              <CardHeader className="bg-primary/5 border-b">
                <CardTitle className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div>
                    <div>Rent Bed: <span className="text-primary">{selectedBed.bedName}</span></div>
                    <p className="text-sm font-normal text-secondary mt-1">
                      Price: {maskCurrency(selectedBed.bedPrice, false)}
                    </p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleSubmitRent(onRentSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="rent-name">Student Name *</Label>
                      <Input
                        id="rent-name"
                        {...registerRent('name', { required: 'Name is required' })}
                      />
                      {rentErrors.name && (
                        <p className="text-sm text-danger">{rentErrors.name.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rent-phone">Phone *</Label>
                      <Input
                        id="rent-phone"
                        {...registerRent('phone', { required: 'Phone is required' })}
                      />
                      {rentErrors.phone && (
                        <p className="text-sm text-danger">{rentErrors.phone.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rent-guardianName">Guardian Name</Label>
                      <Input
                        id="rent-guardianName"
                        {...registerRent('guardianName')}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rent-guardianPhone">Guardian Phone</Label>
                      <Input
                        id="rent-guardianPhone"
                        {...registerRent('guardianPhone')}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rent-joiningDate">Joining Date *</Label>
                      <Input
                        id="rent-joiningDate"
                        type="date"
                        {...registerRent('joiningDate', { required: 'Joining date is required' })}
                      />
                      {rentErrors.joiningDate && (
                        <p className="text-sm text-danger">{rentErrors.joiningDate.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rent-monthlyRent">Monthly Rent (BDT)</Label>
                      <Input
                        id="rent-monthlyRent"
                        type="number"
                        min="0"
                        step="0.01"
                        {...registerRent('monthlyRent')}
                      />
                      <p className="text-xs text-secondary">Default: {maskCurrency(selectedBed.bedPrice, false)}</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rent-initialRentPaid">Initial Rent Paid (BDT)</Label>
                      <Input
                        id="rent-initialRentPaid"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Current payment"
                        {...registerRent('initialRentPaid')}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rent-securityDeposit">Security Deposit (BDT)</Label>
                      <Input
                        id="rent-securityDeposit"
                        type="number"
                        min="0"
                        step="0.01"
                        {...registerRent('securityDeposit')}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rent-unionFee">Union Fee (BDT)</Label>
                      <Input
                        id="rent-unionFee"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="One-time fee"
                        {...registerRent('unionFee')}
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      type="submit"
                      disabled={rentMutation.isPending}
                      className="flex-1 h-11 font-semibold"
                    >
                      {rentMutation.isPending ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Renting...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Rent Bed
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 px-6"
                      onClick={() => {
                        setShowRentForm(false)
                        setSelectedBed(null)
                        resetRent()
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50 font-bold uppercase text-[10px] tracking-wider text-secondary">
                <TableRow>
                  <TableHead className="w-[150px]">Room Name</TableHead>
                  <TableHead className="w-[100px]">Floor</TableHead>
                  <TableHead className="text-center w-[150px]">Occupancy</TableHead>
                  <TableHead className="w-[150px]">Rent/Bed</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rooms.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-64 text-center text-secondary">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <svg className="w-12 h-12 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                        <p>No rooms found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  rooms.map((room) => (
                    <TableRow key={room._id} className="hover:bg-muted/30 transition-colors group">
                      <TableCell className="font-semibold">{room.name}</TableCell>
                      <TableCell>{room.floor || 'N/A'}</TableCell>
                      <TableCell>
                        <div className="flex flex-col items-center gap-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold">{room.occupiedBeds}</span>
                            <span className="text-[10px] text-secondary">/</span>
                            <span className="text-xs text-secondary">{room.totalBeds}</span>
                          </div>
                          <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full transition-all duration-500",
                                room.occupiedBeds === room.totalBeds ? "bg-danger" : "bg-primary"
                              )}
                              style={{ width: `${(room.occupiedBeds / room.totalBeds) * 100}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {maskCurrency(room.monthlyRentPerBed, user?.role === 'staff')}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            'text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border',
                            room.status === 'available'
                              ? 'bg-success/10 text-success border-success/30'
                              : 'bg-danger/10 text-danger border-danger/30'
                          )}
                        >
                          {room.status === 'available' ? 'Available' : 'Full'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-3 text-xs"
                            onClick={() => setSelectedRoom(room)}
                          >
                            Details
                          </Button>
                          {isAdmin && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-3 text-xs border-primary/30 text-primary hover:bg-primary/5"
                              onClick={() => {
                                setEditingRoom(room)
                                reset({
                                  name: room.name,
                                  floor: room.floor || '',
                                  totalBeds: room.totalBeds.toString(),
                                  monthlyRentPerBed: room.monthlyRentPerBed.toString(),
                                })
                                setShowForm(true)
                              }}
                            >
                              Edit
                            </Button>
                          )}
                          <Button
                            size="sm"
                            className="h-8 px-3 text-xs"
                            onClick={() => {
                              const availableBed = room.beds?.find(b => !b.isOccupied);
                              if (availableBed) {
                                handleRentBed(room._id, availableBed.name, availableBed.price);
                              }
                            }}
                            disabled={(!isAdmin && !isStaff) || room.status === 'full'}
                          >
                            Rent
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-sm text-secondary">
              Page {page} of {totalPages} ({totalRooms} total)
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

        {/* Room Details / Rent Modal */}
        <Dialog open={!!selectedRoom} onOpenChange={(open) => !open && setSelectedRoom(null)}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                Room {selectedRoom?.name}
                <span className="text-xs font-normal text-secondary">(Floor {selectedRoom?.floor || 'N/A'})</span>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/30 p-3 rounded-lg flex flex-col items-center justify-center border">
                  <span className="text-[10px] uppercase font-bold text-secondary mb-1">Rent per Bed</span>
                  <span className="text-lg font-bold text-primary">
                    {selectedRoom ? maskCurrency(selectedRoom.monthlyRentPerBed, user?.role === 'staff') : '-'}
                  </span>
                </div>
                <div className="bg-muted/30 p-3 rounded-lg flex flex-col items-center justify-center border">
                  <span className="text-[10px] uppercase font-bold text-secondary mb-1">Available</span>
                  <span className="text-lg font-bold">
                    {selectedRoom?.beds?.filter(b => !b.isOccupied).length} / {selectedRoom?.totalBeds}
                  </span>
                </div>
              </div>
              
              <div className="space-y-3">
                <Label className="text-sm font-bold">Bed Appointments</Label>
                <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2">
                  {selectedRoom?.beds?.map((bed, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border transition-colors",
                        bed.isOccupied 
                          ? "bg-secondary/5 border-secondary/20" 
                          : "bg-success/5 border-success/20 hover:bg-success/10"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-md flex items-center justify-center font-bold text-xs",
                          bed.isOccupied ? "bg-secondary/20 text-secondary" : "bg-success/20 text-success"
                        )}>
                          {bed.name.split(' ').pop()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{bed.name}</p>
                          <p className="text-[10px] text-secondary">{maskCurrency(bed.price, user?.role === 'staff')}</p>
                        </div>
                      </div>
                      
                      {bed.isOccupied ? (
                        <span className="text-[10px] font-bold text-danger uppercase">Occupied</span>
                      ) : (
                        <Button
                          size="sm"
                          className="h-7 px-3 text-[10px] font-bold uppercase"
                          onClick={() => {
                            handleRentBed(selectedRoom._id, bed.name, bed.price);
                            setSelectedRoom(null);
                          }}
                          disabled={!isAdmin && !isStaff}
                        >
                          Rent
                        </Button>
                      )}
                    </div>
                  ))}
                  {(!selectedRoom?.beds || selectedRoom.beds.length === 0) && (
                     <p className="text-center text-sm text-secondary py-4">No beds defined for this room</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <Button variant="ghost" onClick={() => setSelectedRoom(null)}>Close</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <ConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        onConfirm={handleConfirmRent}
        title="Confirm Bed Rental"
        description={
          pendingRentData && selectedBed ? (
            <div className="space-y-2">
              <p>Are you sure you want to rent <strong>{selectedBed.bedName}</strong> to <strong>{pendingRentData.name}</strong>?</p>
              <div className="bg-secondary/10 p-3 rounded-md text-sm">
                <div className="flex justify-between">
                  <span>Monthly Rent:</span>
                  <span className="font-medium">{maskCurrency(pendingRentData.monthlyRent ? parseFloat(pendingRentData.monthlyRent) : selectedBed.bedPrice, false)}</span>
                </div>
                {pendingRentData.securityDeposit && (
                  <div className="flex justify-between">
                    <span>Security Deposit:</span>
                    <span className="font-medium">{maskCurrency(parseFloat(pendingRentData.securityDeposit), false)}</span>
                  </div>
                )}
                 {pendingRentData.initialRentPaid && (
                  <div className="flex justify-between mt-1 pt-1 border-t border-secondary/20">
                    <span>Initial Payment:</span>
                    <span className="font-medium text-success">{maskCurrency(parseFloat(pendingRentData.initialRentPaid), false)}</span>
                  </div>
                )}
              </div>
            </div>
          ) : 'Are you sure you want to proceed?'
        }
        confirmText="Confirm & Rent"
        isLoading={rentMutation.isPending}
      />
    </ProtectedRoute>
  )
}
