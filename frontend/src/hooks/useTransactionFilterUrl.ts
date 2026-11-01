import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { useUiStore } from '../store/uiStore'
import {
  parseTransactionFilterSearch,
  serializeTransactionFilters,
  transactionUrlFiltersEqual,
  type TransactionUrlFilters,
} from '../lib/transactionFilterUrl'

function currentFilters(): TransactionUrlFilters {
  const state = useUiStore.getState()
  return {
    search: state.search,
    tagFilterIds: state.tagFilterIds,
    untaggedOnly: state.untaggedOnly,
    storeFilters: state.storeFilters,
    amountMin: state.amountMin,
    amountMax: state.amountMax,
    operationFilter: state.operationFilter,
    periodKey: state.periodKey,
    customFrom: state.customFrom,
    customTo: state.customTo,
    monthYear: state.monthYear,
    dayDate: state.dayDate,
  }
}

function filtersFromUrl(search: string): TransactionUrlFilters {
  const params = new URLSearchParams(search)
  const parsed = parseTransactionFilterSearch(params)
  // A plain navigation link must preserve the shared period. Explicit date
  // parameters in deep links still take precedence over the saved selection.
  if (!['period', 'from', 'to', 'month', 'day'].some((key) => params.has(key))) {
    const { periodKey, customFrom, customTo, monthYear, dayDate } = currentFilters()
    return { ...parsed, periodKey, customFrom, customTo, monthYear, dayDate }
  }
  return parsed
}

/** Keeps the transaction filter store synchronized with router navigation. */
export function useTransactionFilterUrl(): void {
  const [searchParams, setSearchParams] = useSearchParams()
  const urlSearch = searchParams.toString()
  const applyingUrl = useRef<string | null>(null)
  // Router updates from this hook may render before the store subscription effect
  // has cleared applyingUrl. Keep the URL echo suppressed across those renders.
  const lastWrittenUrl = useRef<string | null>(null)
  const filters = useUiStore(useShallow((state) => ({
    search: state.search,
    tagFilterIds: state.tagFilterIds,
    untaggedOnly: state.untaggedOnly,
    storeFilters: state.storeFilters,
    amountMin: state.amountMin,
    amountMax: state.amountMax,
    operationFilter: state.operationFilter,
    periodKey: state.periodKey,
    customFrom: state.customFrom,
    customTo: state.customTo,
    monthYear: state.monthYear,
    dayDate: state.dayDate,
  })))

  useEffect(() => {
    const parsed = filtersFromUrl(urlSearch)
    if (lastWrittenUrl.current === urlSearch) {
      lastWrittenUrl.current = null
      applyingUrl.current = null
      return
    }
    if (transactionUrlFiltersEqual(currentFilters(), parsed)) {
      applyingUrl.current = null
      return
    }
    applyingUrl.current = urlSearch
    useUiStore.getState().applyUrlFilters(parsed)
  }, [urlSearch])

  useEffect(() => {
    const parsed = filtersFromUrl(urlSearch)
    if (applyingUrl.current === urlSearch) {
      if (transactionUrlFiltersEqual(filters, parsed)) applyingUrl.current = null
      return
    }
    const next = serializeTransactionFilters(filters).toString()
    if (next !== urlSearch) {
      lastWrittenUrl.current = next
      setSearchParams(next, { replace: true })
    }
  }, [filters, setSearchParams, urlSearch])
}
