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

/** Keeps the transaction filter store synchronized with router navigation. */
export function useTransactionFilterUrl(): void {
  const [searchParams, setSearchParams] = useSearchParams()
  const urlSearch = searchParams.toString()
  const applyingUrl = useRef<string | null>(null)
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
    const parsed = parseTransactionFilterSearch(new URLSearchParams(urlSearch))
    if (transactionUrlFiltersEqual(currentFilters(), parsed)) {
      applyingUrl.current = null
      return
    }
    applyingUrl.current = urlSearch
    useUiStore.getState().applyUrlFilters(parsed)
  }, [urlSearch])

  useEffect(() => {
    const parsed = parseTransactionFilterSearch(new URLSearchParams(urlSearch))
    if (applyingUrl.current === urlSearch) {
      if (transactionUrlFiltersEqual(filters, parsed)) applyingUrl.current = null
      return
    }
    const next = serializeTransactionFilters(filters).toString()
    if (next !== urlSearch) setSearchParams(next, { replace: true })
  }, [filters, setSearchParams, urlSearch])
}
