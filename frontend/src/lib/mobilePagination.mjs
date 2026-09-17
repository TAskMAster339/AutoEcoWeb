export function nextPageOffset(pages) {
  if (pages.length === 0) return undefined
  const lastPage = pages[pages.length - 1]
  const loaded = pages.reduce((total, page) => total + page.items.length, 0)
  const available = lastPage.total ?? loaded
  if (lastPage.items.length === 0 || loaded >= available) return undefined
  return loaded
}

export function isNearScrollEnd(scrollTop, clientHeight, scrollHeight, threshold = 320) {
  return scrollHeight - Math.max(0, scrollTop) - clientHeight <= threshold
}

export function createFrameScheduler(callback, requestFrame, cancelFrame) {
  let frame = null
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

export function createRequestGate(task) {
  let inFlight = null
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
