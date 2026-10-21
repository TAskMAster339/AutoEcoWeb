import { afterAll, afterEach, beforeAll, expect, it } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { useMobileTransactionFeed } from '../src/hooks/useMobileTransactionFeed'
import { fetchTransactionsPage } from '../src/api/transactions'

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
afterEach(() => server.resetHandlers())
const transaction = {
  id: '11111111-1111-4111-8111-111111111111', receipt_id: null, name: 'Кофе', normalized_name: 'кофе',
  name_alias_id: null, name_alias_name: null, position: null, quantity: '1', unit: null,
  price: '150.50', amount: '150.50', operation_type: 1, datetime: '2026-10-21T10:00:00Z',
  tag_id: null, tag_source: null, tag_confidence: null, seller_id: null, seller_name: null,
  normalized_seller_name: null, seller_name_alias_id: null, seller_name_alias_name: null,
  comment: null, balance: '-150.50', created_at: null,
}

it('pages with the server cursor, requests total once and decodes Decimal values', async () => {
  const requests: URL[] = []
  server.use(http.get('*/api/v1/transactions', ({ request }) => {
    const url = new URL(request.url)
    requests.push(url)
    return HttpResponse.json(url.searchParams.has('cursor')
      ? { items: [{ ...transaction, id: '22222222-2222-4222-8222-222222222222' }], total: null, next_cursor: null }
      : { items: [transaction], total: 2, next_cursor: 'opaque-server-cursor' })
  }))
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const params = {}
  const view = renderHook(() => useMobileTransactionFeed({ enabled: true, online: true, params, scrollContainer: null }), {
    wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  })
  try {
    await waitFor(() => expect(view.result.current.rows).toHaveLength(1))
    expect(view.result.current.rows[0]?.expense).toBe(150.5)
    await act(() => view.result.current.loadMore())
    await waitFor(() => expect(view.result.current.rows).toHaveLength(2))
    expect(view.result.current.total).toBe(2)
    expect(view.result.current.query.hasNextPage).toBe(false)
    expect(requests.map((url) => url.searchParams.get('include_total'))).toEqual(['true', 'false'])
    expect(requests[1]?.searchParams.get('cursor')).toBe('opaque-server-cursor')
    expect(requests.every((url) => !url.searchParams.has('offset'))).toBe(true)
  } finally {
    view.unmount()
    client.clear()
  }
})

it('rejects a corrupt transaction page without poisoning the query cache', async () => {
  server.use(http.get('*/api/v1/transactions', () => HttpResponse.json({
    items: [{ ...transaction, amount: 'not-money' }], total: 1, next_cursor: null,
  })))
  await expect(fetchTransactionsPage()).rejects.toThrow()
})
