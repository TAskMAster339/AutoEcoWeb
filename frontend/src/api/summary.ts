/**
 * Summary + analytics — реальные эндпоинты бэкенда, считают SQL:
 *   GET /api/v1/transactions/summary — показатели за период (с дельтами
 *     к предыдущему окну и нарастающим балансом с учётом opening);
 *   GET /api/v1/analytics — по дням / магазинам / тегам.
 * Все фильтры (период, тег, поиск, магазин) передаются на бэкенд.
 */
import { api } from './client'
import type { AnalyticsData, Summary, Tag } from './types'
import type { TransactionsPageParams } from './transactions'

function buildQuery(params: TransactionsPageParams): string {
  const search = new URLSearchParams()
  if (params.date_from) search.set('date_from', params.date_from)
  if (params.date_to) search.set('date_to', params.date_to)
  if (params.tag_ids?.length) params.tag_ids.forEach((id) => search.append('tag_ids', id))
  if (params.search) search.set('search', params.search)
  if (params.seller_names?.length)
    params.seller_names.forEach((name) => search.append('seller_names', name))
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

function num(v: number | null | undefined): number {
  return typeof v === 'number' ? v : Number(v ?? 0)
}

interface RawSummary {
  balance: number
  opening_balance: number
  income: number
  expenses: number
  transactions: number
  income_delta: number | null
  expenses_delta: number | null
  balance_trend: number[]
}

/** GET /api/v1/transactions/summary — показатели за выбранный период. */
export async function fetchSummary(params: TransactionsPageParams = {}): Promise<Summary> {
  const raw = await api.get<RawSummary>(`/api/v1/transactions/summary${buildQuery(params)}`)
  return {
    balance: num(raw.balance),
    openingBalance: num(raw.opening_balance),
    income: num(raw.income),
    expenses: num(raw.expenses),
    transactions: raw.transactions,
    incomeDelta: raw.income_delta === null || raw.income_delta === undefined ? null : num(raw.income_delta),
    expensesDelta: raw.expenses_delta === null || raw.expenses_delta === undefined ? null : num(raw.expenses_delta),
    balanceTrend: (raw.balance_trend ?? []).map(num),
  }
}

interface RawAnalytics {
  daily: Array<{ day: string; expenses: number; income: number }>
  by_store: Array<{ store: string; value: number }>
  by_tag: Array<{ tag_id: string; tag_name: string; tag_color: string; value: number }>
}

/** GET /api/v1/analytics — группировки за период (считает бэкенд). */
export async function fetchAnalytics(params: TransactionsPageParams = {}): Promise<AnalyticsData> {
  const raw = await api.get<RawAnalytics>(`/api/v1/analytics${buildQuery(params)}`)
  return {
    daily: raw.daily.map((d) => ({ day: d.day, expenses: num(d.expenses), income: num(d.income) })),
    byStore: raw.by_store.map((s) => ({ store: s.store, value: num(s.value) })),
    byTag: raw.by_tag.map(
      (t): { tag: Tag; value: number } => ({
        tag: { id: t.tag_id, name: t.tag_name, color: t.tag_color, count: 0 },
        value: num(t.value),
      }),
    ),
  }
}
