import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'
import { fetchReceiptsPage } from '../api/receipts'

/** Бесшовная cursor-подгрузка чеков; поиск входит в query key и серверный запрос. */
export function useReceipts(search = '') {
  return useInfiniteQuery({
    queryKey: ['receipts', search],
    queryFn: ({ pageParam }) => fetchReceiptsPage({ limit: 100, cursor: pageParam, search: search.trim() || undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}
