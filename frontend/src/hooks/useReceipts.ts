import { keepPreviousData, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteReceipt, fetchReceiptsPage } from '../api/receipts'
import { queryKeys } from '../lib/queryKeys'
import { invalidateDeletedReceipt } from '../lib/queryInvalidation'

/** Бесшовная cursor-подгрузка чеков; поиск входит в query key и серверный запрос. */
export function useReceipts(search = '') {
  return useInfiniteQuery({
    queryKey: queryKeys.receipts.list(search),
    queryFn: ({ pageParam }) => fetchReceiptsPage({ limit: 100, cursor: pageParam, search: search.trim() || undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}

/** Удаление чека каскадно удаляет его транзакции, поэтому обновляем все
 * представления, которые используют данные чеков и транзакций. */
export function useDeleteReceipt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteReceipt(id),
    onSuccess: (_, id) => invalidateDeletedReceipt(queryClient, id),
  })
}
