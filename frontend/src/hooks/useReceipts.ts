import { keepPreviousData, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteReceipt, fetchReceiptsPage } from '../api/receipts'
import { userQueryKey } from '../lib/querySession'

/** Бесшовная cursor-подгрузка чеков; поиск входит в query key и серверный запрос. */
export function useReceipts(search = '') {
  return useInfiniteQuery({
    queryKey: userQueryKey('receipts', search),
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
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: userQueryKey('receipt', id) })
      queryClient.removeQueries({ queryKey: userQueryKey('receipt-raw', id) })
      queryClient.removeQueries({ queryKey: userQueryKey('txPage') })
      queryClient.removeQueries({ queryKey: userQueryKey('txTotal') })
      queryClient.setQueryData<number>(userQueryKey('txRevision'), (revision = 0) => revision + 1)
      void queryClient.invalidateQueries({ queryKey: userQueryKey('receipts') })
      void queryClient.invalidateQueries({ queryKey: userQueryKey('transactions') })
      void queryClient.invalidateQueries({ queryKey: userQueryKey('summary') })
      void queryClient.invalidateQueries({ queryKey: userQueryKey('analytics') })
      void queryClient.invalidateQueries({ queryKey: userQueryKey('stores') })
      void queryClient.invalidateQueries({ queryKey: userQueryKey('tags') })
      void queryClient.invalidateQueries({ queryKey: userQueryKey('user-limits') })
    },
  })
}
