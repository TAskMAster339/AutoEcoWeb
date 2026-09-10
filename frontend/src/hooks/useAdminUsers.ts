import { keepPreviousData, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/admin'
import type { AdminUser, AdminUserFilters, UserLimits } from '../api/types'

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

export function useUpdateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      ...patch
    }: { id: string } & Partial<Pick<AdminUser, 'role' | 'status'>>) => api.updateUser(id, patch),
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

export function useUpdateUserLimits() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<UserLimits> }) => api.updateUserLimits(id, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      void queryClient.invalidateQueries({ queryKey: ['user-limits'] })
    },
  })
}
