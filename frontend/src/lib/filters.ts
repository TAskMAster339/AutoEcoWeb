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
  tagFilterId: string | null,
  storeFilter: string | null,
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
  if (tagFilterId) params.tag_id = tagFilterId
  if (storeFilter) params.seller_name = storeFilter
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
  const tagFilterId = useUiStore((s) => s.tagFilterId)
  const storeFilter = useUiStore((s) => s.storeFilter)
  return useMemo(
    () => filterParams(periodKey, customFrom, customTo, monthYear, search, tagFilterId, storeFilter),
    [periodKey, customFrom, customTo, monthYear, search, tagFilterId, storeFilter],
  )
}
