/**
 * Aliases domain API — real endpoints, mirrors backend OpenAPI
 * (backend/src/api/v1/aliases.py). Алиасы нормализуют названия продавцов
 * при импорте чеков: подстрока, либо regex при is_regex; приоритет решает
 * порядок применения (см. backend/src/services/aliases.py).
 */
import { api } from './client'
import type { Alias, AliasDraft } from './types'

export function fetchAliases(): Promise<Alias[]> {
  return api.get<Alias[]>('/api/v1/aliases')
}

export function createAlias(draft: AliasDraft): Promise<Alias> {
  return api.post<Alias>('/api/v1/aliases', draft)
}

export function deleteAlias(id: string): Promise<void> {
  return api.del(`/api/v1/aliases/${id}`)
}
