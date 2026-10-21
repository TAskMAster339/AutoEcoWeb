import type { components } from './generated'
type Schemas = components['schemas']
/** Decimal strings are decoded at the HTTP boundary. */
type NumericFields<T, K extends keyof T> = Omit<T, K> & { [P in K]: number | Extract<T[P], null | undefined> }

/**
 * Shared API types.
 * All shapes mirror backend OpenAPI (backend/src/schemas/*).
 * Summary/analytics are derived client-side from the production transaction API.
 */

/* ---------- Backend (real, mirrors OpenAPI) ---------- */

export type UserRole = Schemas['UserRole']
export type UserStatus = Schemas['UserStatus']

export type FeedbackStatus = 'open' | 'answered' | 'closed'
export type Feedback = Pick<Required<Schemas['FeedbackResponse']>, 'id' | 'user_id' | 'email' | 'subject' | 'message' | 'status' | 'admin_reply' | 'replied_at' | 'created_at' | 'updated_at'>
export type FeedbackCreate = Pick<Required<Schemas['FeedbackCreate']>, 'subject' | 'message'>
export type FeedbackAnswer = Pick<Required<Schemas['FeedbackAnswer']>, 'reply'>

export type User = Pick<Required<Schemas['UserResponse']>, 'id' | 'email' | 'role' | 'status'>

/** Admin view of a user (GET /api/v1/admin/users) — mirrors UserAdminResponse. */
export type AdminUser = Pick<Required<Schemas['UserAdminResponse']>, 'created_at' | 'updated_at' | 'limits' | 'id' | 'email' | 'role' | 'status'>

export type UserLimits = Pick<Required<Schemas['UserLimitsResponse']>, 'max_tags' | 'max_seller_aliases' | 'max_product_aliases' | 'max_receipts' | 'max_transactions' | 'max_receipt_items' | 'max_import_rows'>

export type UserUsage = Pick<Required<Schemas['UserUsageResponse']>, 'tags' | 'seller_aliases' | 'product_aliases' | 'receipts' | 'transactions'>

export type UserLimitsOverview = Pick<Required<Schemas['UserLimitsOverview']>, 'limits' | 'usage'>

export type AutoTaggingModelStatus =
  | 'disabled'
  | 'insufficient_data'
  | 'stale'
  | 'training'
  | 'ready'
  | 'degraded'
  | 'error'

export type AutoTaggingTagMetric = Pick<Required<Schemas['AutoTaggingTagMetric']>, 'tag_id' | 'tag_name' | 'tag_color' | 'tag_icon' | 'training_examples' | 'validation_examples' | 'precision' | 'recall' | 'supported'>

export type AutoTaggingStatus = Omit<Required<Schemas['AutoTaggingStatusResponse']>, 'per_tag_metrics'> & { per_tag_metrics: AutoTaggingTagMetric[] }

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
export type Transaction = NumericFields<Pick<Required<Schemas['TransactionOut']>, 'id' | 'receipt_id' | 'name' | 'normalized_name' | 'name_alias_id' | 'name_alias_name' | 'position' | 'quantity' | 'unit' | 'price' | 'amount' | 'operation_type' | 'datetime' | 'tag_id' | 'tag_source' | 'tag_confidence' | 'seller_id' | 'seller_name' | 'normalized_seller_name' | 'seller_name_alias_id' | 'seller_name_alias_name' | 'comment' | 'balance' | 'created_at'>, 'amount' | 'quantity' | 'price' | 'balance'>

/** POST /api/v1/transactions — ручная транзакция без чека (mirrors TransactionCreate). */
export type Store = Required<Schemas['StoreResponse']>

export type ManagedStore = Pick<Required<Schemas['SellerResponse']>, 'transaction_count' | 'receipt_count' | 'seller_id' | 'seller_name' | 'normalized_seller_name' | 'alias_id' | 'alias_name' | 'filter_value'>

export type TransactionDraft = Schemas["TransactionCreate"]

/** PATCH /api/v1/transactions/{id} — mirrors TransactionUpdate (receipt_id не редактируется). */
export type TransactionUpdatePatch = Schemas["TransactionUpdate"]

/* ---------- Receipts (real, mirrors backend src/schemas/receipt.py) ---------- */

/** Чек — «коробка» транзакций (mirrors ReceiptResponse, datetime = check_datetime). */
export type Receipt = Omit<NumericFields<Required<Schemas['ReceiptResponse']>, 'total_sum' | 'cashback' | 'balance_after'>, 'transactions'> & { transactions: Transaction[] }

/** POST /api/v1/receipts — создать чек по QR (mirrors ReceiptCreate). */
export type ReceiptQrDraft = Schemas["ReceiptCreate"]

/** PATCH /api/v1/receipts/{id} — mirrors ReceiptUpdate (qr/raw_json не редактируются). */
export type ReceiptUpdatePatch = Schemas["ReceiptUpdate"]

/** POST /api/v1/receipts/{receipt_id}/transactions — mirrors TransactionInReceipt. */
export type ReceiptTransactionDraft = Schemas["TransactionInReceipt"]

/* ---------- Tags (real, mirrors backend src/schemas/tag.py) ---------- */

export type Tag = Pick<Required<Schemas['TagResponse']>, 'id' | 'name' | 'color' | 'icon' | 'count'>

/* ---------- Aliases (real, mirrors backend src/schemas/alias.py) ---------- */

/** Область применения алиаса: магазины или товары. */
export type AliasScope = 'seller' | 'product'

export type Alias = Pick<Required<Schemas['AliasResponse']>, 'id' | 'scope' | 'original_name' | 'alias_name' | 'is_regex' | 'priority'>

export type AliasDraft = Pick<Schemas['AliasCreate'], 'original_name' | 'alias_name' | 'scope' | 'is_regex' | 'priority'>

export type AliasUpdatePatch = Pick<Schemas['AliasUpdate'], 'original_name' | 'alias_name' | 'scope' | 'is_regex' | 'priority'>

/** Ответ POST /api/v1/aliases/apply — сколько записей обновлено. */
export type AliasApplyResult = Pick<Required<Schemas['AliasApplyResult']>, 'seller_updated_receipts' | 'seller_updated_transactions' | 'product_updated'>

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
  tagSource: 'manual' | 'auto' | null
  tagConfidence: number | null
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
