/**
 * Shared API types.
 * All shapes mirror backend OpenAPI (backend/src/schemas/*).
 * Summary/analytics are derived client-side from transactions (frontend/TODO.md).
 */

/* ---------- Backend (real, mirrors OpenAPI) ---------- */

export type UserRole = 'user' | 'admin'
export type UserStatus = 'pending' | 'verified' | 'active' | 'blocked'

export type FeedbackStatus = 'open' | 'answered' | 'closed'
export interface Feedback {
  id: string
  user_id: string
  email: string
  subject: string
  message: string
  status: FeedbackStatus
  admin_reply: string | null
  replied_at: string | null
  created_at: string
  updated_at: string
}
export interface FeedbackCreate { subject: string; message: string }
export interface FeedbackAnswer { reply: string }

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
  limits: UserLimits
}

export interface UserLimits {
  max_tags: number
  max_seller_aliases: number
  max_product_aliases: number
  max_receipts: number
  max_transactions: number
  max_receipt_items: number
  max_import_rows: number
}

export interface UserUsage {
  tags: number
  seller_aliases: number
  product_aliases: number
  receipts: number
  transactions: number
}

export interface UserLimitsOverview {
  limits: UserLimits
  usage: UserUsage
}

/** Offset-based page envelope — mirrors backend src/schemas/pagination.py.
 *  total заполняет transactions (бесконечный скролл); receipts (keyset) — null. */
export interface CursorPage<T> {
  items: T[]
  next_cursor: string | null
  total: number | null
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
  name_alias_id: string | null
  name_alias_name: string | null
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
  seller_id: string | null
  /** Effective seller value; standalone uses its own seller, receipt rows inherit the receipt seller. */
  seller_name: string | null
  normalized_seller_name: string | null
  seller_name_alias_id: string | null
  seller_name_alias_name: string | null
  /** Необязательный комментарий пользователя; по умолчанию пустой */
  comment: string | null
  /** Нарастающий итог после операции (оконная функция по всем транзакциям
   *  пользователя на бэке); заполняется списком транзакций, в чеках — null */
  balance: number | null
  created_at: string | null
}

/** POST /api/v1/transactions — ручная транзакция без чека (mirrors TransactionCreate). */
export interface Store {
  seller_id: string
  seller_name: string
  normalized_seller_name: string | null
  alias_id: string | null
  alias_name: string | null
  filter_value: string
}

export interface ManagedStore extends Store {
  transaction_count: number
  receipt_count: number
}

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
  /** Необязательный комментарий; пустой = нет комментария */
  comment?: string | null
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
  /** явный null очищает комментарий */
  comment: string | null
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
  normalized_seller_name: string
  seller_name_alias_id: string | null
  seller_name_alias_name: string | null
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
  /** Optional user-selected icon stored by the backend. */
  icon: string | null
  /** Number of transactions with this tag, computed by the backend. */
  count: number
}

/* ---------- Aliases (real, mirrors backend src/schemas/alias.py) ---------- */

/** Область применения алиаса: магазины или товары. */
export type AliasScope = 'seller' | 'product'

export interface Alias {
  id: string
  scope: AliasScope
  /** шаблон: подстрока или regex (при is_regex) */
  original_name: string
  /** нормализованное название (магазина или товара) */
  alias_name: string
  is_regex: boolean
  priority: number
}

export interface AliasDraft {
  original_name: string
  alias_name: string
  scope?: AliasScope
  is_regex?: boolean
  priority?: number
}

export interface AliasUpdatePatch {
  original_name?: string
  alias_name?: string
  scope?: AliasScope
  is_regex?: boolean
  priority?: number
}

/** Ответ POST /api/v1/aliases/apply — сколько записей обновлено. */
export interface AliasApplyResult {
  seller_updated_receipts: number
  seller_updated_transactions: number
  product_updated: number
}

/* ---------- Domain (derived client-side from transactions) ---------- */

/** Строка для таблицы/карточек: транзакция + производные поля. */
export interface TransactionView {
  id: string
  /** ISO date (YYYY-MM-DD) */
  date: string
  /** Effective display name of the seller. */
  store: string | null
  sellerId: string | null
  sellerNameSource: string | null
  sellerAliasName: string | null
  /** tag id */
  tagId: string | null
  /** Название */
  name: string
  nameSource: string
  nameAliasName: string | null
  /** Необязательный комментарий пользователя */
  comment: string | null
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

/** Сводка за период (GET /api/v1/transactions/summary, считает бэкенд).
 *  balance — сальдо на КОНЕЦ периода (с учётом openingBalance);
 *  incomeDelta/expensesDelta — разница с предыдущим окном той же длины,
 *  null когда периода нет («Всё время»). */
export interface Summary {
  balance: number
  /** нетто до начала периода (для колонки «Баланс» в таблице) */
  openingBalance: number
  income: number
  expenses: number
  /** количество транзакций за период */
  transactions: number
  incomeDelta: number | null
  expensesDelta: number | null
  /** sparkline points for Баланс */
  balanceTrend: number[]
}

export interface AnalyticsDaily {
  day: string
  expenses: number
  income: number
  count: number
  /** значение линейного тренда для дня; null, когда точек < 2 */
  trend: number | null
}

export interface AnalyticsByStore {
  store: string
  value: number
}

export interface AnalyticsByCategory {
  tag: Tag
  value: number
  count: number
}

export interface AnalyticsWeekday {
  /** 1..7, ISO (1 = Пн) */
  weekday: number
  value: number
  count: number
}

export interface AnalyticsIndicators {
  topStore: AnalyticsByStore | null
  topCategory: AnalyticsByCategory | null
  topWeekday: AnalyticsWeekday | null
  topIncomeSource: AnalyticsByStore | null
}

export interface AnalyticsData {
  daily: AnalyticsDaily[]
  byStore: AnalyticsByStore[]
  byStoreIncome: AnalyticsByStore[]
  byCategory: AnalyticsByCategory[]
  byWeekday: AnalyticsWeekday[]
  indicators: AnalyticsIndicators
}

/** GET /api/v1/analytics/price-chart — график цен товара (считает бэкенд). */
export interface PricePoint {
  day: string
  price: number
  count: number
  store: string | null
  names: string[]
}

export interface PriceChartData {
  points: PricePoint[]
  stores: Array<string | null>
  avgPrice: number
  medianPrice: number
  stddev: number
  count: number
}
