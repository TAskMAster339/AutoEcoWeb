/**
 * Transactions domain API.
 * TODO(backend): GET/POST /api/v1/transactions, GET /api/v1/transactions/summary —
 * until then served from mock data behind VITE_USE_MOCK_API (see frontend/TODO.md).
 */
import { ApiError, delay } from './client'
import { USE_MOCK_API } from '../lib/config'
import { MOCK_TRANSACTIONS, STARTING_BALANCE } from '../data/mock'
import type { Transaction } from './types'

/** In-memory store so create/delete feel real during a session. */
let store: Transaction[] = [...MOCK_TRANSACTIONS]

export function getAllTransactions(): Transaction[] {
  return store
}

export interface TransactionDraft {
  date: string
  store: string
  description: string
  tagIds: string[]
  quantity: number | null
  price: number | null
  income: number | null
  expense: number | null
  comment: string | null
}

export async function fetchTransactions(): Promise<Transaction[]> {
  if (!USE_MOCK_API) throw new ApiError(501, 'Эндпоинт /api/v1/transactions ещё не реализован бэкендом')
  await delay(350)
  return [...store]
}

export async function createTransaction(draft: TransactionDraft): Promise<Transaction> {
  if (!USE_MOCK_API) throw new ApiError(501, 'Эндпоинт POST /api/v1/transactions ещё не реализован')
  await delay(300)
  const lastBalance = store[store.length - 1]?.balance ?? STARTING_BALANCE
  const tx: Transaction = {
    id: `tx-${Date.now()}`,
    date: draft.date,
    store: draft.store,
    tagIds: draft.tagIds,
    description: draft.description,
    quantity: draft.quantity,
    price: draft.price,
    income: draft.income,
    expense: draft.expense,
    balance: Math.round((lastBalance + (draft.income ?? 0) - (draft.expense ?? 0)) * 100) / 100,
    priceStatus: null,
    comment: draft.comment,
  }
  store = [...store, tx]
  return tx
}

export async function deleteTransaction(id: string): Promise<void> {
  if (!USE_MOCK_API) throw new ApiError(501, 'Эндпоинт DELETE /api/v1/transactions/{id} ещё не реализован')
  await delay(200)
  store = store.filter((t) => t.id !== id)
}
