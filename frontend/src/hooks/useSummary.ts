import { useQuery } from '@tanstack/react-query'
import { fetchAnalytics, fetchSummary } from '../api/summary'
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
