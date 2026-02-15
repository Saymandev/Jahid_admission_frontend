'use client'

import { ProtectedRoute } from '@/components/protected-route'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

export default function AuditLogsPage() {
  const user = useAuthStore((state) => state.user)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [entityFilter, setEntityFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('all') // all, today, week, month
  
  // Fetch users for filter (optional, maybe later)

  const { data: logsData, isLoading } = useQuery({
    queryKey: ['audit-logs', page, search, actionFilter, entityFilter, dateFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.append('page', page.toString())
      params.append('limit', '20')
      if (search) params.append('search', search)
      if (actionFilter && actionFilter !== 'all') params.append('action', actionFilter)
      if (entityFilter && entityFilter !== 'all') params.append('entity', entityFilter)
      
      const now = new Date()
      if (dateFilter === 'today') {
        params.append('startDate', new Date(now.setHours(0,0,0,0)).toISOString())
      } else if (dateFilter === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        params.append('startDate', weekAgo.toISOString())
      } else if (dateFilter === 'month') {
        const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1)
        params.append('startDate', monthAgo.toISOString())
      }

      const res = await api.get(`/residential/audit-logs?${params.toString()}`)
      return res.data
    },
    enabled: user?.role === 'admin',
  })

  if (user?.role !== 'admin') {
    return (
      <ProtectedRoute>
        <div className="p-6">Access Denied</div>
      </ProtectedRoute>
    )
  }

  const logs = logsData?.data || []
  const totalPages = logsData?.totalPages || 0

  return (
    <ProtectedRoute>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Audit Logs</h1>
          <p className="text-secondary mt-1">Track system activities and changes</p>
        </div>

        <div className="flex flex-wrap gap-4">
          <Input 
            placeholder="Search details..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-64"
          />
          <Select 
            value={actionFilter} 
            onChange={(e) => setActionFilter(e.target.value)}
          >
            <option value="">All Actions</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
            <option value="restore">Restore</option>
            <option value="payment">Payment</option>
            <option value="login">Login</option>
          </Select>
          <Select 
            value={entityFilter} 
            onChange={(e) => setEntityFilter(e.target.value)}
          >
            <option value="">All Entities</option>
            <option value="Student">Student</option>
            <option value="Room">Room</option>
            <option value="Payment">Payment</option>
            <option value="User">User</option>
          </Select>
           <Select 
            value={dateFilter} 
            onChange={(e) => setDateFilter(e.target.value)}
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead className="text-right">Changes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">Loading...</TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                   <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">No logs found</TableCell>
                  </TableRow>
                ) : (
                  logs.map((log: any) => (
                    <TableRow key={log._id}>
                      <TableCell className="whitespace-nowrap">
                        <div className="font-medium">{new Date(log.createdAt).toLocaleDateString()}</div>
                        <div className="text-xs text-secondary">{new Date(log.createdAt).toLocaleTimeString()}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{log.userId?.name || 'System'}</div>
                        <div className="text-xs text-secondary">{log.userId?.email}</div>
                      </TableCell>
                      <TableCell>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-medium uppercase",
                          log.action === 'create' ? "bg-green-100 text-green-700" :
                          log.action === 'update' ? "bg-blue-100 text-blue-700" :
                          log.action === 'delete' ? "bg-red-100 text-red-700" :
                          "bg-gray-100 text-gray-700"
                        )}>
                          {log.action}
                        </span>
                      </TableCell>
                      <TableCell>{log.entity}</TableCell>
                       <TableCell className="max-w-xs truncate" title={log.description || '-'}>
                        {log.description || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {(log.oldData || log.newData) && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm">View Diff</Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>Change Details</DialogTitle>
                              </DialogHeader>
                              <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                                <div>
                                  <h4 className="font-semibold mb-2 text-danger">Old Data</h4>
                                  <pre className="bg-muted p-2 rounded overflow-x-auto">
                                    {log.oldData ? JSON.stringify(log.oldData, null, 2) : '-'}
                                  </pre>
                                </div>
                                <div>
                                  <h4 className="font-semibold mb-2 text-success">New Data</h4>
                                  <pre className="bg-muted p-2 rounded overflow-x-auto">
                                    {log.newData ? JSON.stringify(log.newData, null, 2) : '-'}
                                  </pre>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {totalPages > 1 && (
          <div className="flex justify-between items-center">
            <p className="text-sm text-secondary">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
               <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
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
