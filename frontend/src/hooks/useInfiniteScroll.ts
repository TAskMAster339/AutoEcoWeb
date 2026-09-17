import { useEffect, useRef } from 'react'
import { createFrameScheduler, createRequestGate, isNearScrollEnd } from '../lib/mobilePagination.mjs'

interface InfiniteScrollOptions {
  container: HTMLElement | null
  enabled: boolean
  itemCount: number
  onLoadMore: () => Promise<unknown>
  threshold?: number
}

export function useInfiniteScroll({
  container,
  enabled,
  itemCount,
  onLoadMore,
  threshold = 320,
}: InfiniteScrollOptions): void {
  const enabledRef = useRef(enabled)
  const loadMoreRef = useRef(onLoadMore)
  const scheduleCheckRef = useRef<() => void>(() => undefined)

  enabledRef.current = enabled
  loadMoreRef.current = onLoadMore

  useEffect(() => {
    if (!container) return

    const requestNextPage = createRequestGate(() => loadMoreRef.current())
    const checkPosition = () => {
      if (!enabledRef.current) return
      if (!isNearScrollEnd(container.scrollTop, container.clientHeight, container.scrollHeight, threshold)) return
      void requestNextPage()
    }
    const scheduler = createFrameScheduler(
      checkPosition,
      window.requestAnimationFrame.bind(window),
      window.cancelAnimationFrame.bind(window),
    )
    scheduleCheckRef.current = scheduler.schedule
    container.addEventListener('scroll', scheduler.schedule, { passive: true })
    window.addEventListener('resize', scheduler.schedule, { passive: true })
    scheduler.schedule()

    return () => {
      container.removeEventListener('scroll', scheduler.schedule)
      window.removeEventListener('resize', scheduler.schedule)
      scheduler.cancel()
      scheduleCheckRef.current = () => undefined
    }
  }, [container, threshold])

  useEffect(() => {
    scheduleCheckRef.current()
  }, [enabled, itemCount])
}
