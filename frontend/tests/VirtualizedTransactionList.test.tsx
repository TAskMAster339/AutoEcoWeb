import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { VirtualizedTransactionList } from '../src/components/transactions/VirtualizedTransactionList'

const ROW_HEIGHT = 112
const GAP = 10
const VIEWPORT_HEIGHT = 400

function createItems(count: number) {
  return Array.from({ length: count }, (_, index) => ({ id: `transaction-${index}` }))
}

async function renderList(count: number, passScrollContainer = true) {
  const scrollContainer = document.createElement('main')
  Object.defineProperty(scrollContainer, 'clientHeight', { configurable: true, value: VIEWPORT_HEIGHT })
  Object.defineProperty(scrollContainer, 'offsetHeight', { configurable: true, value: VIEWPORT_HEIGHT })
  Object.defineProperty(scrollContainer, 'offsetWidth', { configurable: true, value: 360 })
  scrollContainer.scrollTo = ({ top }: ScrollToOptions) => {
    scrollContainer.scrollTop = top ?? 0
    fireEvent.scroll(scrollContainer)
  }
  document.body.append(scrollContainer)

  const rendered = render(
    <VirtualizedTransactionList
      items={createItems(count)}
      scrollContainer={passScrollContainer ? scrollContainer : null}
      renderItem={(item) => <div data-testid={item.id}>{item.id}</div>}
    />,
    { container: scrollContainer },
  )
  await act(async () => {})

  const list = screen.getByRole('list', { name: 'Транзакции' })

  return { ...rendered, list, scrollContainer }
}

describe('VirtualizedTransactionList', () => {
  it('renders on first mount while the outlet scroll element is still null', async () => {
    const { list, scrollContainer } = await renderList(80, false)

    await waitFor(() => {
      expect(Number(list.dataset.virtualEnd)).toBeGreaterThan(0)
      expect(screen.getByTestId('transaction-0')).toBeTruthy()
    })

    await act(async () => {
      scrollContainer.scrollTop = 40 * (ROW_HEIGHT + GAP)
      fireEvent.scroll(scrollContainer)
    })
    await waitFor(() => expect(screen.getByTestId('transaction-40')).toBeTruthy())
  })

  it.each([13, 50, 51, 80])('keeps a correctly sized virtual surface for %i transactions', async (count) => {
    const { list } = await renderList(count)

    await waitFor(() => {
      expect(Number(list.dataset.virtualEnd)).toBeGreaterThan(0)
      const mountedRows = list.querySelectorAll('[role="listitem"]').length
      expect(mountedRows).toBeLessThanOrEqual(count)
      if (count > 13) expect(mountedRows).toBeLessThan(count)
    })
    expect(parseFloat(getComputedStyle(list).height)).toBeGreaterThanOrEqual(count * ROW_HEIGHT)
  })

  it('moves the mounted range through the middle and to the final transaction', async () => {
    const { list, scrollContainer } = await renderList(80)

    await waitFor(() => expect(screen.getByTestId('transaction-0')).toBeTruthy())
    const initialEnd = Number(list.dataset.virtualEnd)
    expect(initialEnd).toBeLessThan(80)

    await act(async () => {
      scrollContainer.scrollTop = 40 * (ROW_HEIGHT + GAP)
      fireEvent.scroll(scrollContainer)
    })
    await waitFor(() => {
      expect(Number(list.dataset.virtualStart)).toBeGreaterThan(0)
      expect(screen.getByTestId('transaction-40')).toBeTruthy()
    })
    expect(screen.queryByTestId('transaction-0')).toBeNull()

    await act(async () => {
      scrollContainer.scrollTop = 80 * (ROW_HEIGHT + GAP) - GAP - VIEWPORT_HEIGHT
      fireEvent.scroll(scrollContainer)
    })
    await waitFor(() => expect(screen.getByTestId('transaction-79')).toBeTruthy())
    expect(Number(list.dataset.virtualEnd)).toBe(80)
  })

  it('remeasures a changed row and preserves a non-zero list offset', async () => {
    const { list } = await renderList(80)

    await waitFor(() => expect(Number(list.dataset.virtualEnd)).toBeGreaterThan(0))
    const firstRow = list.querySelector<HTMLElement>('[data-index="0"]')
    expect(firstRow).not.toBeNull()
    if (!firstRow) return

    const initialHeight = parseFloat(getComputedStyle(list).height)
    firstRow.dataset.testHeight = String(ROW_HEIGHT * 2)
    await act(async () => globalThis.notifyResizeObservers(firstRow))

    await waitFor(() => {
      expect(list.dataset.virtualScrollMargin).toBe('160')
      expect(parseFloat(getComputedStyle(list).height)).toBeGreaterThan(initialHeight)
    })

    list.dataset.testTop = '240'
    await act(async () => window.dispatchEvent(new Event('resize')))
    await waitFor(() => expect(list.dataset.virtualScrollMargin).toBe('240'))
  })
})
