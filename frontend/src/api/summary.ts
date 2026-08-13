/**
 * Summary + analytics — реальные эндпоинты бэкенда, считают SQL:
 *   GET /api/v1/transactions/summary — показатели за период (с дельтами
 *     к предыдущему окну и нарастающим балансом с учётом opening);
 *   GET /api/v1/analytics — по дням / магазинам / тегам.
 * Все фильтры (период, тег, поиск, магазин) передаются на бэкенд.
 */
import { api } from './client'
import type { AnalyticsByCategory, AnalyticsData, PriceChartData, Summary } from './types'
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
  daily: Array<{
    day: string
    expenses: number
    income: number
    count: number
    trend: number | null
  }>
  by_store: Array<{ store: string; value: number }>
  by_store_income: Array<{ store: string; value: number }>
  by_category: Array<{
    tag_id: string
    tag_name: string
    tag_color: string
    value: number
    count: number
  }>
  by_weekday: Array<{ weekday: number; value: number; count: number }>
  indicators: {
    top_store: RawAnalytics['by_store'][number] | null
    top_category: RawAnalytics['by_category'][number] | null
    top_weekday: RawAnalytics['by_weekday'][number] | null
    top_income_source: RawAnalytics['by_store'][number] | null
  }
}

function mapCategory(c: RawAnalytics['by_category'][number]): AnalyticsByCategory {
  return {
    tag: { id: c.tag_id, name: c.tag_name, color: c.tag_color, icon: null, count: 0 },
    value: num(c.value),
    count: c.count,
  }
}

/** GET /api/v1/analytics — группировки за период (считает бэкенд). */
export async function fetchAnalytics(params: TransactionsPageParams = {}): Promise<AnalyticsData> {
  const raw = await api.get<RawAnalytics>(`/api/v1/analytics${buildQuery(params)}`)
  return {
    daily: raw.daily.map((d) => ({
      day: d.day,
      expenses: num(d.expenses),
      income: num(d.income),
      count: d.count,
      trend: d.trend === null || d.trend === undefined ? null : num(d.trend),
    })),
    byStore: raw.by_store.map((s) => ({ store: s.store, value: num(s.value) })),
    byStoreIncome: raw.by_store_income.map((s) => ({ store: s.store, value: num(s.value) })),
    byCategory: raw.by_category.map(mapCategory),
    byWeekday: raw.by_weekday.map((w) => ({ weekday: w.weekday, value: num(w.value), count: w.count })),
    indicators: {
      topStore: raw.indicators.top_store
        ? { store: raw.indicators.top_store.store, value: num(raw.indicators.top_store.value) }
        : null,
      topCategory: raw.indicators.top_category ? mapCategory(raw.indicators.top_category) : null,
      topWeekday: raw.indicators.top_weekday
        ? {
            weekday: raw.indicators.top_weekday.weekday,
            value: num(raw.indicators.top_weekday.value),
            count: raw.indicators.top_weekday.count,
          }
        : null,
      topIncomeSource: raw.indicators.top_income_source
        ? { store: raw.indicators.top_income_source.store, value: num(raw.indicators.top_income_source.value) }
        : null,
    },
  }
}

interface RawPriceChart {
  points: Array<{ day: string; price: number; count: number; store: string | null }>
  stores: Array<string | null>
  avg_price: number
  median_price: number
  stddev: number
  count: number
}

/** GET /api/v1/analytics/price-chart — точки, магазины, статистика (считает бэкенд). */
export async function fetchPriceChart(
  name: string,
  isRegex: boolean,
  params: TransactionsPageParams = {},
): Promise<PriceChartData> {
  const search = new URLSearchParams()
  search.set('name', name)
  if (isRegex) search.set('is_regex', 'true')
  if (params.date_from) search.set('date_from', params.date_from)
  if (params.date_to) search.set('date_to', params.date_to)
  const raw = await api.get<RawPriceChart>(`/api/v1/analytics/price-chart?${search.toString()}`)
  return {
    points: raw.points.map((p) => ({ day: p.day, price: num(p.price), count: p.count, store: p.store })),
    stores: raw.stores,
    avgPrice: num(raw.avg_price),
    medianPrice: num(raw.median_price),
    stddev: num(raw.stddev),
    count: raw.count,
  }
}
