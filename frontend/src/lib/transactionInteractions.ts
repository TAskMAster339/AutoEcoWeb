import type { TransactionView } from '../api/types'

export const SWIPE_ACTION_WIDTH = 88

export type SwipeAxis = 'horizontal' | 'vertical' | null

export interface TableFilterState {
  search: string
  tagFilterIds: readonly string[]
  untaggedOnly: boolean
  storeFilters: readonly string[]
  amountMin: string
  amountMax: string
  operationFilter: 'all' | 'income' | 'expense'
}

export function detectSwipeAxis(dx: number, dy: number, threshold = 7): SwipeAxis {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return null
  return Math.abs(dx) > Math.abs(dy) * 1.15 ? 'horizontal' : 'vertical'
}

export function clampSwipeOffset(startOffset: number, dx: number): number {
  return Math.max(-SWIPE_ACTION_WIDTH, Math.min(0, startOffset + dx))
}

export function settleSwipe(axis: SwipeAxis, offset: number, wasOpen: boolean): boolean {
  if (axis !== 'horizontal') return wasOpen
  return offset < -(SWIPE_ACTION_WIDTH / 2)
}

export function swipeEditAction(): { openSwipeId: null; shouldEdit: true } {
  return { openSwipeId: null, shouldEdit: true }
}

export function nextOpenSwipeId(requestedId: string | null): string | null {
  return requestedId
}

export function selectionRange(anchor: number, end: number): number[] {
  const startIndex = Math.min(anchor, end)
  const endIndex = Math.max(anchor, end)
  return Array.from({ length: endIndex - startIndex + 1 }, (_, index) => startIndex + index)
}

export function hasActiveTableFilters(filters: TableFilterState): boolean {
  return Boolean(
    filters.search
    || filters.tagFilterIds.length
    || filters.untaggedOnly
    || filters.storeFilters.length
    || filters.amountMin
    || filters.amountMax
    || filters.operationFilter !== 'all',
  )
}

export function matchesOptionSearch(label: string, query: string): boolean {
  return label.toLocaleLowerCase('ru-RU').includes(query.trim().toLocaleLowerCase('ru-RU'))
}

export function replaceQuickEditTarget<T>(_current: T | null, next: T): T {
  return next
}

export function toggleSelectedId(selectedIds: readonly string[], id: string): string[] {
  return selectedIds.includes(id)
    ? selectedIds.filter((selectedId) => selectedId !== id)
    : [...selectedIds, id]
}

export function canStartMobileSelection(editorOpen: boolean, editorOpening: boolean): boolean {
  return !editorOpen && !editorOpening
}

/** Replaces one chronologically sorted row and keeps running balances accurate. */
export function replaceTransactionInPlace(
  rows: readonly TransactionView[],
  updatedView: TransactionView,
  preserveInheritedStore = false,
): TransactionView[] {
  const changedIndex = rows.findIndex((row) => row.id === updatedView.id)
  if (changedIndex < 0) return rows.slice()
  const previous = rows[changedIndex]!
  const previousSignedAmount = previous.income ?? -(previous.expense ?? 0)
  const updatedSignedAmount = updatedView.income ?? -(updatedView.expense ?? 0)
  const balanceDelta = updatedSignedAmount - previousSignedAmount

  return rows.map((row, index) => {
    if (index < changedIndex) return row
    if (index > changedIndex) {
      return balanceDelta === 0
        ? row
        : { ...row, balance: Math.round((row.balance + balanceDelta) * 100) / 100 }
    }
    return {
      ...updatedView,
      balance: Math.round((previous.balance + balanceDelta) * 100) / 100,
      ...(preserveInheritedStore ? {
        store: previous.store,
        sellerId: previous.sellerId,
        sellerNameSource: previous.sellerNameSource,
        sellerAliasName: previous.sellerAliasName,
      } : {}),
    }
  })
}

export function medianOf(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2
}
