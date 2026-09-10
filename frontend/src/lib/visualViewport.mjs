const KEYBOARD_THRESHOLD = 80

/**
 * Normalizes the two common mobile-keyboard behaviours:
 * Android usually resizes the layout viewport, while iOS may only resize the
 * visual viewport and overlay the keyboard over fixed content.
 */
export function getKeyboardViewport(layoutHeight, visualHeight, offsetTop, baselineHeight) {
  const visibleBottom = visualHeight + offsetTop
  const overlayInset = Math.max(0, layoutHeight - visibleBottom)
  const baselineOcclusion = Math.max(0, baselineHeight - visibleBottom)
  const keyboardOpen = Math.max(overlayInset, baselineOcclusion) > KEYBOARD_THRESHOLD

  return {
    keyboardOpen,
    bottomInset: keyboardOpen && overlayInset > KEYBOARD_THRESHOLD ? Math.round(overlayInset) : 0,
    maxHeight: Math.max(240, Math.floor(visualHeight - 8)),
  }
}
