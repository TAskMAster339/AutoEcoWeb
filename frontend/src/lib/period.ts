import type { PeriodKey } from '../store/uiStore'
import { daysAgoIso, todayIso } from './format'

/** Локальная ISO-дата (без UTC-сдвига toISOString — иначе в МСК дата «уезжает»). */
function localIso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** Начало и конец месяца для «YYYY-MM»; при невалидном значении — текущий месяц. */
function monthRange(monthYear: string | null): { from: string; to: string } {
  const m = /^(\d{4})-(\d{2})$/.exec(monthYear ?? '')
  if (!m) {
    const now = new Date()
    return { from: localIso(new Date(now.getFullYear(), now.getMonth(), 1)), to: todayIso() }
  }
  const year = Number(m[1])
  const month = Number(m[2]) - 1
  if (month < 0 || month > 11) {
    const now = new Date()
    return { from: localIso(new Date(now.getFullYear(), now.getMonth(), 1)), to: todayIso() }
  }
  return { from: localIso(new Date(year, month, 1)), to: localIso(new Date(year, month + 1, 0)) }
}

/** Computes the {from, to} ISO range for a period preset. */
export function rangeFor(
  key: PeriodKey,
  customFrom: string | null,
  customTo: string | null,
  monthYear: string | null = null,
): { from: string; to: string } {
  const now = new Date()
  switch (key) {
    case 'thisMonth': {
      const from = new Date(now.getFullYear(), now.getMonth(), 1)
      return { from: localIso(from), to: todayIso() }
    }
    case 'lastMonth': {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const to = new Date(now.getFullYear(), now.getMonth(), 0)
      return { from: localIso(from), to: localIso(to) }
    }
    case '3m':
      return { from: daysAgoIso(90), to: todayIso() }
    case 'custom':
      return { from: customFrom ?? daysAgoIso(30), to: customTo ?? todayIso() }
    case 'month':
      return monthRange(monthYear)
    case 'all':
    default:
      return { from: '2000-01-01', to: todayIso() }
  }
}
