import type { OperationFilter, PeriodKey } from '../store/uiStore'
import { normalizeAmountFilter } from './numbers'

export interface TransactionUrlFilters {
  search: string
  tagFilterIds: string[]
  untaggedOnly: boolean
  storeFilters: string[]
  amountMin: string
  amountMax: string
  operationFilter: OperationFilter
  periodKey: PeriodKey
  customFrom: string | null
  customTo: string | null
  monthYear: string | null
  dayDate: string | null
}

const PERIOD_KEYS = new Set<PeriodKey>([
  'thisMonth', 'lastMonth', '3m', 'all', 'custom', 'month', 'day',
])

function nonEmptyValues(params: URLSearchParams, name: string): string[] {
  return params.getAll(name).filter(Boolean)
}

export function parseTransactionFilterSearch(params: URLSearchParams): TransactionUrlFilters {
  const tags = nonEmptyValues(params, 'tag')
  const customFrom = params.get('from') || null
  const customTo = params.get('to') || null
  const monthYear = params.get('month') || null
  const dayDate = params.get('day') || null
  const requestedPeriod = params.get('period')

  let periodKey: PeriodKey = PERIOD_KEYS.has(requestedPeriod as PeriodKey)
    ? requestedPeriod as PeriodKey
    : 'all'
  if (dayDate) periodKey = 'day'
  else if (customFrom && customTo) periodKey = 'custom'
  else if (monthYear) periodKey = 'month'
  if (periodKey === 'day' && !dayDate) periodKey = 'all'
  if (periodKey === 'custom' && (!customFrom || !customTo)) periodKey = 'all'
  if (periodKey === 'month' && !monthYear) periodKey = 'all'

  let amountMin = normalizeAmountFilter(params.get('amountMin') ?? '') ?? ''
  let amountMax = normalizeAmountFilter(params.get('amountMax') ?? '') ?? ''
  if (amountMin && amountMax && Number(amountMin) > Number(amountMax)) {
    amountMin = ''
    amountMax = ''
  }

  const operation = params.get('type')
  return {
    search: params.get('search') ?? '',
    tagFilterIds: tags,
    untaggedOnly: tags.length === 0 && params.get('untagged') === '1',
    storeFilters: nonEmptyValues(params, 'store'),
    amountMin,
    amountMax,
    operationFilter: operation === 'income' || operation === 'expense' ? operation : 'all',
    periodKey,
    customFrom: periodKey === 'custom' ? customFrom : null,
    customTo: periodKey === 'custom' ? customTo : null,
    monthYear: periodKey === 'month' ? monthYear : null,
    dayDate: periodKey === 'day' ? dayDate : null,
  }
}

export function serializeTransactionFilters(filters: TransactionUrlFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.search) params.set('search', filters.search)
  if (filters.tagFilterIds.length) {
    filters.tagFilterIds.forEach((id) => params.append('tag', id))
  } else if (filters.untaggedOnly) {
    params.set('untagged', '1')
  }
  filters.storeFilters.forEach((store) => params.append('store', store))
  if (filters.amountMin) params.set('amountMin', filters.amountMin)
  if (filters.amountMax) params.set('amountMax', filters.amountMax)
  if (filters.operationFilter !== 'all') params.set('type', filters.operationFilter)
  if (filters.periodKey !== 'all') params.set('period', filters.periodKey)
  if (filters.periodKey === 'custom' && filters.customFrom && filters.customTo) {
    params.set('from', filters.customFrom)
    params.set('to', filters.customTo)
  }
  if (filters.periodKey === 'month' && filters.monthYear) params.set('month', filters.monthYear)
  if (filters.periodKey === 'day' && filters.dayDate) params.set('day', filters.dayDate)
  return params
}

export function transactionUrlFiltersEqual(
  left: TransactionUrlFilters,
  right: TransactionUrlFilters,
): boolean {
  return serializeTransactionFilters(left).toString() === serializeTransactionFilters(right).toString()
}
