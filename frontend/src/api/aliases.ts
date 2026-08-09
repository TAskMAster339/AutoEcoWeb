/**
 * Aliases domain API — real endpoints, mirrors backend OpenAPI
 * (backend/src/api/v1/aliases.py). Алиасы нормализуют названия магазинов
 * (scope=seller) и товаров (scope=product): подстрока, либо regex при
 * is_regex; приоритет решает порядок применения. Создание/изменение алиаса
 * автоматически применяет его к существующим записям; POST /aliases/apply
 * переприменяет всё разом.
 */
import { api } from './client'
import type { Alias, AliasApplyResult, AliasDraft, AliasScope, AliasUpdatePatch, CursorPage } from './types'

export function fetchAliasesPage(params: {
  scope?: AliasScope
  limit?: number
  offset?: number
} = {}): Promise<CursorPage<Alias>> {
  const qs = new URLSearchParams()
  if (params.scope) qs.set('scope', params.scope)
  if (params.limit != null) qs.set('limit', String(params.limit))
  if (params.offset != null) qs.set('offset', String(params.offset))
  const query = qs.toString()
  return api.get<CursorPage<Alias>>(`/api/v1/aliases${query ? `?${query}` : ''}`)
}

export function createAlias(draft: AliasDraft): Promise<Alias> {
  return api.post<Alias>('/api/v1/aliases', draft)
}

export function updateAlias(id: string, patch: AliasUpdatePatch): Promise<Alias> {
  return api.patch<Alias>(`/api/v1/aliases/${id}`, patch)
}

export function deleteAlias(id: string): Promise<void> {
  return api.del(`/api/v1/aliases/${id}`)
}

/** Применить все алиасы (скоуп опционален; без него — оба). */
export function applyAliases(scope?: AliasScope): Promise<AliasApplyResult> {
  return api.post<AliasApplyResult>(
    '/api/v1/aliases/apply',
    scope ? { scope } : undefined,
  )
}
