import type { Transaction } from '../api/types'

export interface Receipt {
  id: string
  store: string
  date: string
  items: Transaction[]
  total: number
  isIncome: boolean
  tagIds: string[]
}

/** Groups transactions into receipts by store+date, newest first. */
export function buildReceipts(transactions: Transaction[]): Receipt[] {
  const groups = new Map<string, Transaction[]>()
  for (const tx of transactions) {
    const key = `${tx.store}|${tx.date}`
    const list = groups.get(key) ?? []
    list.push(tx)
    groups.set(key, list)
  }
  return [...groups.entries()]
    .map(([key, items]) => {
      const [store, date] = key.split('|')
      const total = items.reduce((s, t) => s + (t.expense ?? 0) - (t.income ?? 0), 0)
      const tagIds = [...new Set(items.flatMap((t) => t.tagIds))]
      return {
        id: key,
        store: store ?? '',
        date: date ?? '',
        items,
        total,
        isIncome: total <= 0,
        tagIds,
      }
    })
    .sort((a, b) => b.date.localeCompare(a.date))
}
