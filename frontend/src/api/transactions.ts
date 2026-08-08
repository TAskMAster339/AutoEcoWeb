/**
 * Transactions domain API — real endpoints, mirrors backend OpenAPI
 * (backend/src/api/v1/transactions.py, schemas/transaction.py).
 *
 * Транзакция — минимальная единица учёта. Может быть внутри чека («коробки»,
 * receipt_id != null) или без чека (ручной ввод). Сводки/аналитика на фронте
 * строятся из транзакций (см. api/summary.ts).
 */
import { api } from './client'
import type {
  CursorPage,
  Transaction,
  TransactionDraft,
  TransactionUpdatePatch,
  TransactionView,
} from './types'

/** ФНС: 1=приход(покупка→расход), 2=расход(возврат→доход), 3=возврат прихода(доход), 4=возврат расхода(расход). */
export const isIncomeOperation = (operationType: number): boolean =>
  operationType === 2 || operationType === 3

export interface TransactionsPageParams {
  limit?: number
  cursor?: string
  date_from?: string
  date_to?: string
  tag_id?: string
  search?: string
}

/** GET /api/v1/transactions — cursor-пагинация, новые сверху. */
export function fetchTransactionsPage(
  params: TransactionsPageParams = {},
): Promise<CursorPage<Transaction>> {
  const search = new URLSearchParams()
  if (params.limit !== undefined) search.set('limit', String(params.limit))
  if (params.cursor) search.set('cursor', params.cursor)
  if (params.date_from) search.set('date_from', params.date_from)
  if (params.date_to) search.set('date_to', params.date_to)
  if (params.tag_id) search.set('tag_id', params.tag_id)
  if (params.search) search.set('search', params.search)
  const qs = search.toString()
  return api.get<CursorPage<Transaction>>(
    `/api/v1/transactions${qs ? `?${qs}` : ''}`,
  )
}

/**
 * Все транзакции (все страницы) — база для производных данных
 * (сводка, аналитика, счётчики тегов).
 */
export async function fetchAllTransactions(): Promise<Transaction[]> {
  const items: Transaction[] = []
  let cursor: string | undefined
  // защитный лимит: 200 страниц × 100 = 20 000 транзакций
  for (let i = 0; i < 200; i++) {
    const page = await fetchTransactionsPage({ limit: 100, cursor })
    items.push(...page.items)
    if (!page.next_cursor) break
    cursor = page.next_cursor
  }
  return items
}

/** POST /api/v1/transactions — ручная транзакция без чека. */
export function createTransaction(draft: TransactionDraft): Promise<Transaction> {
  return api.post<Transaction>('/api/v1/transactions', draft)
}

export function updateTransaction(
  id: string,
  patch: TransactionUpdatePatch,
): Promise<Transaction> {
  return api.patch<Transaction>(`/api/v1/transactions/${id}`, patch)
}

export function deleteTransaction(id: string): Promise<void> {
  return api.del(`/api/v1/transactions/${id}`)
}

/** Транзакция → строка таблицы/карточки (доход/расход + нарастающий баланс). */
export function toTransactionViews(txs: Transaction[]): TransactionView[] {
  const views = txs.map((tx) => {
    const income = isIncomeOperation(tx.operation_type)
    return {
      id: tx.id ?? '',
      date: tx.datetime.slice(0, 10),
      store: tx.seller_name,
      tagId: tx.tag_id,
      description: tx.name,
      quantity: tx.quantity !== null && tx.quantity !== undefined ? Number(tx.quantity) : null,
      price: tx.price !== null && tx.price !== undefined ? Number(tx.price) : null,
      income: income ? Number(tx.amount) : null,
      expense: income ? null : Number(tx.amount),
      balance: 0,
    }
  })
  // нарастающий итог по дате (старые сверху), отдаём новые сверху
  const byId = new Map(views.map((v) => [v.id, v]))
  let balance = 0
  for (const v of [...views].sort((a, b) => a.date.localeCompare(b.date))) {
    balance = Math.round((balance + (v.income ?? 0) - (v.expense ?? 0)) * 100) / 100
    byId.get(v.id)!.balance = balance
  }
  return views
}
