import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/transactions'
import type { Transaction, TransactionDraft, TransactionUpdatePatch, Store } from '../api/types'

export function useTransactions() {
  return useQuery<Transaction[]>({
    queryKey: ['transactions'],
    queryFn: api.fetchAllTransactions,
    staleTime: 30_000,
  })
}

export function useStores() {
  return useQuery<Store[]>({
    queryKey: ['stores'],
    queryFn: api.fetchTransactionStores,
    staleTime: 60_000,
  })
}

/** После любой мутации обновляются все зависимые данные. 'txPage' — страницы
 *  таблицы (datasource AG Grid и мобильный список ходят через fetchQuery). */
function invalidateAfterMutation(queryClient: ReturnType<typeof useQueryClient>) {
  // Сначала удаляем block-кэш. Если сперва увеличить revision, компонент грида
  // может успеть запросить ещё свежий (staleTime 30 s) txPage до асинхронной
  // invalidation — тогда новая транзакция появится только позднее. Удаление
  // гарантирует, что purgeInfiniteCache / мобильная первая страница получат
  // актуальные строки непосредственно после успешного POST/PATCH/DELETE.
  queryClient.removeQueries({ queryKey: ['txPage'] })
  queryClient.removeQueries({ queryKey: ['txTotal'] })
  // AG Grid keeps already-loaded rows in its own Infinite Row Model cache.
  // A TanStack invalidation alone marks the HTTP query stale, but does not
  // make AG Grid ask for the visible block again. The revision is observed by
  // both desktop and mobile transaction views and forces that reload.
  queryClient.setQueryData<number>(['txRevision'], (revision = 0) => revision + 1)
  void queryClient.invalidateQueries({ queryKey: ['transactions'] })
  void queryClient.invalidateQueries({ queryKey: ['summary'] })
  void queryClient.invalidateQueries({ queryKey: ['analytics'] })
  void queryClient.invalidateQueries({ queryKey: ['stores'] })
  void queryClient.invalidateQueries({ queryKey: ['tags'] })
  void queryClient.invalidateQueries({ queryKey: ['tags-page'] })
  void queryClient.invalidateQueries({ queryKey: ['receipts'] })
}

export function useCreateTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (draft: TransactionDraft) => api.createTransaction(draft),
    onSuccess: () => invalidateAfterMutation(queryClient),
  })
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteTransaction(id),
    onSuccess: () => invalidateAfterMutation(queryClient),
  })
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: TransactionUpdatePatch }) =>
      api.updateTransaction(id, patch),
    onSuccess: () => invalidateAfterMutation(queryClient),
  })
}
