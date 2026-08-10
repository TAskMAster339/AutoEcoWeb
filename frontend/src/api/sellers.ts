import { api } from './client'
import type { ManagedStore } from './types'

export function fetchSellers(): Promise<ManagedStore[]> {
  return api.get<ManagedStore[]>('/api/v1/sellers')
}

export function updateSeller(id: string, seller_name: string): Promise<ManagedStore> {
  return api.patch<ManagedStore>(`/api/v1/sellers/${id}`, { seller_name })
}

export function deleteSeller(id: string): Promise<void> {
  return api.del(`/api/v1/sellers/${id}`)
}