/**
 * Admin users API — real endpoints, mirrors backend OpenAPI (backend/src/api/v1/admin.py).
 */
import { api } from './client'
import type { AdminUser, CursorPage, UserRole, UserStatus } from './types'

export interface FetchUsersParams {
  limit?: number
  cursor?: string
  role?: UserRole
  status?: UserStatus
  q?: string
}

export function fetchUsers(params: FetchUsersParams = {}): Promise<CursorPage<AdminUser>> {
  const search = new URLSearchParams()
  if (params.limit !== undefined) search.set('limit', String(params.limit))
  if (params.cursor) search.set('cursor', params.cursor)
  if (params.role) search.set('role', params.role)
  if (params.status) search.set('status', params.status)
  if (params.q) search.set('q', params.q)
  const qs = search.toString()
  return api.get<CursorPage<AdminUser>>(`/api/v1/admin/users${qs ? `?${qs}` : ''}`)
}

export function updateUserRole(id: string, role: UserRole): Promise<AdminUser> {
  return api.patch<AdminUser>(`/api/v1/admin/users/${id}`, { role })
}

export function updateUserStatus(id: string, status: UserStatus): Promise<AdminUser> {
  return api.patch<AdminUser>(`/api/v1/admin/users/${id}`, { status })
}

export function deleteUser(id: string): Promise<void> {
  return api.del(`/api/v1/admin/users/${id}`)
}
