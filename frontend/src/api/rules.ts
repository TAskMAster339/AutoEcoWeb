/**
 * Rules & aliases domain API (mock behind flag — see frontend/TODO.md).
 */
import { ApiError, delay } from './client'
import { USE_MOCK_API } from '../lib/config'
import { MOCK_RULES } from '../data/mock'
import type { Rule } from './types'

let store: Rule[] = [...MOCK_RULES]

export async function fetchRules(): Promise<Rule[]> {
  if (!USE_MOCK_API) throw new ApiError(501, 'Эндпоинт /api/v1/rules ещё не реализован')
  await delay(250)
  return [...store]
}

export interface RuleDraft {
  pattern: string
  alias: string
  tagId: string | null
  enabled: boolean
}

export async function createRule(draft: RuleDraft): Promise<Rule> {
  if (!USE_MOCK_API) throw new ApiError(501, 'Эндпоинт POST /api/v1/rules ещё не реализован')
  await delay(200)
  const rule: Rule = { id: `r-${Date.now()}`, ...draft }
  store = [...store, rule]
  return rule
}

export async function updateRule(id: string, patch: Partial<RuleDraft>): Promise<Rule> {
  if (!USE_MOCK_API) throw new ApiError(501, 'Эндпоинт PATCH /api/v1/rules/{id} ещё не реализован')
  await delay(200)
  store = store.map((r) => (r.id === id ? { ...r, ...patch } : r))
  const updated = store.find((r) => r.id === id)
  if (!updated) throw new ApiError(404, 'Правило не найдено')
  return updated
}

export async function deleteRule(id: string): Promise<void> {
  if (!USE_MOCK_API) throw new ApiError(501, 'Эндпоинт DELETE /api/v1/rules/{id} ещё не реализован')
  await delay(200)
  store = store.filter((r) => r.id !== id)
}
