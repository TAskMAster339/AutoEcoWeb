import { keepPreviousData, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteReceipt, fetchReceiptsPage } from '../api/receipts'

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

/** Удаление чека каскадно удаляет его транзакции, поэтому обновляем все
 * представления, которые используют данные чеков и транзакций. */
export function useDeleteReceipt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteReceipt(id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: ['receipt', id] })
      queryClient.removeQueries({ queryKey: ['receipt-raw', id] })
      queryClient.removeQueries({ queryKey: ['txPage'] })
      queryClient.removeQueries({ queryKey: ['txTotal'] })
      queryClient.setQueryData<number>(['txRevision'], (revision = 0) => revision + 1)
      void queryClient.invalidateQueries({ queryKey: ['receipts'] })
      void queryClient.invalidateQueries({ queryKey: ['transactions'] })
      void queryClient.invalidateQueries({ queryKey: ['summary'] })
      void queryClient.invalidateQueries({ queryKey: ['analytics'] })
      void queryClient.invalidateQueries({ queryKey: ['stores'] })
      void queryClient.invalidateQueries({ queryKey: ['tags'] })
    },
  })
}
