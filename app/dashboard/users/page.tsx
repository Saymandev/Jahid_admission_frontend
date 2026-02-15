'use client'

import { ProtectedRoute } from '@/components/protected-route'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import api from '@/lib/api'
import { showToast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

const userSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['admin', 'staff']),
})

type UserFormData = z.infer<typeof userSchema>

interface User {
  _id: string
  name: string
  email: string
  role: 'admin' | 'staff'
  isActive: boolean
  createdAt: string
}

export default function UsersPage() {
  const user = useAuthStore((state) => state.user)
  const [showForm, setShowForm] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 10
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      role: 'staff',
    },
  })

  const { data: usersData, isLoading } = useQuery<{
    data: User[]
    total: number
    page: number
    limit: number
    totalPages: number
  }>({
    queryKey: ['users', page],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.append('page', page.toString())
      params.append('limit', pageSize.toString())
      
      const response = await api.get(`/users?${params.toString()}`)
      return response.data
    },
  })

  const users = usersData?.data || []
  const totalPages = usersData?.totalPages || 0
  const totalUsers = usersData?.total || 0

  const createMutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      const response = await api.post('/users', data)
      return response.data
    },
    onSuccess: () => {
      showToast('User created successfully!', 'success')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      reset()
      setShowForm(false)
    },
    onError: (error: any) => {
      showToast(error.response?.data?.message || 'Failed to create user', 'error')
    },
  })

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const response = await api.patch(`/users/${id}`, { isActive })
      return response.data
    },
    onSuccess: () => {
      showToast('User status updated!', 'success')
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: () => {
      showToast('Failed to update user status', 'error')
    },
  })

  const onSubmit = (data: UserFormData) => {
    createMutation.mutate(data)
  }

  if (user?.role !== 'admin') {
    return (
      <ProtectedRoute>
        <div className="p-6">You don&apos;t have permission to access this page.</div>
      </ProtectedRoute>
    )
  }


  return (
    <ProtectedRoute>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">User Management</h1>
            <p className="text-secondary mt-1">Manage system users</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : 'Add User'}
          </Button>
        </div>

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>Create New User</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input id="name" {...register('name')} />
                    {errors.name && (
                      <p className="text-sm text-danger">{errors.name.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input id="email" type="email" {...register('email')} />
                    {errors.email && (
                      <p className="text-sm text-danger">{errors.email.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password *</Label>
                    <Input id="password" type="password" {...register('password')} />
                    {errors.password && (
                      <p className="text-sm text-danger">{errors.password.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role *</Label>
                    <Select id="role" {...register('role')}>
                      <option value="staff">Staff</option>
                      <option value="admin">Admin</option>
                    </Select>
                    {errors.role && (
                      <p className="text-sm text-danger">{errors.role.message}</p>
                    )}
                  </div>
                </div>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create User'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Users ({users?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading...</div>
            ) : users.length === 0 ? (
              <div className="p-12 text-center">
                <div className="text-6xl mb-4">👤</div>
                <h3 className="text-lg font-semibold mb-2">No users found</h3>
                <p className="text-secondary text-sm">Get started by creating your first user</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {users.map((u: User) => (
                    <div
                      key={u._id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-primary/5 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-lg font-medium text-primary">
                            {u.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{u.name}</p>
                          <p className="text-sm text-secondary">{u.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span
                          className={cn(
                            'px-2 py-1 rounded text-xs font-medium',
                            u.role === 'admin'
                              ? 'bg-primary/10 text-primary'
                              : 'bg-secondary/10 text-secondary'
                          )}
                        >
                          {u.role}
                        </span>
                        <span
                          className={cn(
                            'px-2 py-1 rounded text-xs font-medium',
                            u.isActive
                              ? 'bg-success/10 text-success'
                              : 'bg-danger/10 text-danger'
                          )}
                        >
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            toggleActiveMutation.mutate({
                              id: u._id,
                              isActive: !u.isActive,
                            })
                          }
                          disabled={toggleActiveMutation.isPending}
                        >
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t">
                    <p className="text-sm text-secondary">
                      Page {page} of {totalPages} ({totalUsers} total)
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  )
}
