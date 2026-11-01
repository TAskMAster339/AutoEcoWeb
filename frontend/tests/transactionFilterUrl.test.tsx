import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'

import { useTransactionFilterUrl } from '../src/hooks/useTransactionFilterUrl'
import {
  parseTransactionFilterSearch,
  serializeTransactionFilters,
} from '../src/lib/transactionFilterUrl'
import { useUiStore } from '../src/store/uiStore'

const EMPTY_FILTERS = {
  search: '',
  tagFilterIds: [],
  untaggedOnly: false,
  storeFilters: [],
  amountMin: '',
  amountMax: '',
  operationFilter: 'all' as const,
  periodKey: 'all' as const,
  customFrom: null,
  customTo: null,
  monthYear: null,
  dayDate: null,
}

afterEach(() => {
  act(() => useUiStore.getState().applyUrlFilters(EMPTY_FILTERS))
})

function UrlProbe() {
  useTransactionFilterUrl()
  const location = useLocation()
  const navigate = useNavigate()
  const search = useUiStore((state) => state.search)
  return (
    <>
      <output aria-label="store search">{search}</output>
      <output aria-label="location search">{location.search}</output>
      <button onClick={() => useUiStore.getState().setSearch('из стора')}>store</button>
      <button onClick={() => useUiStore.getState().setSearch('вод')}>вод</button>
      <button onClick={() => useUiStore.getState().setSearch('вода')}>вода</button>
      <button onClick={() => navigate(-1)}>back</button>
    </>
  )
}

describe('transaction filter URL contract', () => {
  it.each([
    { periodKey: 'thisMonth' as const },
    { periodKey: 'month' as const, monthYear: '2026-09' },
    { periodKey: 'day' as const, dayDate: '2026-09-21' },
    { periodKey: 'custom' as const, customFrom: '2026-09-01', customTo: '2026-09-21' },
  ])('preserves the shared period on entry and after leaving the table: %j', async (period) => {
    useUiStore.setState({ ...EMPTY_FILTERS, ...period })
    function Navigation() {
      const navigate = useNavigate()
      return <>
        <button onClick={() => navigate('/dashboard')}>dashboard</button>
        <button onClick={() => navigate('/transactions')}>table</button>
      </>
    }
    render(<MemoryRouter initialEntries={['/dashboard']}>
      <Navigation />
      <Routes>
        <Route path="/dashboard" element={<div>Dashboard</div>} />
        <Route path="/transactions" element={<UrlProbe />} />
      </Routes>
    </MemoryRouter>)

    fireEvent.click(screen.getByRole('button', { name: 'table' }))
    await waitFor(() => expect(screen.getByLabelText('location search').textContent).toContain(`period=${period.periodKey}`))
    expect(useUiStore.getState()).toMatchObject(period)
    fireEvent.click(screen.getByRole('button', { name: 'dashboard' }))
    act(() => useUiStore.getState().setPeriodKey('lastMonth'))
    fireEvent.click(screen.getByRole('button', { name: 'table' }))
    await waitFor(() => expect(screen.getByLabelText('location search').textContent).toContain('period=lastMonth'))
    expect(useUiStore.getState().periodKey).toBe('lastMonth')
    act(() => useUiStore.getState().setPeriodKey('all'))
    await waitFor(() => expect(screen.getByLabelText('location search').textContent).toBe(''))
    expect(useUiStore.getState().periodKey).toBe('all')
  })

  it.each(['period=all', 'period=lastMonth', 'day=2026-09-21'])('honors an explicit deep-link period: %s', async (query) => {
    useUiStore.setState({ ...EMPTY_FILTERS, periodKey: 'thisMonth' })
    render(<MemoryRouter initialEntries={[`/transactions?${query}`]}><UrlProbe /></MemoryRouter>)
    await waitFor(() => expect(useUiStore.getState()).toMatchObject(parseTransactionFilterSearch(new URLSearchParams(query))))
  })

  it('round-trips normalized filters through pure parse and serialize functions', () => {
    const parsed = parseTransactionFilterSearch(new URLSearchParams(
      'search=кофе&tag=a&tag=b&store=Дом&type=expense&period=month&month=2026-09',
    ))

    expect(parsed).toMatchObject({
      search: 'кофе',
      tagFilterIds: ['a', 'b'],
      storeFilters: ['Дом'],
      operationFilter: 'expense',
      periodKey: 'month',
      monthYear: '2026-09',
    })
    expect(parseTransactionFilterSearch(serializeTransactionFilters(parsed))).toEqual(parsed)
  })

  it('follows Back navigation and writes store edits through React Router', async () => {
    render(
      <MemoryRouter
        initialEntries={['/transactions?search=первый', '/transactions?search=второй']}
        initialIndex={1}
      >
        <UrlProbe />
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByLabelText('store search').textContent).toBe('второй'))
    fireEvent.click(screen.getByRole('button', { name: 'back' }))
    await waitFor(() => expect(screen.getByLabelText('store search').textContent).toBe('первый'))

    fireEvent.click(screen.getByRole('button', { name: 'store' }))
    await waitFor(() => {
      expect(screen.getByLabelText('location search').textContent)
        .toBe('?search=%D0%B8%D0%B7+%D1%81%D1%82%D0%BE%D1%80%D0%B0')
    })
  })

  it('keeps successive search edits in sync without restoring stale URL text', async () => {
    render(<MemoryRouter initialEntries={['/transactions']}><UrlProbe /></MemoryRouter>)

    fireEvent.click(screen.getByRole('button', { name: 'store' }))
    await waitFor(() => expect(screen.getByLabelText('store search').textContent).toBe('из стора'))
    fireEvent.click(screen.getByRole('button', { name: 'вод' }))
    await waitFor(() => expect(screen.getByLabelText('store search').textContent).toBe('вод'))
    await waitFor(() => expect(screen.getByLabelText('location search').textContent).toBe('?search=%D0%B2%D0%BE%D0%B4'))
    fireEvent.click(screen.getByRole('button', { name: 'вода' }))
    await waitFor(() => expect(screen.getByLabelText('store search').textContent).toBe('вода'))
    await waitFor(() => expect(screen.getByLabelText('location search').textContent).toBe('?search=%D0%B2%D0%BE%D0%B4%D0%B0'))
  })
})
