import React, { useCallback, useState } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Outlet, Route, Routes, useOutletContext } from 'react-router-dom'
import { QueryClient, QueryClientProvider, useInfiniteQuery } from '@tanstack/react-query'
import { VerifiedAccessRoute } from '../src/components/common/RouteGuards'
import { VirtualizedTransactionList } from '../src/components/transactions/VirtualizedTransactionList'
import { useInfiniteScroll } from '../src/hooks/useInfiniteScroll'
import { useAuthStore } from '../src/store/authStore'
import { nextPageOffset } from '../src/lib/mobilePagination.mjs'

afterEach(() => useAuthStore.setState({ user: null, status: 'idle' }))

async function mountFeed(total: number) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const fetchPage = vi.fn(async (offset: number) => ({
    items: Array.from({ length: Math.min(50, total - offset) }, (_, index) => ({
      id: `transaction-${offset + index}`,
    })),
    total,
  }))

  function Shell() {
    const [main, setMain] = useState<HTMLElement | null>(null)
    const mountMain = useCallback((element: HTMLElement | null) => {
      if (element) Object.defineProperties(element, {
        clientHeight: { configurable: true, value: 400 },
        offsetHeight: { configurable: true, value: 400 },
        offsetWidth: { configurable: true, value: 360 },
        // jsdom has no layout; use the actual virtual surface's CSS height.
        scrollHeight: { configurable: true, get: () =>
          160 + parseFloat(getComputedStyle(element.querySelector('[role="list"]')!).height) + 112 },
      })
      setMain(element)
    }, [])
    return <main ref={mountMain}><Outlet context={main} /></main>
  }

  function Feed() {
    const container = useOutletContext<HTMLElement | null>()
    const query = useInfiniteQuery({
      queryKey: ['test-transactions'],
      queryFn: ({ pageParam }) => fetchPage(pageParam),
      initialPageParam: 0,
      getNextPageParam: (_lastPage, pages) => nextPageOffset(pages),
    })
    const items = query.data?.pages.flatMap((page) => page.items) ?? []
    useInfiniteScroll({
      container,
      enabled: query.hasNextPage && !query.isFetchingNextPage && !query.isFetchNextPageError,
      itemCount: items.length,
      onLoadMore: () => query.fetchNextPage(),
    })
    return <>
      <VirtualizedTransactionList items={items} scrollContainer={container}
        renderItem={(item) => <div>{item.id}</div>} />
      <output>{items.length} / {total}</output>
    </>
  }

  useAuthStore.setState({
    user: { id: 'test', email: 'test@example.test', role: 'user', status: 'active' },
    status: 'authenticated',
  })
  const host = document.createElement('div')
  document.body.append(host)
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/transactions']}>
        <Routes>
          <Route element={<Shell />}>
            <Route element={<VerifiedAccessRoute />}>
              <Route path="/transactions" element={<Feed />} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
    { container: host },
  )
  const main = host.querySelector('main')!
  const dispose = () => {
    view.unmount()
    client.clear()
    host.remove()
  }
  return { main, fetchPage, dispose }
}

describe('mobile pagination through the access route', () => {
  it.each([51, 80, 125])('automatically reaches all %i transactions by scrolling main', async (total) => {
    const { main, fetchPage, dispose } = await mountFeed(total)
    try {
      await screen.findByText(`50 / ${total}`)
      expect(fetchPage.mock.calls.map(([offset]) => offset)).toEqual([0])

      for (let loaded = 50; loaded < total; loaded += 50) {
        await act(async () => {
          main.scrollTop = main.scrollHeight - main.clientHeight - 100
          fireEvent.scroll(main)
          fireEvent.scroll(main)
        })
        await screen.findByText(`${Math.min(loaded + 50, total)} / ${total}`)
      }

      await act(async () => {
        main.scrollTop = main.scrollHeight - main.clientHeight
        fireEvent.scroll(main)
      })
      await waitFor(() => expect(screen.getByText(`transaction-${total - 1}`)).toBeTruthy())
      expect(fetchPage.mock.calls.map(([offset]) => offset))
        .toEqual(Array.from({ length: Math.ceil(total / 50) }, (_, index) => index * 50))
    } finally {
      dispose()
    }
  })
})
