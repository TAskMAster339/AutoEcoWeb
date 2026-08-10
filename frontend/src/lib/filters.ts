/**
 * Фильтры транзакций → параметры запроса к бэкенду.
 * Период/тег/поиск/магазин живут в uiStore; здесь они превращаются в
 * TransactionsPageParams, которые бэкенд применяет в SQL (WHERE + агрегаты).
 */
import { useMemo } from 'react'
import type { TransactionsPageParams } from '../api/transactions'
import { rangeFor } from './period'
import { useUiStore, type PeriodKey } from '../store/uiStore'

export function filterParams(
  periodKey: PeriodKey,
  customFrom: string | null,
  customTo: string | null,
  monthYear: string | null,
  search: string,
  tagFilterIds: string[],
  storeFilters: string[],
): TransactionsPageParams {
  const params: TransactionsPageParams = {}
  // «Всё время» — без дат: бэкенд считает по всем транзакциям
  // и не отдаёт дельты (prev-окна нет).
  if (periodKey !== 'all') {
    const { from, to } = rangeFor(periodKey, customFrom, customTo, monthYear)
    params.date_from = from
    params.date_to = to
  }
  const q = search.trim()
  if (q) params.search = q
  if (tagFilterIds.length) params.tag_ids = tagFilterIds
  if (storeFilters.length) params.seller_names = storeFilters
  return params
}

/** Мемоизированные параметры фильтров из стора — стабильный объект,
 *  чтобы query-ключи TanStack Query не менялись на каждом рендере. */
export function useFilterParams(): TransactionsPageParams {
  const periodKey = useUiStore((s) => s.periodKey)
  const customFrom = useUiStore((s) => s.customFrom)
  const customTo = useUiStore((s) => s.customTo)
  const monthYear = useUiStore((s) => s.monthYear)
  const search = useUiStore((s) => s.search)
  const tagFilterIds = useUiStore((s) => s.tagFilterIds)
  const storeFilters = useUiStore((s) => s.storeFilters)
  return useMemo(
    () => filterParams(periodKey, customFrom, customTo, monthYear, search, tagFilterIds, storeFilters),
    [periodKey, customFrom, customTo, monthYear, search, tagFilterIds, storeFilters],
  )
}
