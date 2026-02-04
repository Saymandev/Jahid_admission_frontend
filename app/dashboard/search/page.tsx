'use client'

import { ProtectedRoute } from '@/components/protected-route'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SearchResult {
  type: 'room' | 'student' | 'transaction' | 'coaching'
  id: string
  title: string
  subtitle?: string
  link: string
  icon: string
}

export default function SearchPage() {
  const searchParams = useSearchParams()
  const query = searchParams.get('q') || ''
  const [page, setPage] = useState(1)
  const pageSize = 10

  const { data: roomsData } = useQuery({
    queryKey: ['rooms'],
    queryFn: async () => {
      const response = await api.get('/residential/rooms?limit=1000')
      return response.data
    },
    enabled: !!query,
  })

  const { data: studentsData } = useQuery({
    queryKey: ['students'],
    queryFn: async () => {
      const response = await api.get('/residential/students?limit=1000')
      return response.data
    },
    enabled: !!query,
  })

  const { data: transactionsData } = useQuery({
    queryKey: ['transactions'],
    queryFn: async () => {
      const residentialResponse = await api.get('/residential/payments?limit=1000')
      const coachingResponse = await api.get('/coaching/payments?limit=1000')
      const residential = (residentialResponse.data?.data || residentialResponse.data || []).map((p: any) => ({
        ...p,
        type: 'residential' as const,
        studentName: p.studentId?.name,
      }))
      const coaching = (coachingResponse.data?.data || coachingResponse.data || []).map((p: any) => ({
        ...p,
        type: 'coaching' as const,
        admissionStudentName: p.admissionId?.studentName,
        course: p.admissionId?.course,
      }))
      return [...residential, ...coaching]
    },
    enabled: !!query,
  })

  const { data: coachingData } = useQuery({
    queryKey: ['coaching-admissions'],
    queryFn: async () => {
      const response = await api.get('/coaching/admissions?limit=1000')
      return response.data
    },
    enabled: !!query,
  })

  // Extract data arrays from paginated responses
  const rooms = roomsData?.data || roomsData || []
  const students = studentsData?.data || studentsData || []
  const transactions = transactionsData || []
  const coaching = coachingData?.data || coachingData || []

  const searchResults = useMemo(() => {
    if (!query.trim()) return []

    const results: SearchResult[] = []
    const lowerQuery = query.toLowerCase()

    // Search rooms
    if (rooms && Array.isArray(rooms)) {
      rooms.forEach((room: any) => {
        if (
          room?.name?.toLowerCase().includes(lowerQuery) ||
          (room?.floor && room.floor.toLowerCase().includes(lowerQuery))
        ) {
          results.push({
            type: 'room',
            id: room._id,
            title: room.name || 'Unknown Room',
            subtitle: room.floor || 'Room',
            link: `/dashboard/rooms`,
            icon: '🏠',
          })
        }
      })
    }

    // Search students
    if (students && Array.isArray(students)) {
      students.forEach((student: any) => {
        if (
          student?.name?.toLowerCase().includes(lowerQuery) ||
          student?.studentId?.toLowerCase().includes(lowerQuery) ||
          student?.phone?.includes(query) ||
          student?.roomId?.name?.toLowerCase().includes(lowerQuery)
        ) {
          results.push({
            type: 'student',
            id: student._id,
            title: student.name || 'Unknown Student',
            subtitle: `${student.studentId || 'N/A'} - ${student.roomId?.name || 'No Room'}`,
            link: `/dashboard/students/${student._id}`,
            icon: '👤',
          })
        }
      })
    }

    // Search transactions
    if (transactions && Array.isArray(transactions)) {
      transactions.forEach((txn: any) => {
        const studentName = txn.studentName || txn.admissionStudentName
        const amount = txn.amount || txn.paidAmount || 0
        const paymentMethod = txn.paymentMethod || 'Unknown'
        if (
          studentName?.toLowerCase().includes(lowerQuery) ||
          paymentMethod.toLowerCase().includes(lowerQuery) ||
          txn.transactionId?.toLowerCase().includes(lowerQuery)
        ) {
          results.push({
            type: 'transaction',
            id: txn._id,
            title: `${studentName || 'Unknown'} - ${amount.toLocaleString()} BDT`,
            subtitle: `${txn.type === 'residential' ? 'Residential' : 'Coaching'} Payment - ${paymentMethod}`,
            link: `/dashboard/transactions`,
            icon: '💳',
          })
        }
      })
    }

    // Search coaching admissions
    if (coaching && Array.isArray(coaching)) {
      coaching.forEach((admission: any) => {
        if (
          admission?.studentName?.toLowerCase().includes(lowerQuery) ||
          admission?.course?.toLowerCase().includes(lowerQuery) ||
          admission?.batch?.toLowerCase().includes(lowerQuery) ||
          admission?.phone?.includes(query)
        ) {
          results.push({
            type: 'coaching',
            id: admission._id,
            title: admission.studentName || 'Unknown Student',
            subtitle: `${admission.course || 'N/A'} - ${admission.batch || 'N/A'}`,
            link: `/dashboard/coaching`,
            icon: '📚',
          })
        }
      })
    }

    return results
  }, [query, rooms, students, transactions, coaching])

  // Pagination
  const totalPages = Math.ceil(searchResults.length / pageSize)
  const paginatedResults = useMemo(() => {
    const startIndex = (page - 1) * pageSize
    return searchResults.slice(startIndex, startIndex + pageSize)
  }, [searchResults, page, pageSize])

  if (!query.trim()) {
    return (
      <ProtectedRoute>
        <div className="p-6">
          <Card>
            <CardContent className="p-12 text-center">
              <div className="text-6xl mb-4">🔍</div>
              <h2 className="text-2xl font-bold mb-2">Search</h2>
              <p className="text-secondary">Enter a search query to find rooms, students, transactions, or coaching admissions</p>
            </CardContent>
          </Card>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Search Results</h1>
          <p className="text-secondary mt-1">
            Found {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{query}"
          </p>
        </div>

        {searchResults.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-lg font-semibold mb-2">No results found</h3>
              <p className="text-secondary text-sm">
                Try searching for room names, student names, phone numbers, or transaction IDs
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-4">
              {paginatedResults.map((result) => (
              <Card key={`${result.type}-${result.id}`} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <Link href={result.link} className="flex items-center gap-4">
                    <span className="text-3xl">{result.icon}</span>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{result.title}</h3>
                      {result.subtitle && (
                        <p className="text-sm text-secondary mt-1">{result.subtitle}</p>
                      )}
                    </div>
                    <div>
                      <span
                        className={cn(
                          'px-3 py-1 rounded-full text-xs font-medium',
                          result.type === 'room'
                            ? 'bg-blue-100 text-blue-700'
                            : result.type === 'student'
                            ? 'bg-green-100 text-green-700'
                            : result.type === 'transaction'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-orange-100 text-orange-700'
                        )}
                      >
                        {result.type === 'room'
                          ? 'Room'
                          : result.type === 'student'
                          ? 'Student'
                          : result.type === 'transaction'
                          ? 'Transaction'
                          : 'Coaching'}
                      </span>
                    </div>
                    <Button variant="outline" size="sm">
                      View →
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t">
                <p className="text-sm text-secondary">
                  Page {page} of {totalPages} ({searchResults.length} total)
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
          </>
        )}
      </div>
    </ProtectedRoute>
  )
}
