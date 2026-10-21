import { QueryClient } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { invalidateTransactionDomain } from '../src/lib/queryInvalidation'
import { queryKeys } from '../src/lib/queryKeys'
import { registerTransactionDatasource } from '../src/lib/transactionDatasource'

const disposers: Array<() => void> = []

afterEach(() => {
  while (disposers.length > 0) disposers.pop()?.()
})

describe('transaction domain invalidation', () => {
  it('invalidates canonical pages and refreshes registered grid datasources', async () => {
    const client = new QueryClient()
    const pageKey = queryKeys.transactions.page('mobile', { search: 'кофе' })
    client.setQueryData(pageKey, { items: [], total: 0 })
    const refreshGrid = vi.fn()
    disposers.push(registerTransactionDatasource(refreshGrid))

    await invalidateTransactionDomain(client)

    expect(client.getQueryState(pageKey)?.isInvalidated).toBe(true)
    expect(refreshGrid).toHaveBeenCalledOnce()
  })

  it('can preserve locally updated rows while invalidating aggregates', async () => {
    const client = new QueryClient()
    const pageKey = queryKeys.transactions.page('mobile')
    const summaryKey = queryKeys.summary.all()
    client.setQueryData(pageKey, ['locally updated row'])
    client.setQueryData(summaryKey, { balance: 10 })
    const refreshGrid = vi.fn()
    disposers.push(registerTransactionDatasource(refreshGrid))

    await invalidateTransactionDomain(client, { refreshRows: false })

    expect(client.getQueryState(pageKey)?.isInvalidated).toBe(false)
    expect(client.getQueryState(summaryKey)?.isInvalidated).toBe(true)
    expect(refreshGrid).not.toHaveBeenCalled()
  })
})
