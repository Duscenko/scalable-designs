import { describe, expect, it } from 'vitest'
import {
  FIGMA_SYNC_MODE_CAP,
  clampFigmaSyncModes,
  defaultFigmaSyncModes,
  figmaSyncModeId,
  figmaSyncModeLabel,
  hasFigmaSyncMode,
  toggleFigmaSyncAppearance,
  toggleFigmaSyncTheme,
  uniqueThemesFromModes,
} from '../figmaSyncModes'

describe('figma sync modes', () => {
  it('defaults to nothing when My themes is empty', () => {
    expect(defaultFigmaSyncModes([], { light: 'light', dark: 'dark' })).toEqual([])
  })

  it('defaults to the first theme in both appearances', () => {
    expect(defaultFigmaSyncModes(['nature', 'core'], { nature: 'light' })).toEqual([
      { theme: 'nature', appearance: 'light' },
      { theme: 'nature', appearance: 'dark' },
    ])
    expect(defaultFigmaSyncModes(['neo'], { neo: 'dark' })).toEqual([
      { theme: 'neo', appearance: 'dark' },
      { theme: 'neo', appearance: 'light' },
    ])
  })

  it('caps at three modes and never empties the selection', () => {
    const three = [
      { theme: 'a', appearance: 'light' as const },
      { theme: 'a', appearance: 'dark' as const },
      { theme: 'b', appearance: 'light' as const },
    ]
    expect(clampFigmaSyncModes([...three, { theme: 'b', appearance: 'dark' }])).toHaveLength(FIGMA_SYNC_MODE_CAP)
    expect(toggleFigmaSyncAppearance(three, 'b', 'dark')).toEqual(three)
    expect(toggleFigmaSyncAppearance(
      [{ theme: 'a', appearance: 'light' }],
      'a',
      'light',
    )).toEqual([{ theme: 'a', appearance: 'light' }])
  })

  it('adds both appearances when a theme is toggled on', () => {
    const next = toggleFigmaSyncTheme(
      [{ theme: 'nature', appearance: 'light' }, { theme: 'nature', appearance: 'dark' }],
      'core',
      { core: 'light' },
    )
    expect(next).toEqual([
      { theme: 'nature', appearance: 'light' },
      { theme: 'nature', appearance: 'dark' },
      { theme: 'core', appearance: 'light' },
    ])
    expect(hasFigmaSyncMode(next, 'core', 'dark')).toBe(false)
  })

  it('names Figma columns from the theme plus Light/Dark', () => {
    expect(figmaSyncModeId({ theme: 'nature--organic', appearance: 'dark' })).toBe('nature--organic::dark')
    expect(figmaSyncModeLabel('Nature / Organic', 'dark')).toBe('Nature / Organic Dark')
    expect(uniqueThemesFromModes([
      { theme: 'nature', appearance: 'light' },
      { theme: 'nature', appearance: 'dark' },
      { theme: 'core', appearance: 'light' },
    ])).toEqual(['nature', 'core'])
  })
})
