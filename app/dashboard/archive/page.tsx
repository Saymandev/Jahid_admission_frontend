'use client'

import { ProtectedRoute } from '@/components/protected-route'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { showToast } from '@/lib/toast'
import { useAuthStore } from '@/store/auth-store'
import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'

interface ArchivedStudent {
  _id: string
  studentId: string
  name: string
  phone: string
  roomId?: {
    name: string
  }
  deletedAt: string
}

interface ArchivedRoom {
  _id: string
  name: string
  floor?: string
  deletedAt: string
}

interface ArchivedAdmission {
  _id: string
  admissionId: string
  studentName: string
  course: string
  batch: string
  deletedAt: string
}

export default function ArchivePage() {
  const user = useAuthStore((state) => state.user)
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'students' | 'rooms' | 'admissions'>('students')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10

  // Note: These endpoints need to be created in the backend
  // For now, we'll show a message that archive viewing is not yet implemented
  // You'll need to add endpoints like:
  // GET /residential/students?includeDeleted=true
  // GET /residential/rooms?includeDeleted=true
  // GET /coaching/admissions?includeDeleted=true

  if (user?.role !== 'admin') {
    return (
      <ProtectedRoute>
        <div className="p-6">You don't have permission to access this page.</div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Archive</h1>
          <p className="text-secondary mt-1">View and manage archived data</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b">
          <button
            onClick={() => setActiveTab('students')}
            className={cn(
              'px-4 py-2 font-medium border-b-2 transition-colors',
              activeTab === 'students'
                ? 'border-primary text-primary'
                : 'border-transparent text-secondary hover:text-primary'
            )}
          >
            Archived Students
          </button>
          <button
            onClick={() => setActiveTab('rooms')}
            className={cn(
              'px-4 py-2 font-medium border-b-2 transition-colors',
              activeTab === 'rooms'
                ? 'border-primary text-primary'
                : 'border-transparent text-secondary hover:text-primary'
            )}
          >
            Archived Rooms
          </button>
          <button
            onClick={() => setActiveTab('admissions')}
            className={cn(
              'px-4 py-2 font-medium border-b-2 transition-colors',
              activeTab === 'admissions'
                ? 'border-primary text-primary'
                : 'border-transparent text-secondary hover:text-primary'
            )}
          >
            Archived Admissions
          </button>
        </div>

        {/* Search */}
        <Input
          placeholder="Search archived items..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />

        {/* Content */}
        <Card>
          <CardContent className="p-12 text-center">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-lg font-semibold mb-2">Archive View Coming Soon</h3>
            <p className="text-secondary text-sm mb-4">
              The archive functionality requires backend endpoints to be implemented.
            </p>
            <p className="text-secondary text-sm">
              Backend endpoints needed:
            </p>
            <ul className="text-left text-sm text-secondary mt-2 space-y-1 max-w-md mx-auto">
              <li>• GET /residential/students?includeDeleted=true</li>
              <li>• GET /residential/rooms?includeDeleted=true</li>
              <li>• GET /coaching/admissions?includeDeleted=true</li>
              <li>• POST /residential/students/:id/restore</li>
              <li>• POST /residential/rooms/:id/restore</li>
              <li>• POST /coaching/admissions/:id/restore</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  )
}
