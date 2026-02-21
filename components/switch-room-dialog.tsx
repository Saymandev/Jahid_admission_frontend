'use client'

import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import api from '@/lib/api'
import { showToast } from '@/lib/toast'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

interface SwitchRoomDialogProps {
  isOpen: boolean
  onClose: () => void
  studentId: string
  currentRoomId: string
  currentBedNumber: number
  currentRent: number
  studentName: string
}

export function SwitchRoomDialog({
  isOpen,
  onClose,
  studentId,
  currentRoomId,
  currentBedNumber,
  currentRent,
  studentName
}: SwitchRoomDialogProps) {
  const queryClient = useQueryClient()
  const [selectedRoomId, setSelectedRoomId] = useState('')
  const [selectedBedNumber, setSelectedBedNumber] = useState<number | null>(null)
  const [newRent, setNewRent] = useState(currentRent)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch all available/occupied rooms
  const { data: roomsResponse, isLoading: isLoadingRooms } = useQuery({
    queryKey: ['rooms-for-switch'],
    queryFn: async () => {
      const response = await api.get('/residential/rooms?limit=100&status=available')
      return response.data.data
    },
    enabled: isOpen
  })

  const rooms = roomsResponse || []
  const selectedRoom = rooms.find((r: any) => r._id === selectedRoomId)

  const handleSwitch = async () => {
    if (!selectedRoomId || !selectedBedNumber) {
      showToast('Please select a room and bed', 'error')
      return
    }

    setIsSubmitting(true)
    try {
      await api.post(`/residential/students/${studentId}/switch-room`, {
        newRoomId: selectedRoomId,
        newBedNumber: selectedBedNumber,
        newMonthlyRent: newRent
      })
      showToast('Room switched successfully', 'success')
      queryClient.invalidateQueries({ queryKey: ['student', studentId] })
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      onClose()
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to switch room'
      showToast(message, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  useEffect(() => {
    if (selectedRoom) {
      setNewRent(selectedRoom.monthlyRentPerBed || 0)
      setSelectedBedNumber(null)
    }
  }, [selectedRoomId, selectedRoom])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Switch Room: {studentName}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="room">Select New Room</Label>
            <select
              id="room"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
            >
              <option value="">Select a room...</option>
              {rooms.map((room: any) => (
                <option key={room._id} value={room._id}>
                  {room.name} ({room.floor ? `Floor ${room.floor}` : 'N/A'}) - {room.totalBeds - room.occupiedBeds} beds left
                </option>
              ))}
            </select>
          </div>

          {selectedRoomId && (
            <div className="grid gap-2">
              <Label>Select Available Bed</Label>
              <div className="grid grid-cols-4 gap-2">
                {selectedRoom?.beds.map((bed: any, index: number) => {
                  const bedNum = index + 1
                  const isAvailable = !bed.isOccupied
                  return (
                    <Button
                      key={index}
                      type="button"
                      variant={selectedBedNumber === bedNum ? 'default' : 'outline'}
                      size="sm"
                      disabled={!isAvailable}
                      className={!isAvailable ? 'opacity-50 cursor-not-allowed bg-gray-100' : ''}
                      onClick={() => setSelectedBedNumber(bedNum)}
                    >
                      {bedNum}
                    </Button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="rent">New Monthly Rent (BDT)</Label>
            <Input
              id="rent"
              type="number"
              value={newRent}
              onChange={(e) => setNewRent(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">Current: {currentRent} BDT</p>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSwitch} disabled={isSubmitting || !selectedBedNumber}>
            {isSubmitting ? 'Switching...' : 'Confirm Switch'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
