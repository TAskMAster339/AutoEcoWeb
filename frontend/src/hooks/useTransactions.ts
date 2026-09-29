import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/transactions'
import type { TransactionDraft, TransactionUpdatePatch, Store } from '../api/types'
import { queryKeys } from '../lib/queryKeys'
import { invalidateTransactionDomain } from '../lib/queryInvalidation'

export function useStores() {
  return useQuery<Store[]>({
    queryKey: queryKeys.stores.all(),
    queryFn: ({ signal }) => api.fetchTransactionStores(signal),
    staleTime: 60_000,
  })
}

/** После мутации обновляются зависимые агрегаты. Страницы списка можно не
 *  сбрасывать, когда мобильный интерфейс подменяет изменённую строку локально. */
export function useCreateTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (draft: TransactionDraft) => api.createTransaction(draft),
    onSuccess: () => invalidateTransactionDomain(queryClient),
  })
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteTransaction(id),
    onSuccess: () => invalidateTransactionDomain(queryClient),
  })
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: TransactionUpdatePatch; refreshRows?: boolean }) =>
      api.updateTransaction(id, patch),
    onSuccess: (_, variables) => invalidateTransactionDomain(queryClient, {
      refreshRows: variables.refreshRows ?? true,
    }),
  })
}

export interface BulkTransactionUpdate {
  ids: string[]
  patch: TransactionUpdatePatch
}

/** Обновляет выбранные строки одной атомарной backend-операцией. */
export function useBulkUpdateTransactions() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ ids, patch }: BulkTransactionUpdate) =>
      api.bulkUpdateTransactions(ids, patch),
    onSuccess: () => invalidateTransactionDomain(queryClient),
  })
}
