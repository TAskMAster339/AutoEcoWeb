/**
 * Summary + analytics — derived client-side from the real transactions
 * endpoint. Транзакция — минимальная единица учёта: чеки как «коробки»
 * на сводку не влияют напрямую (см. frontend/TODO.md).
 */
import { fetchTags } from './tags'
import { fetchAllTransactions, isIncomeOperation } from './transactions'
import type { AnalyticsData, AnalyticsDaily, Summary, Tag } from './types'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Локальная ISO-дата (без UTC-сдвига toISOString). */
function localIso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** Границы текущего и прошлого месяца (для дельт). */
function monthBounds(): { thisStart: string; lastStart: string; lastEnd: string } {
  const now = new Date()
  return {
    thisStart: localIso(new Date(now.getFullYear(), now.getMonth(), 1)),
    lastStart: localIso(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
    lastEnd: localIso(new Date(now.getFullYear(), now.getMonth(), 0)),
  }
}

export async function fetchSummary(): Promise<Summary> {
  const txs = await fetchAllTransactions()

  let income = 0
  let expenses = 0
  let monthIncome = 0
  let monthExpenses = 0
  let lastIncome = 0
  let lastExpenses = 0
  const byDay = new Map<string, number>() // день → сальдо

  const { thisStart, lastStart, lastEnd } = monthBounds()
  for (const tx of txs) {
    const amount = Number(tx.amount)
    const day = tx.datetime.slice(0, 10)
    const isIncome = isIncomeOperation(tx.operation_type)
    if (isIncome) {
      income += amount
      if (day >= thisStart) monthIncome += amount
      if (day >= lastStart && day <= lastEnd) lastIncome += amount
    } else {
      expenses += amount
      if (day >= thisStart) monthExpenses += amount
      if (day >= lastStart && day <= lastEnd) lastExpenses += amount
    }
    byDay.set(day, (byDay.get(day) ?? 0) + (isIncome ? amount : -amount))
  }

  // нарастающий баланс по дням (спарклайн)
  const balanceTrend: number[] = []
  let balance = 0
  for (const day of [...byDay.keys()].sort()) {
    balance = round2(balance + (byDay.get(day) ?? 0))
    balanceTrend.push(balance)
  }

  return {
    balance: round2(income - expenses),
    income: round2(income),
    expenses: round2(expenses),
    transactions: txs.length,
    incomeDelta: round2(monthIncome - lastIncome),
    expensesDelta: round2(monthExpenses - lastExpenses),
    balanceTrend,
  }
}

export async function fetchAnalytics(): Promise<AnalyticsData> {
  const [txs, tags] = await Promise.all([fetchAllTransactions(), fetchTags()])
  const tagById = new Map(tags.map((t) => [t.id, t]))

  const daily = new Map<string, AnalyticsDaily>()
  const byStore = new Map<string, number>()
  const byTag = new Map<string, number>()

  for (const tx of txs) {
    const amount = Number(tx.amount)
    const day = tx.datetime.slice(0, 10)
    const isIncome = isIncomeOperation(tx.operation_type)
    const d = daily.get(day) ?? { day, expenses: 0, income: 0 }
    if (isIncome) {
      d.income += amount
    } else {
      d.expenses += amount
      if (tx.seller_name) {
        byStore.set(tx.seller_name, (byStore.get(tx.seller_name) ?? 0) + amount)
      }
    }
    daily.set(day, d)

    if (tx.tag_id) {
      byTag.set(tx.tag_id, (byTag.get(tx.tag_id) ?? 0) + amount)
    }
  }

  return {
    daily: [...daily.values()].sort((a, b) => a.day.localeCompare(b.day)),
    byStore: [...byStore.entries()]
      .map(([store, value]) => ({ store, value: round2(value) }))
      .sort((a, b) => b.value - a.value),
    byTag: [...byTag.entries()]
      .flatMap(([tagId, value]): { tag: Tag; value: number }[] => {
        const tag = tagById.get(tagId)
        return tag ? [{ tag, value: round2(value) }] : []
      })
      .sort((a, b) => b.value - a.value),
  }
}
