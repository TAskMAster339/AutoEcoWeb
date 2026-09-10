export interface KeyboardViewport {
  keyboardOpen: boolean
  bottomInset: number
  maxHeight: number
}

export function getKeyboardViewport(
  layoutHeight: number,
  visualHeight: number,
  offsetTop: number,
  baselineHeight: number,
): KeyboardViewport
