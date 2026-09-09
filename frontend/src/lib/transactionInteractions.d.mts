export const SWIPE_ACTION_WIDTH: number
export type SwipeAxis = 'horizontal' | 'vertical' | null
export function detectSwipeAxis(dx: number, dy: number, threshold?: number): SwipeAxis
export function clampSwipeOffset(startOffset: number, dx: number): number
export function settleSwipe(axis: SwipeAxis, offset: number, wasOpen: boolean): boolean
export function swipeEditAction(): { openSwipeId: null; shouldEdit: true }
export function nextOpenSwipeId(requestedId: string | null): string | null
export function selectionRange(anchor: number, end: number): number[]
export interface TableFilterState {
  search: string
  tagFilterIds: readonly string[]
  storeFilters: readonly string[]
  amountMin: string
  amountMax: string
  operationFilter: 'all' | 'income' | 'expense'
}
export function hasActiveTableFilters(filters: TableFilterState): boolean
export function matchesOptionSearch(label: string, query: string): boolean
export function replaceQuickEditTarget<T>(current: T | null, next: T): T
export function medianOf(values: readonly number[]): number | null
