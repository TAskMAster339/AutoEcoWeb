export const SWIPE_ACTION_WIDTH = 88

export function detectSwipeAxis(dx, dy, threshold = 7) {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return null
  return Math.abs(dx) > Math.abs(dy) * 1.15 ? 'horizontal' : 'vertical'
}

export function clampSwipeOffset(startOffset, dx) {
  return Math.max(-SWIPE_ACTION_WIDTH, Math.min(0, startOffset + dx))
}

export function settleSwipe(axis, offset, wasOpen) {
  if (axis !== 'horizontal') return wasOpen
  return offset < -(SWIPE_ACTION_WIDTH / 2)
}

export function swipeEditAction() {
  return { openSwipeId: null, shouldEdit: true }
}

export function nextOpenSwipeId(requestedId) {
  return requestedId
}

export function selectionRange(anchor, end) {
  const startIndex = Math.min(anchor, end)
  const endIndex = Math.max(anchor, end)
  return Array.from({ length: endIndex - startIndex + 1 }, (_, index) => startIndex + index)
}

export function hasActiveTableFilters(filters) {
  return Boolean(
    filters.search
    || filters.tagFilterIds.length
    || filters.storeFilters.length
    || filters.amountMin
    || filters.amountMax
    || filters.operationFilter !== 'all',
  )
}

export function matchesOptionSearch(label, query) {
  return label.toLocaleLowerCase('ru-RU').includes(query.trim().toLocaleLowerCase('ru-RU'))
}

export function replaceQuickEditTarget(_current, next) {
  return next
}

export function medianOf(values) {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2
}
