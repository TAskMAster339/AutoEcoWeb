import { expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { createGridTransactionDatasource } from '../src/lib/gridTransactionDatasource'
import * as transactions from '../src/api/transactions'

it('drops an old filter response before it can change totals or populate the grid', async () => {
  let finish!: (value: Awaited<ReturnType<typeof transactions.fetchTransactionsPage>>) => void
  const fetchPage = vi.spyOn(transactions, 'fetchTransactionsPage').mockImplementation(() => new Promise((resolve) => { finish = resolve }))
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  let generation = 0
  const onPage = vi.fn()
  const successCallback = vi.fn()
  const failCallback = vi.fn()
  const datasource = createGridTransactionDatasource({
    queryClient: client, getParams: () => ({ search: 'old filter' }), getGeneration: () => generation, onPage,
  })
  try {
    datasource.getRows({ startRow: 0, endRow: 50, sortModel: [], filterModel: {}, context: null, successCallback, failCallback })
    await vi.waitFor(() => expect(fetchPage).toHaveBeenCalledOnce())
    generation += 1
    finish({ items: [], total: 42, next_cursor: null })
    await vi.waitFor(() => expect(failCallback).toHaveBeenCalledOnce())
    expect(onPage).not.toHaveBeenCalled()
    expect(successCallback).not.toHaveBeenCalled()
  } finally {
    datasource.destroy?.()
    client.clear()
    fetchPage.mockRestore()
  }
})
