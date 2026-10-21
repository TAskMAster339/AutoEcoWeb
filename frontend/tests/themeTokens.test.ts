import { describe, expect, it } from 'vitest'
import { buildTheme, chartColors } from '../src/theme'

describe('semantic theme tokens', () => {
  it('provides mode-aware surfaces for shared UI states', () => {
    const light = buildTheme('light')
    const dark = buildTheme('dark')

    expect(light.semantic.grid.background).not.toBe(dark.semantic.grid.background)
    expect(light.semantic.navigation.hover).not.toBe(dark.semantic.navigation.hover)
    expect(light.semantic.feedback.error).not.toBe(dark.semantic.feedback.error)
    expect(light.semantic.chart.empty).not.toBe(dark.semantic.chart.empty)
  })

  it('keeps deterministic chart palettes outside component modules', () => {
    expect(chartColors.weekday).toHaveLength(7)
    expect(chartColors.stores).toHaveLength(10)
    expect(chartColors.other).toMatch(/^#[0-9A-F]{6}$/i)
  })
})
