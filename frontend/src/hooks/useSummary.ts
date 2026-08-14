import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchAnalytics, fetchPriceChart, fetchSummary } from '../api/summary'
import { useFilterParams, usePeriodParams } from '../lib/filters'
import type { TransactionsPageParams } from '../api/transactions'

/** Сводка: по умолчанию учитывает фильтры таблицы; другая страница передаёт свои. */
export function useSummary(params?: TransactionsPageParams) {
  const tableParams = useFilterParams()
  const queryParams = params ?? tableParams
  return useQuery({
    queryKey: ['summary', queryParams],
    queryFn: () => fetchSummary(queryParams),
    staleTime: 30_000,
  })
}

/** Сводка только по глобальному периоду, без подписки на фильтры таблицы. */
export function usePeriodSummary() {
  const params = usePeriodParams()
  return useQuery({
    queryKey: ['summary', params],
    queryFn: () => fetchSummary(params),
    staleTime: 30_000,
  })
}

/** Аналитика использует только глобальный период, без фильтров таблицы. */
export function useAnalytics() {
  const params = usePeriodParams()
  return useQuery({
    queryKey: ['analytics', params],
    queryFn: () => fetchAnalytics(params),
    staleTime: 60_000,
  })
}

/** Ценовой график товара — только глобальный период. */
export function usePriceChart(name: string, isRegex: boolean) {
  const { date_from, date_to } = usePeriodParams()
  const period = useMemo(() => ({ date_from, date_to }), [date_from, date_to])
  const query = name.trim()
  const enabled = query.length > 0
  return useQuery({
    queryKey: ['price-chart', query, isRegex, period],
    queryFn: () => fetchPriceChart(query, isRegex, period),
    enabled,
    staleTime: 60_000,
    retry: 1,
  })
}
