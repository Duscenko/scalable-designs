/**
 * My themes — how many the rail shows, when to warn, when to stop minting.
 * A theme is a reading of primitives plus its own families; past a dozen the
 * editor and export get heavy. The rail is a switcher, not a file cabinet.
 */

export const MY_THEME_RAIL_LIMIT = 5
export const MY_THEME_SOFT_CAP = 8
export const MY_THEME_HARD_CAP = 12

export const MY_THEME_FULL_ERROR =
  'This system is at {count} themes. Delete one to add another.'

/** Built-in Light/Dark pair. They stay in the store; they are not My themes. */
export function isScaffoldTheme(key: string): boolean {
  return key === 'light' || key === 'dark'
}

/** Own keys only — never the built-in `light`/`dark` scaffolding. */
export function myThemeKeys(themeOrder: string[], themes: Record<string, unknown>): string[] {
  return themeOrder.filter((key) => !isScaffoldTheme(key) && Boolean(themes[key]))
}

/** File & modes / Figma publish list. Same as `myThemeKeys` on purpose —
 *  falling back to `themeOrder` (scaffold `light`/`dark`) painted a
 *  default-blue "Dark" row on an empty My themes. A try-on is not a theme. */
export const figmaSyncThemeKeys = myThemeKeys

/**
 * Theme the workspace / sync should treat as current. When My themes exist,
 * scaffolding `light`/`dark` are never chosen — they were minting leftover
 * `Dark Brand` / `Dark Neutral` ramps and becoming the Figma principal mode.
 */
export function resolveListedTheme(
  themeOrder: string[],
  themes: Record<string, unknown>,
  themeKinds: Record<string, string | undefined>,
  preferred: string | undefined,
  appearance: 'light' | 'dark',
): string {
  const own = myThemeKeys(themeOrder, themes)
  const pool = own.length ? own : themeOrder.filter((key) => Boolean(themes[key]))
  if (preferred && pool.includes(preferred)) return preferred
  return pool.find((key) => themeKinds[key] === appearance)
    ?? pool[pool.length - 1]
    ?? preferred
    ?? 'light'
}

export function canAddMyTheme(count: number): boolean {
  return count < MY_THEME_HARD_CAP
}

export function myThemeRoom(count: number): 'ok' | 'warn' | 'full' {
  if (count >= MY_THEME_HARD_CAP) return 'full'
  if (count >= MY_THEME_SOFT_CAP) return 'warn'
  return 'ok'
}

/**
 * Pin the previewed theme, then the newest in `themeOrder` (create appends).
 * Under the rail limit the list is unchanged so a short library doesn't jump.
 */
export function visibleMyThemes(
  keys: string[],
  previewed: string,
  limit = MY_THEME_RAIL_LIMIT,
): string[] {
  if (keys.length <= limit) return keys
  const newest = keys.slice(-limit)
  if (!keys.includes(previewed) || newest.includes(previewed)) return newest
  return [previewed, ...newest.slice(1)]
}
