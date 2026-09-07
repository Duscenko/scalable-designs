import { describe, expect, it } from 'vitest'
import {
  MY_THEME_HARD_CAP,
  MY_THEME_RAIL_LIMIT,
  canAddMyTheme,
  isScaffoldTheme,
  myThemeKeys,
  figmaSyncThemeKeys,
  myThemeRoom,
  resolveListedTheme,
  visibleMyThemes,
} from '../themeLibrary'

describe('myThemeKeys', () => {
  it('drops the built-in light/dark scaffolding', () => {
    expect(myThemeKeys(['light', 'dark', 'core-copy'], { light: {}, dark: {}, 'core-copy': {} }))
      .toEqual(['core-copy'])
  })

  it('File & modes lists nothing when only scaffolding exists', () => {
    expect(figmaSyncThemeKeys(['light', 'dark'], { light: {}, dark: {} })).toEqual([])
  })
})

describe('resolveListedTheme', () => {
  const themes = { light: {}, dark: {}, 'swiss-copy': {} }
  const kinds = { light: 'light', dark: 'dark', 'swiss-copy': 'dark' }

  it('never lands on scaffolding dark when a My theme exists', () => {
    expect(isScaffoldTheme('dark')).toBe(true)
    expect(resolveListedTheme(['light', 'dark', 'swiss-copy'], themes, kinds, 'dark', 'dark'))
      .toBe('swiss-copy')
  })

  it('keeps a listed My theme', () => {
    expect(resolveListedTheme(['light', 'dark', 'swiss-copy'], themes, kinds, 'swiss-copy', 'dark'))
      .toBe('swiss-copy')
  })
})

describe('visibleMyThemes', () => {
  const keys = ['a', 'b', 'c', 'd', 'e', 'f', 'g']

  it('keeps themeOrder when the list fits the rail', () => {
    expect(visibleMyThemes(['a', 'b', 'c'], 'b')).toEqual(['a', 'b', 'c'])
  })

  it('shows the newest window when the preview is already in it', () => {
    expect(visibleMyThemes(keys, 'f', 5)).toEqual(['c', 'd', 'e', 'f', 'g'])
  })

  it('pins an older previewed theme and keeps the newest four', () => {
    expect(visibleMyThemes(keys, 'a', 5)).toEqual(['a', 'd', 'e', 'f', 'g'])
  })
})

describe('myThemeRoom', () => {
  it('warns at 8 and blocks at 12', () => {
    expect(myThemeRoom(7)).toBe('ok')
    expect(myThemeRoom(8)).toBe('warn')
    expect(myThemeRoom(MY_THEME_HARD_CAP)).toBe('full')
    expect(canAddMyTheme(MY_THEME_RAIL_LIMIT)).toBe(true)
    expect(canAddMyTheme(MY_THEME_HARD_CAP)).toBe(false)
  })
})
