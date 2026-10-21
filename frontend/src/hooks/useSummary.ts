import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchAnalytics, fetchPriceChart, fetchSummary } from '../api/summary'
import { useFilterParams, usePeriodParams } from '../lib/filters'
import type { TransactionsPageParams } from '../api/transactions'
import { queryKeys } from '../lib/queryKeys'

/** Сводка: по умолчанию учитывает фильтры таблицы; другая страница передаёт свои. */
export function useSummary(params?: TransactionsPageParams) {
  const tableParams = useFilterParams()
  const queryParams = params ?? tableParams
  return useQuery({
    queryKey: queryKeys.summary.filtered(queryParams),
    queryFn: ({ signal }) => fetchSummary(queryParams, signal),
    staleTime: 30_000,
  })
}

/** Сводка только по глобальному периоду, без подписки на фильтры таблицы. */
export function usePeriodSummary() {
  const params = usePeriodParams()
  return useQuery({
    queryKey: queryKeys.summary.filtered(params),
    queryFn: ({ signal }) => fetchSummary(params, signal),
    staleTime: 30_000,
  })
}

/** Аналитика использует только глобальный период, без фильтров таблицы. */
export function useAnalytics() {
  const params = usePeriodParams()
  return useQuery({
    queryKey: queryKeys.analytics.filtered(params),
    queryFn: ({ signal }) => fetchAnalytics(params, signal),
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
    queryKey: queryKeys.priceChart.filtered(query, isRegex, period),
    queryFn: ({ signal }) => fetchPriceChart(query, isRegex, period, signal),
    enabled,
    staleTime: 60_000,
    retry: 1,
  })
}
