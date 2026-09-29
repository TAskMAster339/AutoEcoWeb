import { useCallback, useMemo } from 'react'
import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import type { TransactionsPageParams } from '../api/transactions'
import { fetchTransactionsPage, toTransactionView } from '../api/transactions'
import type { Transaction, TransactionUpdatePatch, TransactionView } from '../api/types'
import { useInfiniteScroll } from './useInfiniteScroll'
import { nextPageOffset } from '../lib/mobilePagination'
import { queryKeys } from '../lib/queryKeys'
import { replaceTransactionInPlace } from '../lib/transactionInteractions'

const MOBILE_PAGE_SIZE = 50

interface MobileTransactionPage {
  items: TransactionView[]
  total: number | null
}

function replaceTransactionInPages(
  data: InfiniteData<MobileTransactionPage> | undefined,
  updated: Transaction,
  patch: TransactionUpdatePatch,
): InfiniteData<MobileTransactionPage> | undefined {
  if (!data || !updated.id) return data
  const currentRows = data.pages.flatMap((page) => page.items)
  const updatedView = toTransactionView(updated)
  const preserveInheritedStore = !('seller_name' in patch) && updatedView.store === null
  const nextRows = replaceTransactionInPlace(currentRows, updatedView, preserveInheritedStore)
  if (nextRows === currentRows) return data

  let cursor = 0
  return {
    ...data,
    pages: data.pages.map((page) => {
      const items = nextRows.slice(cursor, cursor + page.items.length)
      cursor += page.items.length
      return { ...page, items }
    }),
  }
}

interface MobileTransactionFeedOptions {
  enabled: boolean
  online: boolean
  params: TransactionsPageParams
  scrollContainer: HTMLElement | null
}

/** Owns the mobile feed query, paging trigger and safe in-place cache updates. */
export function useMobileTransactionFeed({
  enabled,
  online,
  params,
  scrollContainer,
}: MobileTransactionFeedOptions) {
  const queryClient = useQueryClient()
  const queryKey = queryKeys.transactions.page('mobile', params, 'date', 'asc', MOBILE_PAGE_SIZE)
  const query = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam, signal }) => {
      const page = await fetchTransactionsPage({
        limit: MOBILE_PAGE_SIZE,
        offset: pageParam,
        ...params,
        sort_by: 'date',
        sort_dir: 'asc',
      }, signal)
      return { items: page.items.map(toTransactionView), total: page.total ?? 0 }
    },
    initialPageParam: 0,
    getNextPageParam: (_lastPage, pages) => nextPageOffset(pages),
    enabled: enabled && online,
    staleTime: 30_000,
  })
  const rows = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data])
  const total = query.data?.pages.at(-1)?.total ?? null
  const loadMore = useCallback(async () => {
    await query.fetchNextPage().catch(() => undefined)
  }, [query.fetchNextPage])

  useInfiniteScroll({
    container: scrollContainer,
    enabled: enabled && online && query.hasNextPage && !query.isFetchingNextPage && !query.isFetchNextPageError,
    itemCount: rows.length,
    onLoadMore: loadMore,
  })

  const updateCachedTransaction = useCallback((updated: Transaction, patch: TransactionUpdatePatch) => {
    if (patch.datetime !== undefined) return
    queryClient.setQueryData<InfiniteData<MobileTransactionPage>>(
      queryKey,
      (data) => replaceTransactionInPages(data, updated, patch),
    )
  }, [queryClient, queryKey])

  return { query, rows, total, loadMore, updateCachedTransaction }
}
