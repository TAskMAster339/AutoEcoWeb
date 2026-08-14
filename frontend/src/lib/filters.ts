/**
 * Фильтры транзакций → параметры запроса к бэкенду.
 * Глобальный период и фильтры таблицы живут в uiStore; здесь они превращаются в
 * TransactionsPageParams, которые бэкенд применяет в SQL (WHERE + агрегаты).
 */
import { useMemo } from 'react'
import type { TransactionsPageParams } from '../api/transactions'
import { normalizeAmountFilter } from './numbers'
import { rangeFor } from './period'
import { useUiStore, type OperationFilter, type PeriodKey } from '../store/uiStore'

export function filterParams(
  periodKey: PeriodKey,
  customFrom: string | null,
  customTo: string | null,
  monthYear: string | null,
  dayDate: string | null,
  search: string,
  tagFilterIds: string[],
  storeFilters: string[],
  amountMin: string,
  amountMax: string,
  operationFilter: OperationFilter,
): TransactionsPageParams {
  const params: TransactionsPageParams = {}
  // «Всё время» — без дат: бэкенд считает по всем транзакциям
  // и не отдаёт дельты (prev-окна нет).
  if (periodKey !== 'all') {
    const { from, to } = rangeFor(periodKey, customFrom, customTo, monthYear, dayDate)
    params.date_from = from
    params.date_to = to
  }
  const q = search.trim()
  if (q) params.search = q
  if (tagFilterIds.length) params.tag_ids = tagFilterIds
  if (storeFilters.length) params.seller_names = storeFilters
  const normalizedMin = normalizeAmountFilter(amountMin)
  const normalizedMax = normalizeAmountFilter(amountMax)
  if (normalizedMin) params.amount_min = Number(normalizedMin)
  if (normalizedMax) params.amount_max = Number(normalizedMax)
  if (operationFilter !== 'all') params.operation_kind = operationFilter
  return params
}

/** Только глобальный период — для страниц, не связанных с фильтрами таблицы. */
export function usePeriodParams(): TransactionsPageParams {
  const periodKey = useUiStore((s) => s.periodKey)
  const customFrom = useUiStore((s) => s.customFrom)
  const customTo = useUiStore((s) => s.customTo)
  const monthYear = useUiStore((s) => s.monthYear)
  const dayDate = useUiStore((s) => s.dayDate)
  return useMemo(
    () => filterParams(periodKey, customFrom, customTo, monthYear, dayDate, '', [], [], '', '', 'all'),
    [periodKey, customFrom, customTo, monthYear, dayDate],
  )
}

/** Мемоизированные параметры фильтров таблицы — стабильный объект,
 *  чтобы query-ключи TanStack Query не менялись на каждом рендере. */
export function useFilterParams(): TransactionsPageParams {
  const periodKey = useUiStore((s) => s.periodKey)
  const customFrom = useUiStore((s) => s.customFrom)
  const customTo = useUiStore((s) => s.customTo)
  const monthYear = useUiStore((s) => s.monthYear)
  const dayDate = useUiStore((s) => s.dayDate)
  const search = useUiStore((s) => s.search)
  const tagFilterIds = useUiStore((s) => s.tagFilterIds)
  const storeFilters = useUiStore((s) => s.storeFilters)
  const amountMin = useUiStore((s) => s.amountMin)
  const amountMax = useUiStore((s) => s.amountMax)
  const operationFilter = useUiStore((s) => s.operationFilter)
  return useMemo(
    () => filterParams(periodKey, customFrom, customTo, monthYear, dayDate, search, tagFilterIds, storeFilters, amountMin, amountMax, operationFilter),
    [periodKey, customFrom, customTo, monthYear, dayDate, search, tagFilterIds, storeFilters, amountMin, amountMax, operationFilter],
  )
}
