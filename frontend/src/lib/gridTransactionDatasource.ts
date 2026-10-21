import type { QueryClient } from '@tanstack/react-query'
import type { IDatasource } from 'ag-grid-community'
import { fetchTransactionsPage, toTransactionView, type TransactionsPageParams } from '../api/transactions'
import type { TransactionView } from '../api/types'
import { queryKeys } from './queryKeys'

interface GridDatasourceOptions {
  queryClient: QueryClient
  getParams: () => TransactionsPageParams
  getGeneration: () => number
  onPage: (rows: TransactionView[], total: number) => void
}

/** Adapts AG Grid block requests to the canonical transaction query cache. */
export function createGridTransactionDatasource({ queryClient, getParams, getGeneration, onPage }: GridDatasourceOptions): IDatasource {
  let destroyed = false
  return {
    destroy: () => { destroyed = true },
    getRows({ startRow, endRow, sortModel, successCallback, failCallback }) {
      const generation = getGeneration()
      const params = getParams()
      const sort = sortModel?.[0]
      const sortBy = (sort?.colId && sort.sort ? sort.colId : 'date') as TransactionsPageParams['sort_by']
      const sortDir = sort?.sort ?? 'asc'
      const limit = endRow - startRow
      void queryClient.fetchQuery({
        queryKey: queryKeys.transactions.page(params, sortBy, sortDir, limit, startRow),
        queryFn: ({ signal }) => fetchTransactionsPage({
          ...params, limit, offset: startRow, sort_by: sortBy, sort_dir: sortDir,
        }, signal),
        staleTime: 30_000,
      }).then((page) => {
        if (destroyed) return
        if (generation !== getGeneration()) {
          failCallback()
          return
        }
        const rows = page.items.map(toTransactionView)
        const total = page.total ?? 0
        onPage(rows, total)
        successCallback(rows, total)
      }).catch(() => { if (!destroyed) failCallback() })
    },
  }
}
