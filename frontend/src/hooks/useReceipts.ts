import { useInfiniteQuery } from '@tanstack/react-query'
import { fetchReceiptsPage } from '../api/receipts'

/** Бесконечная подгрузка чеков (страницы по 100) — дашборд, «Загрузить ещё». */
export function useReceipts() {
  return useInfiniteQuery({
    queryKey: ['receipts'],
    queryFn: ({ pageParam }) => fetchReceiptsPage({ limit: 100, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    staleTime: 30_000,
  })
}
