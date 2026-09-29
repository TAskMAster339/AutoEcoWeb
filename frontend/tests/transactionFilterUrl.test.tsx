import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
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
      <button onClick={() => navigate(-1)}>back</button>
    </>
  )
}

describe('transaction filter URL contract', () => {
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
})
