import type { QueryClient } from '@tanstack/react-query'
import { queryKeys } from './queryKeys'
import { refreshTransactionDatasources } from './transactionDatasource'

interface TransactionInvalidationOptions {
  refreshRows?: boolean
}

/** Invalidates every projection derived from transaction/receipt rows. */
export async function invalidateTransactionDomain(
  queryClient: QueryClient,
  { refreshRows = true }: TransactionInvalidationOptions = {},
): Promise<void> {
  const invalidations = [
    queryClient.invalidateQueries({ queryKey: queryKeys.transactions.total() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.summary.all() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.stores.all() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.tags.all() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.tags.pages() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.receipts.all() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.userLimits.all() }),
  ]

  if (refreshRows) {
    invalidations.push(
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.pages() }),
    )
    // TanStack marks page queries stale synchronously. Notify imperative grid
    // caches only after that, so their next datasource request cannot reuse a
    // fresh-looking stale page.
    refreshTransactionDatasources()
  }

  await Promise.all(invalidations)
}

export async function invalidateAliasDomain(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.aliases.all() }),
    invalidateTransactionDomain(queryClient),
  ])
}

export async function invalidateSellerDomain(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.sellers.all() }),
    invalidateTransactionDomain(queryClient),
  ])
}

export async function invalidateDeletedReceipt(queryClient: QueryClient, id: string): Promise<void> {
  queryClient.removeQueries({ queryKey: queryKeys.receipts.detail(id) })
  queryClient.removeQueries({ queryKey: queryKeys.receipts.raw(id) })
  await invalidateTransactionDomain(queryClient)
}
