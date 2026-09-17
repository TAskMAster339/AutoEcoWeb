import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

declare global {
  var notifyResizeObservers: (target: Element) => void
}

const observers = new Set<ImmediateResizeObserver>()

class ImmediateResizeObserver implements ResizeObserver {
  private readonly targets = new Set<Element>()

  constructor(private readonly callback: ResizeObserverCallback) {
    observers.add(this)
  }

  observe(target: Element) {
    this.targets.add(target)
  }

  unobserve(target: Element) {
    this.targets.delete(target)
  }

  disconnect() {
    this.targets.clear()
    observers.delete(this)
  }

  notify(target: Element) {
    if (!this.targets.has(target)) return
    const contentRect = target.getBoundingClientRect()
    this.callback([{
      target,
      contentRect,
      borderBoxSize: [{ inlineSize: contentRect.width, blockSize: contentRect.height }],
      contentBoxSize: [{ inlineSize: contentRect.width, blockSize: contentRect.height }],
      devicePixelContentBoxSize: [],
    }], this)
  }
}

globalThis.ResizeObserver = ImmediateResizeObserver
globalThis.notifyResizeObservers = (target) => {
  for (const observer of observers) observer.notify(target)
}

HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
  const index = this.dataset.index
  if (index !== undefined) {
    const height = Number(this.dataset.testHeight ?? 112)
    return new DOMRect(0, 0, 360, height)
  }
  if (this.tagName === 'MAIN') return new DOMRect(0, 0, 360, 400)
  if (this.getAttribute('role') === 'list') {
    const top = Number(this.dataset.testTop ?? 160)
    return new DOMRect(0, top - (this.parentElement?.scrollTop ?? 0), 360, 0)
  }
  return new DOMRect(0, 0, 360, 0)
}

afterEach(() => cleanup())
