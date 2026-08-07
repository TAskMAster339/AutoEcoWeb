/**
 * Mock domain data — displayed behind the VITE_USE_MOCK_API feature flag until
 * the backend provides the endpoints (see frontend/TODO.md).
 * Numbers and stores mirror the designer's mockup. Dates are shifted to the
 * current month so period filters behave realistically.
 */

import type { AnalyticsData, Rule, Tag, Transaction } from '../api/types'

/** Shifts a 2024-07-DD mock date to the same day of the current month. */
function shiftToCurrentMonth(iso: string): string {
  const [, , day] = iso.split('-')
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  // day 1..15 from the seed — safe for every month
  return `${y}-${m}-${day ?? '01'}`
}

export const TAGS: Tag[] = [
  { id: 't-save', name: 'Сбережения', color: '#16A34A', count: 1 },
  { id: 't-food', name: 'Продукты', color: '#3B82F6', count: 12 },
  { id: 't-bio', name: 'Био', color: '#65A30D', count: 6 },
  { id: 't-dairy', name: 'Молочка', color: '#8B5CF6', count: 5 },
  { id: 't-cosmetics', name: 'Косметика', color: '#F97316', count: 1 },
  { id: 't-transport', name: 'Транспорт', color: '#06B6D4', count: 1 },
]

type SeedRow = {
  date: string
  store: string
  tagIds: string[]
  description: string
  quantity: number | null
  price: number | null
  income?: number
  expense?: number
  comment?: string | null
}

/** Новые записи — в конце списка; баланс считается обходом по возрастанию дат. */
const SEED: SeedRow[] = [
  { date: '2024-07-01', store: 'Сбережения', tagIds: ['t-save'], description: 'Пополнение накоплений', quantity: null, price: null, income: 8901.24, comment: 'Зарплата' },
  { date: '2024-07-01', store: 'Дикси', tagIds: ['t-food'], description: 'Нап. Газ. Фрустайл', quantity: 1, price: 139.9, expense: 139.9 },
  { date: '2024-07-01', store: 'Дикси', tagIds: ['t-food'], description: 'Heinz Sous clad.чили', quantity: 1, price: 89.9, expense: 89.9 },
  { date: '2024-07-02', store: 'Перекрёсток', tagIds: ['t-dairy'], description: 'Йогурт греческий 5%', quantity: 1, price: 74.99, expense: 74.99 },
  { date: '2024-07-02', store: 'ВкусВилл', tagIds: ['t-bio'], description: 'Хлеб бородинский', quantity: 1, price: 52.0, expense: 52.0 },
  { date: '2024-07-02', store: 'ВкусВилл', tagIds: ['t-dairy'], description: 'Молоко 3,2% 1л', quantity: 1, price: 89.9, expense: 89.9 },
  { date: '2024-07-03', store: 'Пятёрочка', tagIds: ['t-food'], description: 'Яйца С1 10шт', quantity: 1, price: 129.9, expense: 129.9 },
  { date: '2024-07-03', store: 'Дикси', tagIds: ['t-bio'], description: 'Банан 1кг', quantity: 1, price: 84.5, expense: 84.5 },
  { date: '2024-07-04', store: 'Перекрёсток', tagIds: ['t-dairy'], description: 'Сыр Российский 45%', quantity: 0.31, price: 599.9, expense: 185.97 },
  { date: '2024-07-05', store: 'Дикси', tagIds: ['t-food'], description: 'Печенье овсяное', quantity: 1, price: 45.99, expense: 45.99 },
  { date: '2024-07-05', store: 'Магнит', tagIds: ['t-cosmetics'], description: 'Шампунь Head&Shoulders', quantity: 1, price: 349.0, expense: 349.0 },
  { date: '2024-07-06', store: 'Перекрёсток', tagIds: ['t-dairy'], description: 'Творог 9% 300г', quantity: 1, price: 119.9, expense: 119.9 },
  { date: '2024-07-06', store: 'Дикси', tagIds: ['t-food'], description: 'Курица филе 1кг', quantity: 1, price: 289.9, expense: 289.9 },
  { date: '2024-07-08', store: 'Яндекс Лавка', tagIds: ['t-bio'], description: 'Авокадо Хасс', quantity: 2, price: 89.9, expense: 179.8 },
  { date: '2024-07-09', store: 'Дикси', tagIds: ['t-dairy'], description: 'Сметана 20%', quantity: 1, price: 98.5, expense: 98.5 },
  { date: '2024-07-10', store: 'Пятёрочка', tagIds: ['t-dairy'], description: 'Масло сливочное 82,5%', quantity: 1, price: 199.9, expense: 199.9 },
  { date: '2024-07-11', store: 'Дикси', tagIds: ['t-food'], description: 'Картофель 2кг', quantity: 1, price: 79.9, expense: 79.9 },
  { date: '2024-07-12', store: 'ВкусВилл', tagIds: ['t-bio'], description: 'Лосось слабосолёный', quantity: 1, price: 549.0, expense: 549.0 },
  { date: '2024-07-13', store: 'Перекрёсток', tagIds: ['t-food'], description: 'Сок апельсиновый 1л', quantity: 2, price: 129.9, expense: 259.8 },
  { date: '2024-07-14', store: 'Дикси', tagIds: ['t-food'], description: 'Гречка 800г', quantity: 1, price: 119.0, expense: 119.0 },
  { date: '2024-07-15', store: 'Метро', tagIds: ['t-transport'], description: 'Проезд', quantity: null, price: null, expense: 62.0 },
  { date: '2024-07-15', store: 'Дикси', tagIds: ['t-bio'], description: 'Огурцы 1кг', quantity: 1, price: 119.9, expense: 119.9 },
]

/** Стартовый баланс на начало периода (до первой операции). */
export const STARTING_BALANCE = 115500.24

const STATUS_CYCLE: Array<Transaction['priceStatus']> = [
  { direction: 'down', percent: -12 },
  { direction: 'up', percent: 3 },
  { direction: 'down', percent: -10 },
  null,
  { direction: 'up', percent: 8 },
  null,
]

export function buildTransactions(): Transaction[] {
  let balance = STARTING_BALANCE
  return SEED.map((row, i) => {
    const income = row.income ?? null
    const expense = row.expense ?? null
    balance = balance + (income ?? 0) - (expense ?? 0)
    return {
      id: `tx-${String(i + 1).padStart(3, '0')}`,
      date: shiftToCurrentMonth(row.date),
      store: row.store,
      tagIds: row.tagIds,
      description: row.description,
      quantity: row.quantity,
      price: row.price,
      income,
      expense,
      balance: Math.round(balance * 100) / 100,
      priceStatus: STATUS_CYCLE[i % STATUS_CYCLE.length] ?? null,
      comment: row.comment ?? null,
    }
  })
}

export const MOCK_TRANSACTIONS: Transaction[] = buildTransactions()

export function buildSummary() {
  const income = MOCK_TRANSACTIONS.reduce((s, t) => s + (t.income ?? 0), 0)
  const expenses = MOCK_TRANSACTIONS.reduce((s, t) => s + (t.expense ?? 0), 0)
  const checks = MOCK_TRANSACTIONS.filter((t) => t.expense !== null).length
  const balance = MOCK_TRANSACTIONS[MOCK_TRANSACTIONS.length - 1]?.balance ?? STARTING_BALANCE
  return {
    balance,
    income,
    expenses,
    checks,
    incomeDelta: 8901.24,
    expensesDelta: -310.34,
    balanceTrend: MOCK_TRANSACTIONS.map((t) => t.balance),
  }
}

export const MOCK_RULES: Rule[] = [
  { id: 'r-1', pattern: 'дикси', alias: 'Дикси', tagId: 't-food', enabled: true },
  { id: 'r-2', pattern: 'перекресток|перекрёсток', alias: 'Перекрёсток', tagId: 't-food', enabled: true },
  { id: 'r-3', pattern: 'вкусвилл', alias: 'ВкусВилл', tagId: 't-bio', enabled: true },
  { id: 'r-4', pattern: 'пятерочка|пятёрочка', alias: 'Пятёрочка', tagId: 't-food', enabled: true },
  { id: 'r-5', pattern: 'метро', alias: 'Метро', tagId: 't-transport', enabled: true },
  { id: 'r-6', pattern: 'магнит', alias: 'Магнит', tagId: 't-cosmetics', enabled: false },
]

export const MOCK_ANALYTICS: AnalyticsData = {
  daily: [
    { day: '2024-07-01', expenses: 229.8, income: 8901.24 },
    { day: '2024-07-02', expenses: 216.89, income: 0 },
    { day: '2024-07-03', expenses: 214.4, income: 0 },
    { day: '2024-07-04', expenses: 185.97, income: 0 },
    { day: '2024-07-05', expenses: 394.99, income: 0 },
    { day: '2024-07-06', expenses: 409.8, income: 0 },
    { day: '2024-07-07', expenses: 0, income: 0 },
    { day: '2024-07-08', expenses: 179.8, income: 0 },
    { day: '2024-07-09', expenses: 98.5, income: 0 },
    { day: '2024-07-10', expenses: 199.9, income: 0 },
    { day: '2024-07-11', expenses: 79.9, income: 0 },
    { day: '2024-07-12', expenses: 549.0, income: 0 },
    { day: '2024-07-13', expenses: 259.8, income: 0 },
    { day: '2024-07-14', expenses: 119.0, income: 0 },
    { day: '2024-07-15', expenses: 181.9, income: 0 },
  ].map((d) => ({ ...d, day: shiftToCurrentMonth(d.day) })),
  byStore: [
    { store: 'Дикси', value: 1178.49 },
    { store: 'Перекрёсток', value: 740.56 },
    { store: 'ВкусВилл', value: 690.9 },
    { store: 'Магнит', value: 349.0 },
    { store: 'Пятёрочка', value: 329.8 },
    { store: 'Яндекс Лавка', value: 179.8 },
    { store: 'Метро', value: 62.0 },
  ],
  byTag: [
    { tag: TAGS[1]!, value: 1743.48 },
    { tag: TAGS[2]!, value: 985.1 },
    { tag: TAGS[3]!, value: 583.19 },
    { tag: TAGS[4]!, value: 349.0 },
    { tag: TAGS[5]!, value: 62.0 },
  ],
}
