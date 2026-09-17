import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Box } from '@mui/material'
import { useVirtualizer } from '@tanstack/react-virtual'

interface Identifiable {
  id: string
}

interface VirtualizedTransactionListProps<T extends Identifiable> {
  items: T[]
  scrollContainer: HTMLElement | null
  renderItem: (item: T, index: number) => ReactNode
  estimatedItemHeight?: number
  gap?: number
  overscan?: number
}

/**
 * Variable-height virtual list for the mobile transaction feed. The list uses
 * the app shell's existing <main> element as its viewport, so the page keeps a
 * single native scroll surface on mobile.
 */
export function VirtualizedTransactionList<T extends Identifiable>({
  items,
  scrollContainer,
  renderItem,
  estimatedItemHeight = 112,
  gap = 10,
  overscan = 6,
}: VirtualizedTransactionListProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [scrollMargin, setScrollMargin] = useState(0)

  const measureScrollMargin = useCallback(() => {
    const container = containerRef.current
    if (!container || !scrollContainer) return

    const containerRect = container.getBoundingClientRect()
    const scrollRect = scrollContainer.getBoundingClientRect()
    const nextMargin = Math.max(0, containerRect.top - scrollRect.top + scrollContainer.scrollTop)
    setScrollMargin((current) => Math.abs(current - nextMargin) < 0.5 ? current : nextMargin)
  }, [scrollContainer])

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container || !scrollContainer) return

    let animationFrame = 0
    const scheduleMeasurement = () => {
      cancelAnimationFrame(animationFrame)
      animationFrame = requestAnimationFrame(measureScrollMargin)
    }

    measureScrollMargin()
    const resizeObserver = new ResizeObserver(scheduleMeasurement)
    resizeObserver.observe(scrollContainer)
    if (container.parentElement) resizeObserver.observe(container.parentElement)
    window.addEventListener('resize', scheduleMeasurement, { passive: true })

    return () => {
      cancelAnimationFrame(animationFrame)
      resizeObserver.disconnect()
      window.removeEventListener('resize', scheduleMeasurement)
    }
  }, [measureScrollMargin, scrollContainer])

  // Preceding mobile controls can appear or disappear without resizing the
  // scroll element itself. One layout read after such a React commit keeps the
  // virtualizer's origin aligned with the real list position.
  useLayoutEffect(measureScrollMargin)

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollContainer,
    estimateSize: () => estimatedItemHeight,
    getItemKey: (index) => items[index]?.id ?? index,
    gap,
    overscan,
    scrollMargin,
    useFlushSync: false,
  })
  const virtualRows = rowVirtualizer.getVirtualItems()
  const firstVirtualRow = virtualRows[0]
  const lastVirtualRow = virtualRows.at(-1)

  return (
    <Box
      ref={containerRef}
      role="list"
      aria-label="Транзакции"
      data-virtual-start={firstVirtualRow?.index ?? 0}
      data-virtual-end={lastVirtualRow ? lastVirtualRow.index + 1 : 0}
      data-virtual-scroll-margin={Math.round(scrollMargin)}
      sx={{
        position: 'relative',
        height: rowVirtualizer.getTotalSize(),
        minHeight: items.length ? estimatedItemHeight : 0,
      }}
    >
      {virtualRows.map((virtualRow) => {
        const item = items[virtualRow.index]
        if (!item) return null

        return (
          <Box
            key={virtualRow.key}
            ref={rowVirtualizer.measureElement}
            role="listitem"
            data-index={virtualRow.index}
            style={{ transform: `translateY(${virtualRow.start - scrollMargin}px)` }}
            sx={{
              position: 'absolute',
              insetInline: 0,
              top: 0,
              contain: 'layout paint style',
            }}
          >
            {renderItem(item, virtualRow.index)}
          </Box>
        )
      })}
    </Box>
  )
}
