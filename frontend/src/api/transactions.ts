/**
 * Transactions domain API — real endpoints, mirrors backend OpenAPI
 * (backend/src/api/v1/transactions.py, schemas/transaction.py).
 *
 * Транзакция — минимальная единица учёта. Может быть внутри чека («коробки»,
 * receipt_id != null) или без чека (ручной ввод). Список — offset-пагинация
 * с total (бесконечный скролл AG Grid), фильтры и баланс строки считает бэкенд.
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

/** sort_by (colId из AG Grid) → whitelist бэкенда (backend/src/repositories/transaction.py). */
export type TransactionSortBy =
  | 'date'
  | 'name'
  | 'store'
  | 'quantity'
  | 'price'
  | 'income'
  | 'expense'
  | 'balance'
  | 'comment'

export interface TransactionsPageParams {
  limit?: number
  offset?: number
  date_from?: string
  date_to?: string
  tag_id?: string
  search?: string
  seller_name?: string
  sort_by?: TransactionSortBy
  sort_dir?: 'asc' | 'desc'
}

/** GET /api/v1/transactions — offset-пагинация, фильтры считает бэкенд. */
export function fetchTransactionsPage(
  params: TransactionsPageParams = {},
): Promise<CursorPage<Transaction>> {
  const search = new URLSearchParams()
  if (params.limit !== undefined) search.set('limit', String(params.limit))
  if (params.offset !== undefined) search.set('offset', String(params.offset))
  if (params.date_from) search.set('date_from', params.date_from)
  if (params.date_to) search.set('date_to', params.date_to)
  if (params.tag_id) search.set('tag_id', params.tag_id)
  if (params.search) search.set('search', params.search)
  if (params.seller_name) search.set('seller_name', params.seller_name)
  if (params.sort_by) search.set('sort_by', params.sort_by)
  if (params.sort_dir) search.set('sort_dir', params.sort_dir)
  const qs = search.toString()
  return api.get<CursorPage<Transaction>>(
    `/api/v1/transactions${qs ? `?${qs}` : ''}`,
  )
}

/**
 * Все транзакции (все страницы) — для счётчиков тегов и экспорта.
 * Цикл по total: offset-пагинация вместо keyset-курсора.
 */
export async function fetchAllTransactions(): Promise<Transaction[]> {
  const items: Transaction[] = []
  let offset = 0
  // защитный лимит: 500 страниц × 100 = 50 000 транзакций
  for (let i = 0; i < 500; i++) {
    const page = await fetchTransactionsPage({ limit: 100, offset })
    items.push(...page.items)
    if (page.total === null || page.total === undefined || items.length >= page.total) break
    offset += page.items.length
  }
  return items
}

/** GET /api/v1/transactions/stores — все магазины пользователя (свои + из чеков). */
export function fetchTransactionStores(): Promise<string[]> {
  return api.get<string[]>('/api/v1/transactions/stores')
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

/** Транзакция → строка таблицы/карточки. Баланс приходит с бэка (оконная
 *  функция по ВСЕМ транзакциям пользователя) — клиент его не накапливает. */
export function toTransactionView(tx: Transaction): TransactionView {
  const income = isIncomeOperation(tx.operation_type)
  return {
    id: tx.id ?? '',
    date: tx.datetime.slice(0, 10),
    store: tx.seller_name,
    tagId: tx.tag_id,
    name: tx.name,
    comment: tx.comment,
    quantity: tx.quantity !== null && tx.quantity !== undefined ? Number(tx.quantity) : null,
    price: tx.price !== null && tx.price !== undefined ? Number(tx.price) : null,
    income: income ? Number(tx.amount) : null,
    expense: income ? null : Number(tx.amount),
    balance: tx.balance !== null && tx.balance !== undefined ? Number(tx.balance) : 0,
  }
}

export function toTransactionViews(txs: Transaction[]): TransactionView[] {
  return txs.map(toTransactionView)
}
