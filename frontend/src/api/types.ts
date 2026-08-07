/**
 * Shared API types.
 * User-related shapes mirror backend OpenAPI (backend/src/schemas/*).
 * Domain shapes (Transaction, Summary, Tag, Rule) are frontend contracts —
 * see frontend/TODO.md for the backend endpoints that must produce them.
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

export interface TokenPair {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface LoginResponse extends TokenPair {
  user: User
}

/* ---------- Domain (mock until backend provides endpoints) ---------- */

export interface Tag {
  id: string
  name: string
  /** hex color for the chip */
  color: string
  /** number of transactions with this tag */
  count: number
}

export interface PriceStatus {
  direction: 'up' | 'down' | 'flat'
  percent: number
}

export interface Transaction {
  id: string
  /** ISO date */
  date: string
  /** Магазин */
  store: string
  /** tag ids */
  tagIds: string[]
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
  /** Статус цены */
  priceStatus: PriceStatus | null
  /** Комментарий */
  comment: string | null
}

export interface Summary {
  balance: number
  income: number
  expenses: number
  checks: number
  incomeDelta: number
  expensesDelta: number
  /** sparkline points for Баланс */
  balanceTrend: number[]
}

export interface Rule {
  id: string
  /** e.g. «дикси» */
  pattern: string
  /** normalized merchant alias, e.g. «Дикси» */
  alias: string
  /** tag auto-applied on match */
  tagId: string | null
  enabled: boolean
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
