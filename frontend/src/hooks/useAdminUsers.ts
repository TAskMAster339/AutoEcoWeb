import { keepPreviousData, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/admin'
import type { AdminUserFilters, UserRole, UserStatus } from '../api/types'

const PAGE_SIZE = 50

/** Admin user list with cursor pagination (backend: GET /api/v1/admin/users). */
export function useAdminUsers(filters: AdminUserFilters) {
  return useInfiniteQuery({
    queryKey: ['admin-users', filters],
    queryFn: ({ pageParam }) => api.fetchUsers({ limit: PAGE_SIZE, cursor: pageParam, ...filters }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    // keep the previous page visible while filters change / next page loads
    placeholderData: keepPreviousData,
  })
}

export function useUpdateUserStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: UserStatus }) => api.updateUserStatus(id, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
  })
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) => api.updateUserRole(id, role),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
  })
}

export function useDeleteUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteUser(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
  })
}
