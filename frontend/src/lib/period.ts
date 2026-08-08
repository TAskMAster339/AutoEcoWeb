import type { PeriodKey } from '../store/uiStore'
import { daysAgoIso, todayIso } from './format'

/** Локальная ISO-дата (без UTC-сдвига toISOString — иначе в МСК дата «уезжает»). */
function localIso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** Computes the {from, to} ISO range for a period preset. */
export function rangeFor(
  key: PeriodKey,
  customFrom: string | null,
  customTo: string | null,
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
    case 'all':
    default:
      return { from: '2000-01-01', to: todayIso() }
  }
}
