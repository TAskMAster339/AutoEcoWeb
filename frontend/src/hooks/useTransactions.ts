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

/** После мутации обновляются зависимые агрегаты. Страницы списка можно не
 *  сбрасывать, когда мобильный интерфейс подменяет изменённую строку локально. */
function invalidateAfterMutation(
  queryClient: ReturnType<typeof useQueryClient>,
  refreshTransactionRows = true,
) {
  // Сначала удаляем block-кэш. Если сперва увеличить revision, компонент грида
  // может успеть запросить ещё свежий (staleTime 30 s) txPage до асинхронной
  // invalidation — тогда новая транзакция появится только позднее. Удаление
  // гарантирует, что purgeInfiniteCache / мобильная первая страница получат
  // актуальные строки после мутаций, которые меняют состав или порядок списка.
  if (refreshTransactionRows) queryClient.removeQueries({ queryKey: ['txPage'] })
  // Не удаляем txTotal: TransactionsPage использует его как гейт первого
  // экрана. removeQueries переводит запрос в pending, из-за чего весь экран
  // временно заменяется LoadingState и сбрасывает прокрутку <main> в начало.
  // Инвалидация сохраняет уже смонтированную страницу и обновляет число тихо.
  if (refreshTransactionRows) {
    queryClient.setQueryData<number>(['txRevision'], (revision = 0) => revision + 1)
  }
  void queryClient.invalidateQueries({ queryKey: ['txTotal'] })
  // AG Grid keeps already-loaded rows in its own Infinite Row Model cache.
  // A TanStack invalidation alone marks the HTTP query stale, but does not
  // make AG Grid ask for the visible block again. The revision is observed by
  // both desktop and mobile transaction views and forces that reload.
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
    mutationFn: ({ id, patch }: { id: string; patch: TransactionUpdatePatch; refreshRows?: boolean }) =>
      api.updateTransaction(id, patch),
    onSuccess: (_, variables) => invalidateAfterMutation(queryClient, variables.refreshRows ?? true),
  })
}

export interface BulkTransactionUpdate {
  ids: string[]
  patch: TransactionUpdatePatch
}

/** Обновляет выбранные строки через существующий PATCH с ограниченной
 * конкуренцией и обновляет клиентские кэши один раз после всей пачки. */
export function useBulkUpdateTransactions() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ ids, patch }: BulkTransactionUpdate) => {
      let cursor = 0
      const failures: unknown[] = []
      const workers = Array.from({ length: Math.min(4, ids.length) }, async () => {
        while (cursor < ids.length) {
          const id = ids[cursor]
          cursor += 1
          if (!id) continue
          try {
            await api.updateTransaction(id, patch)
          } catch (error) {
            failures.push(error)
          }
        }
      })
      await Promise.all(workers)
      if (failures.length > 0) {
        throw failures[0] instanceof Error
          ? failures[0]
          : new Error(`Не удалось обновить ${failures.length} транзакций`)
      }
      return ids.length
    },
    onSettled: () => invalidateAfterMutation(queryClient),
  })
}
