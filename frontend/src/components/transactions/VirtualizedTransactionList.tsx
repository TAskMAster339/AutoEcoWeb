import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Box } from '@mui/material'

interface Identifiable {
  id: string
}

interface VirtualizedTransactionListProps<T extends Identifiable> {
  items: T[]
  renderItem: (item: T, index: number) => ReactNode
  estimatedItemHeight?: number
  gap?: number
  overscan?: number
}

/**
 * Lightweight variable-height virtual list for the mobile transaction feed.
 * It uses the existing scrolling <main> as its viewport and keeps only the
 * visible cards plus a small overscan mounted.
 */
export function VirtualizedTransactionList<T extends Identifiable>({
  items,
  renderItem,
  estimatedItemHeight = 112,
  gap = 10,
  overscan = 6,
}: VirtualizedTransactionListProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const listOriginRef = useRef<number | null>(null)
  const measuredHeightsRef = useRef(new Map<string, number>())
  const [measurementRevision, setMeasurementRevision] = useState(0)
  const [viewport, setViewport] = useState({ top: 0, height: 800 })

  const recordHeight = useCallback((itemId: string, height: number) => {
    if (measuredHeightsRef.current.get(itemId) === height) return
    measuredHeightsRef.current.set(itemId, height)
    setMeasurementRevision((revision) => revision + 1)
  }, [])

  const layout = useMemo(() => {
    const offsets: number[] = []
    let totalHeight = 0
    for (const item of items) {
      offsets.push(totalHeight)
      totalHeight += (measuredHeightsRef.current.get(item.id) ?? estimatedItemHeight) + gap
    }
    return { offsets, totalHeight: Math.max(0, totalHeight - gap) }
  }, [estimatedItemHeight, gap, items, measurementRevision])

  const commitViewport = useCallback((nextTop: number, nextHeight: number) => {
    // Overscan safely covers the small interval between updates, so a render
    // is needed only after half an estimated card rather than on every pixel.
    setViewport((current) => (
      Math.abs(current.top - nextTop) < estimatedItemHeight / 2 && current.height === nextHeight
        ? current
        : { top: nextTop, height: nextHeight }
    ))
  }, [estimatedItemHeight])

  const updateViewport = useCallback(() => {
    const scrollRoot = document.querySelector<HTMLElement>('main')
    if (!scrollRoot || listOriginRef.current === null) return
    const nextTop = Math.max(0, scrollRoot.scrollTop - listOriginRef.current)
    commitViewport(nextTop, scrollRoot.clientHeight)
  }, [commitViewport])

  const measureLayout = useCallback(() => {
    const container = containerRef.current
    const scrollRoot = document.querySelector<HTMLElement>('main')
    if (!container || !scrollRoot) return
    const containerRect = container.getBoundingClientRect()
    const rootRect = scrollRoot.getBoundingClientRect()
    listOriginRef.current = containerRect.top - rootRect.top + scrollRoot.scrollTop
    updateViewport()
  }, [updateViewport])

  useLayoutEffect(() => {
    const scrollRoot = document.querySelector<HTMLElement>('main')
    measureLayout()
    scrollRoot?.addEventListener('scroll', updateViewport, { passive: true })
    window.addEventListener('resize', measureLayout, { passive: true })
    const resizeObserver = new ResizeObserver(measureLayout)
    if (scrollRoot) resizeObserver.observe(scrollRoot)
    return () => {
      scrollRoot?.removeEventListener('scroll', updateViewport)
      window.removeEventListener('resize', measureLayout)
      resizeObserver.disconnect()
    }
  }, [measureLayout, updateViewport])

  // Also remeasure after parent layout changes (for example when the swipe
  // hint disappears). Scroll events themselves now avoid forced layout reads.
  useLayoutEffect(measureLayout)

  const visibleRange = useMemo(() => {
    if (items.length === 0) return { start: 0, end: 0 }
    const top = viewport.top
    const bottom = top + viewport.height
    let start = 0
    while (start < items.length - 1 && (layout.offsets[start + 1] ?? 0) < top) start += 1
    let end = start
    while (end < items.length && (layout.offsets[end] ?? 0) < bottom) end += 1
    return {
      start: Math.max(0, start - overscan),
      end: Math.min(items.length, end + overscan),
    }
  }, [items.length, layout.offsets, overscan, viewport])

  return (
    <Box
      ref={containerRef}
      role="list"
      aria-label="Транзакции"
      data-virtual-start={visibleRange.start}
      data-virtual-end={visibleRange.end}
      data-virtual-viewport-top={Math.round(viewport.top)}
      sx={{ position: 'relative', height: layout.totalHeight, minHeight: items.length ? estimatedItemHeight : 0 }}
    >
      {items.slice(visibleRange.start, visibleRange.end).map((item, localIndex) => {
        const index = visibleRange.start + localIndex
        return (
          <MeasuredItem
            key={item.id}
            itemId={item.id}
            top={layout.offsets[index] ?? 0}
            onHeight={recordHeight}
          >
            {renderItem(item, index)}
          </MeasuredItem>
        )
      })}
    </Box>
  )
}

function MeasuredItem({
  itemId,
  top,
  onHeight,
  children,
}: {
  itemId: string
  top: number
  onHeight: (itemId: string, height: number) => void
  children: ReactNode
}) {
  const itemRef = useRef<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    const element = itemRef.current
    if (!element) return
    onHeight(itemId, Math.ceil(element.offsetHeight))
    const observer = new ResizeObserver(([entry]) => {
      if (entry) onHeight(itemId, Math.ceil(entry.contentRect.height))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [itemId, onHeight])

  return (
    <Box
      ref={itemRef}
      role="listitem"
      sx={{ position: 'absolute', insetInline: 0, top, contain: 'layout paint style' }}
    >
      {children}
    </Box>
  )
}
