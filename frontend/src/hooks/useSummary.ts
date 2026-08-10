import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchAnalytics, fetchPriceChart, fetchSummary } from '../api/summary'
import { useFilterParams } from '../lib/filters'

/** Сводка за выбранный период — параметры из стора, считает бэкенд. */
export function useSummary() {
  const params = useFilterParams()
  return useQuery({
    queryKey: ['summary', params],
    queryFn: () => fetchSummary(params),
    staleTime: 30_000,
  })
}

/** Аналитика за выбранный период — параметры из стора, считает бэкенд. */
export function useAnalytics() {
  const params = useFilterParams()
  return useQuery({
    queryKey: ['analytics', params],
    queryFn: () => fetchAnalytics(params),
    staleTime: 60_000,
  })
}

/** Ценовой график товара — только период из стора (поиск/тег/магазин не применяются). */
export function usePriceChart(name: string, isRegex: boolean) {
  const { date_from, date_to } = useFilterParams()
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
