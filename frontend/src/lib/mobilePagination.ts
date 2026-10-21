export interface PageLike {
  items: readonly unknown[]
  total?: number | null
}

export interface FrameScheduler {
  schedule: () => void
  cancel: () => void
}

export function nextPageOffset(pages: readonly PageLike[]): number | undefined {
  if (pages.length === 0) return undefined
  const lastPage = pages[pages.length - 1]!
  const loaded = pages.reduce((total, page) => total + page.items.length, 0)
  const available = lastPage.total ?? loaded
  if (lastPage.items.length === 0 || loaded >= available) return undefined
  return loaded
}

export function isNearScrollEnd(
  scrollTop: number,
  clientHeight: number,
  scrollHeight: number,
  threshold = 320,
): boolean {
  return scrollHeight - Math.max(0, scrollTop) - clientHeight <= threshold
}

export function createFrameScheduler(
  callback: () => void,
  requestFrame: (callback: FrameRequestCallback) => number,
  cancelFrame: (handle: number) => void,
): FrameScheduler {
  let frame: number | null = null
  return {
    schedule() {
      if (frame !== null) return
      frame = requestFrame(() => {
        frame = null
        callback()
      })
    },
    cancel() {
      if (frame === null) return
      cancelFrame(frame)
      frame = null
    },
  }
}

export function createRequestGate<T>(task: () => Promise<T>): () => Promise<T> {
  let inFlight: Promise<T> | null = null
  return () => {
    if (inFlight !== null) return inFlight
    inFlight = Promise.resolve()
      .then(task)
      .finally(() => {
        inFlight = null
      })
    return inFlight
  }
}
