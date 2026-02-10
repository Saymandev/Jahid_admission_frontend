'use client'

import { ProtectedRoute } from '@/components/protected-route'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
}

export default function RoomsPage() {
  const user = useAuthStore((state) => state.user)
  const router = useRouter()
  const queryClient = useQueryClient()
  const isAdmin = user?.role === 'admin'
  const [showForm, setShowForm] = useState(false)
  const [showRentForm, setShowRentForm] = useState(false)
  const [selectedBed, setSelectedBed] = useState<{ roomId: string; bedName: string; bedPrice: number } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
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
    queryKey: ['rooms', page, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.append('page', page.toString())
      params.append('limit', pageSize.toString())
      if (searchQuery) params.append('search', searchQuery)
      
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
      setShowForm(false)
      reset()
      showToast('Room created successfully!', 'success')
    },
    onError: (error: any) => {
      showToast(error.response?.data?.message || 'Failed to create room', 'error')
    },
  })

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

  const onSubmit = (data: RoomFormData) => {
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

  const onRentSubmit = (data: RentFormData) => {
    if (!selectedBed) return

    rentMutation.mutate({
      name: data.name,
      phone: data.phone,
      guardianName: data.guardianName || undefined,
      guardianPhone: data.guardianPhone || undefined,
      roomId: selectedBed.roomId,
      bedName: selectedBed.bedName,
      joiningDate: new Date(data.joiningDate).toISOString(),
      monthlyRent: data.monthlyRent ? parseFloat(data.monthlyRent) : undefined,
      securityDeposit: data.securityDeposit ? parseFloat(data.securityDeposit) : undefined,
    })
  }

  const handleRentBed = (roomId: string, bedName: string, bedPrice: number) => {
    setSelectedBed({ roomId, bedName, bedPrice })
    setShowRentForm(true)
    resetRent({
      joiningDate: new Date().toISOString().split('T')[0],
      monthlyRent: bedPrice.toString(),
    })
  }

  // Reset to page 1 when search changes
  useEffect(() => {
    setPage(1)
  }, [searchQuery])

  return (
    <ProtectedRoute>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Rooms</h1>
            {!isAdmin && (
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

        {/* Search */}
        <Input
          placeholder="Search by room name or floor..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value)
            setPage(1)
          }}
          className="max-w-md"
        />

        {isAdmin && showForm && (
          <Card className="border-2">
            <CardHeader className="bg-primary/5 border-b">
              <CardTitle className="flex items-center gap-2">
                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add New Room
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Room Name/Number *</Label>
                    <Input
                      id="name"
                      {...register('name')}
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
                    <p className="text-xs text-secondary">This price will apply to all beds in the room</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="totalBeds">Total Beds *</Label>
                    <Input
                      id="totalBeds"
                      type="number"
                      min="1"
                      {...register('totalBeds')}
                    />
                    {errors.totalBeds && (
                      <p className="text-sm text-danger">{errors.totalBeds.message}</p>
                    )}
                    <p className="text-xs text-secondary">We'll automatically name them Bed 1, Bed 2, etc.</p>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending}
                    className="flex-1 h-11 font-semibold"
                  >
                    {createMutation.isPending ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Creating...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Create Room
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

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
                      <Label htmlFor="rent-securityDeposit">Security Deposit (BDT)</Label>
                      <Input
                        id="rent-securityDeposit"
                        type="number"
                        min="0"
                        step="0.01"
                        {...registerRent('securityDeposit')}
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

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rooms.length === 0 ? (
            <Card className="col-span-full border-2 border-dashed">
              <CardContent className="p-12 text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                  <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  {searchQuery ? 'No rooms found' : 'No rooms yet'}
                </h3>
                <p className="text-secondary text-sm mb-4">
                  {searchQuery
                    ? 'Try adjusting your search criteria'
                    : 'Get started by adding your first room'}
                </p>
                {!searchQuery && isAdmin && (
                  <Button onClick={() => setShowForm(true)}>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Your First Room
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            rooms.map((room: Room) => (
              <Card key={room._id} className="hover:shadow-lg transition-all duration-200 border-2 hover:border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                    </div>
                    {room.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <span className="text-xs text-secondary flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                        Floor
                      </span>
                      <p className="text-sm font-semibold">{room.floor || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-secondary flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                        Beds
                      </span>
                      <p className="text-sm font-semibold">
                        <span className={cn(
                          room.occupiedBeds === room.totalBeds ? 'text-danger' : 'text-success'
                        )}>
                          {room.occupiedBeds}
                        </span>
                        <span className="text-secondary"> / {room.totalBeds}</span>
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <span className="text-xs text-secondary flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Avg. Rent
                    </span>
                    <p className="text-lg font-bold text-primary">
                      {maskCurrency(room.monthlyRentPerBed, user?.role === 'staff')}
                    </p>
                  </div>
                  
                  {/* Beds List */}
                  {room.beds && room.beds.length > 0 ? (
                    <div className="space-y-2 pt-3 border-t">
                      <Label className="text-sm font-semibold flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                        Beds
                      </Label>
                      <div className="space-y-2">
                        {room.beds.map((bed, index) => (
                          <div
                            key={index}
                            className={cn(
                              'flex items-center justify-between p-3 rounded-lg border transition-all',
                              bed.isOccupied
                                ? 'bg-secondary/30 border-secondary/50'
                                : 'bg-success/5 border-success/20 hover:bg-success/10 hover:border-success/30'
                            )}
                          >
                            <div className="flex items-center gap-3 flex-1">
                              <div className={cn(
                                'w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm',
                                bed.isOccupied
                                  ? 'bg-secondary/50 text-secondary-foreground'
                                  : 'bg-success/20 text-success'
                              )}>
                                {bed.name.split(' ')[1] || bed.name.charAt(bed.name.length - 1)}
                              </div>
                              <div>
                                <p className="font-semibold text-sm">{bed.name}</p>
                                <p className="text-xs text-secondary">
                                  {maskCurrency(bed.price, user?.role === 'staff')}
                                </p>
                              </div>
                            </div>
                            {bed.isOccupied ? (
                              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-danger/10 text-danger border border-danger/20">
                                Occupied
                              </span>
                            ) : (
                              <Button
                                size="sm"
                                className="h-8 px-4 text-xs font-medium"
                                onClick={() => handleRentBed(room._id, bed.name, bed.price)}
                                disabled={!isAdmin}
                              >
                                Rent
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="pt-3 border-t">
                      <p className="text-xs text-secondary text-center py-2">No bed details available</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-xs text-secondary">Status</span>
                    <span
                      className={cn(
                        'text-xs font-semibold px-3 py-1.5 rounded-full',
                        room.status === 'available'
                          ? 'bg-success/10 text-success border border-success/20'
                          : 'bg-danger/10 text-danger border border-danger/20'
                      )}
                    >
                      {room.status === 'available' ? '✓ Available' : '✕ Full'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
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
      </div>
    </ProtectedRoute>
  )
}
