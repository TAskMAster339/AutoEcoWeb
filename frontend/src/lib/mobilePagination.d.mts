export interface PageLike {
  items: readonly unknown[]
  total?: number | null
}

export function nextPageOffset(pages: readonly PageLike[]): number | undefined
export function isNearScrollEnd(
  scrollTop: number,
  clientHeight: number,
  scrollHeight: number,
  threshold?: number,
): boolean

export interface FrameScheduler {
  schedule: () => void
  cancel: () => void
}

export function createFrameScheduler(
  callback: () => void,
  requestFrame: (callback: FrameRequestCallback) => number,
  cancelFrame: (handle: number) => void,
): FrameScheduler

export function createRequestGate<T>(task: () => Promise<T>): () => Promise<T>
