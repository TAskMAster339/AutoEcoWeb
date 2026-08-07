/** ru-RU formatters used across the app. */

const currencyFmt = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const numberFmt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 })

const dayMonthFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' })
const fullDateFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
const monthFmt = new Intl.DateTimeFormat('ru-RU', { month: 'long' })

/** 112 591,44 ₽ — «—» for null/undefined (e.g. income column on an expense row). */
export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return currencyFmt.format(value)
}

/** +8 901,24 ₽ / −310,34 ₽ with explicit sign. */
export function formatSignedCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  const sign = value > 0 ? '+' : '−'
  return `${sign}${currencyFmt.format(Math.abs(value))}`
}

/** 1 234,5 */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return numberFmt.format(value)
}

/** 2024-07-01 -> «1 июл.» */
export function formatShortDate(isoDate: string): string {
  const d = new Date(isoDate)
  if (Number.isNaN(d.getTime())) return isoDate
  return dayMonthFmt.format(d).replace('.', '')
}

/** 2024-07-01 -> «1 июл. 2024 г.» */
export function formatLongDate(isoDate: string): string {
  const d = new Date(isoDate)
  if (Number.isNaN(d.getTime())) return isoDate
  return fullDateFmt.format(d)
}

/** Month name with capital letter. */
export function formatMonth(isoDate: string): string {
  const d = new Date(isoDate)
  if (Number.isNaN(d.getTime())) return isoDate
  const m = monthFmt.format(d)
  return m.charAt(0).toUpperCase() + m.slice(1)
}

/** «1 июл. – 31 июл. 2024» */
export function formatPeriodLabel(fromIso: string, toIso: string): string {
  return `${formatShortDate(fromIso)} – ${formatLongDate(toIso)}`
}

/** -12% / +3% */
export function formatPercent(percent: number): string {
  const sign = percent > 0 ? '+' : ''
  return `${sign}${percent.toFixed(0)}%`
}

/** ISO date 30 days ago (local). */
export function daysAgoIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}
