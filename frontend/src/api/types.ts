/**
 * Shared API types.
 * All shapes mirror backend OpenAPI (backend/src/schemas/*).
 * Summary/analytics are derived client-side from transactions (frontend/TODO.md).
 */

/* ---------- Backend (real, mirrors OpenAPI) ---------- */

export type UserRole = 'user' | 'admin'
export type UserStatus = 'pending' | 'active' | 'blocked'

export interface User {
  id: string
  email: string
  role: UserRole
  status: UserStatus
}

/** Admin view of a user (GET /api/v1/admin/users) — mirrors UserAdminResponse. */
export interface AdminUser extends User {
  created_at: string
  updated_at: string
}

/** Cursor-based page envelope — mirrors backend src/schemas/pagination.py. */
export interface CursorPage<T> {
  items: T[]
  next_cursor: string | null
}

export interface AdminUserFilters {
  role?: UserRole
  status?: UserStatus
  q?: string
}

/* ---------- Transactions (real, mirrors backend src/schemas/transaction.py) ---------- */

/** Транзакция — минимальная единица учёта. Может быть без чека (receipt_id = null). */
export interface Transaction {
  id: string | null
  receipt_id: string | null
  name: string
  normalized_name: string
  position: number | null
  quantity: number | null
  unit: string | null
  price: number | null
  /** Денежная сумма транзакции (бывш. total_price позиции) */
  amount: number
  /** ФНС: 1=приход(расход), 2=расход(доход), 3/4=возвраты */
  operation_type: number
  /** ISO datetime (UTC) */
  datetime: string
  tag_id: string | null
  /** Продавец из чека (left join); None для ручных транзакций */
  seller_name: string | null
  created_at: string | null
}

/** POST /api/v1/transactions — ручная транзакция без чека (mirrors TransactionCreate). */
export interface TransactionDraft {
  name: string
  /** Магазин ручной транзакции (у транзакций из чеков берётся из чека) */
  seller_name?: string | null
  amount: number
  quantity?: number | null
  unit?: string | null
  price?: number | null
  operation_type?: number
  datetime?: string
  tag_id?: string | null
}

/** PATCH /api/v1/transactions/{id} — mirrors TransactionUpdate (receipt_id не редактируется). */
export type TransactionUpdatePatch = Partial<{
  name: string
  /** явный null снимает магазин */
  seller_name: string | null
  quantity: number | null
  unit: string | null
  price: number | null
  amount: number
  operation_type: number
  datetime: string
  /** явный null снимает тег */
  tag_id: string | null
}>

/* ---------- Receipts (real, mirrors backend src/schemas/receipt.py) ---------- */

/** Чек — «коробка» транзакций (mirrors ReceiptResponse, datetime = check_datetime). */
export interface Receipt {
  id: string
  qr: string | null
  receipt_number: string | null
  /** ФНС: 1=приход, 2=расход, 3=возврат прихода, 4=возврат расхода */
  operation_type: number
  seller_name: string
  seller_inn: string | null
  /** ISO datetime (UTC) */
  datetime: string
  total_sum: number
  cashback: number | null
  balance_after: number | null
  created_at: string
  transactions: Transaction[]
}

/** POST /api/v1/receipts — создать чек по QR (mirrors ReceiptCreate). */
export interface ReceiptQrDraft {
  qr: string
  cashback?: number | null
  balance_after?: number | null
}

/** PATCH /api/v1/receipts/{id} — mirrors ReceiptUpdate (qr/raw_json не редактируются). */
export type ReceiptUpdatePatch = Partial<{
  receipt_number: string | null
  operation_type: number
  seller_name: string
  seller_inn: string | null
  check_datetime: string
  total_sum: number
  cashback: number | null
  balance_after: number | null
}>

/** POST /api/v1/receipts/{receipt_id}/transactions — mirrors TransactionInReceipt. */
export interface ReceiptTransactionDraft {
  name: string
  amount: number
  quantity?: number | null
  unit?: string | null
  price?: number | null
  tag_id?: string | null
}

/* ---------- Tags (real, mirrors backend src/schemas/tag.py) ---------- */

export interface Tag {
  id: string
  name: string
  /** hex color for the chip */
  color: string
  /** number of transactions with this tag — computed client-side from transactions */
  count: number
}

/* ---------- Aliases (real, mirrors backend src/schemas/alias.py) ---------- */

export interface Alias {
  id: string
  /** шаблон: подстрока или regex (при is_regex) */
  original_name: string
  /** нормализованное название продавца */
  alias_name: string
  is_regex: boolean
  priority: number
}

export interface AliasDraft {
  original_name: string
  alias_name: string
  is_regex?: boolean
  priority?: number
}

/* ---------- Domain (derived client-side from transactions) ---------- */

/** Строка для таблицы/карточек: транзакция + производные поля. */
export interface TransactionView {
  id: string
  /** ISO date (YYYY-MM-DD) */
  date: string
  /** Магазин (из чека) */
  store: string | null
  /** tag id */
  tagId: string | null
  /** Описание */
  description: string
  /** Кол-во */
  quantity: number | null
  /** Цена за единицу */
  price: number | null
  /** Доход (green), null when it's an expense row */
  income: number | null
  /** Расход (red), null when it's an income row */
  expense: number | null
  /** Баланс после операции */
  balance: number
}

export interface Summary {
  balance: number
  income: number
  expenses: number
  /** количество транзакций за период */
  transactions: number
  incomeDelta: number
  expensesDelta: number
  /** sparkline points for Баланс */
  balanceTrend: number[]
}

export interface AnalyticsDaily {
  day: string
  expenses: number
  income: number
}

export interface AnalyticsByStore {
  store: string
  value: number
}

export interface AnalyticsData {
  daily: AnalyticsDaily[]
  byStore: AnalyticsByStore[]
  byTag: { tag: Tag; value: number }[]
}
