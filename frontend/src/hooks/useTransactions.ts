import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/transactions'
import { toTransactionViews } from '../api/transactions'
import type { Transaction, TransactionDraft, TransactionView } from '../api/types'

export function useTransactions() {
  return useQuery<Transaction[]>({
    queryKey: ['transactions'],
    queryFn: api.fetchAllTransactions,
    staleTime: 30_000,
  })
}

/** Транзакции как строки таблицы (доход/расход + нарастающий баланс). */
export function useTransactionViews() {
  const { data: txs, ...rest } = useTransactions()
  return { data: txs ? toTransactionViews(txs) : undefined, ...rest }
}

export function useCreateTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (draft: TransactionDraft) => api.createTransaction(draft),
    onSuccess: () => {
      // транзакция меняет и сводку, и аналитику, и счётчики тегов
      void queryClient.invalidateQueries({ queryKey: ['transactions'] })
      void queryClient.invalidateQueries({ queryKey: ['summary'] })
      void queryClient.invalidateQueries({ queryKey: ['analytics'] })
      void queryClient.invalidateQueries({ queryKey: ['tags'] })
    },
  })
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteTransaction(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['transactions'] })
      void queryClient.invalidateQueries({ queryKey: ['summary'] })
      void queryClient.invalidateQueries({ queryKey: ['analytics'] })
      void queryClient.invalidateQueries({ queryKey: ['tags'] })
      void queryClient.invalidateQueries({ queryKey: ['receipts'] })
    },
  })
}

export type { TransactionView }

