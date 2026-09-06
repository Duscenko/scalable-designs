/**
 * Chrome neutrals, derived from the Categorical projection of the default
 * system. The workspace already speaks `bg-app` / `text-fg` / `border-line`
 * (~2,200 call sites); those classes resolve through ~15 variables in
 * `index.css`. This module is the ONE place that says which semantic role
 * each of those variables is.
 *
 * Regenerated into `chromeTheme.generated.css` by `scripts/gen-chrome-theme.ts`.
 * Never hand-edit the generated file; never invent a hex here.
 *
 * `--fg-faint` is deliberately absent. The system guarantees two readable
 * ink levels (`content.primary` / `content.secondary`). `content.subtle` is
 * a de-emphasis / watermark role (Lc ~21 in dark) and is not a third
 * readable tier. A `content.tertiary` role was measured and discarded: on
 * the dark ramp it collapses onto `content.secondary` for every seed (no
 * step between Lc 27 and Lc 75). Fixing that is a `buildScale` project,
 * not a chrome one. The hand-tuned `--fg-faint` stays in `index.css` as
 * decorative metadata ink — which is what it already is in practice.
 */

import { buildSystem } from './color/audit'
import {
  buildArchitectureView,
  type ProjectionInput,
} from './semanticArchitectures'

/** CSS custom property → Categorical role id (`group.key`). */
export const CHROME_ROLES = {
  '--app': 'surface.page',
  '--surface': 'surface.layer-1',
  '--elevated': 'surface.layer-2',
  '--line': 'border.subtle',
  '--line-strong': 'border.default',
  '--fg': 'content.primary',
  '--fg-muted': 'content.secondary',
} as const

export type ChromeVar = keyof typeof CHROME_ROLES
export type ChromeAppearance = 'light' | 'dark'

export type ChromeTheme = {
  vars: Record<ChromeAppearance, Record<string, string>>
  labels: Record<ChromeAppearance, Record<string, string>>
  total: number
}

export function resolveChromeTheme(accent: string): ChromeTheme {
  const system = buildSystem('chrome', accent, 'radix')
  const input: ProjectionInput = {
    themes: { light: {}, dark: {} },
    themeKinds: { light: 'light', dark: 'dark' },
    themePalettes: {},
    scales: system.scales,
    accent: system.accent,
    pageBackground: system.lightBg,
    darkBackground: system.darkBg,
  }
  const view = buildArchitectureView('categorical', input, system.errorSeed)
  if (!view) throw new Error('categorical projection returned null')

  const byId: Record<string, { light: string; dark: string; lightLabel: string; darkLabel: string }> = {}
  for (const category of view.categories) {
    for (const token of category.tokens) {
      const light = token.modes.light
      const dark = token.modes.dark
      if (!light || !dark) {
        throw new Error(`chrome role ${category.key}.${token.key} missing a mode`)
      }
      byId[`${category.key}.${token.key}`] = {
        light: light.css,
        dark: dark.css,
        lightLabel: light.label,
        darkLabel: dark.label,
      }
    }
  }

  const light: Record<string, string> = {}
  const dark: Record<string, string> = {}
  const lightLabels: Record<string, string> = {}
  const darkLabels: Record<string, string> = {}
  for (const [cssVar, role] of Object.entries(CHROME_ROLES)) {
    const resolved = byId[role]
    if (!resolved) throw new Error(`chrome role ${role} is not in the projection`)
    if (resolved.light === 'transparent' || resolved.dark === 'transparent') {
      throw new Error(`chrome role ${role} resolved transparent — pageBackground missing?`)
    }
    light[cssVar] = resolved.light
    dark[cssVar] = resolved.dark
    lightLabels[cssVar] = `${role} ← ${resolved.lightLabel}`
    darkLabels[cssVar] = `${role} ← ${resolved.darkLabel}`
  }
  // `--line-alpha` is the same structural hairline as `--line`. It used to
  // be the shared source both line roles aliased; they now resolve to
  // different tokens, so the alpha alias tracks the decorative rung.
  light['--line-alpha'] = light['--line']
  dark['--line-alpha'] = dark['--line']

  return { vars: { light, dark }, labels: { light: lightLabels, dark: darkLabels }, total: view.total }
}

const DECL_ORDER = [
  '--app',
  '--surface',
  '--elevated',
  '--fg',
  '--fg-muted',
  '--line-alpha',
  '--line',
  '--line-strong',
] as const

function block(selector: string, vars: Record<string, string>, labels: Record<string, string>): string {
  const lines = DECL_ORDER.map((name) => {
    const note = name === '--line-alpha' ? ' /* tracks --line */' : labels[name] ? ` /* ${labels[name]} */` : ''
    return `  ${name}: ${vars[name]};${note}`
  })
  return `${selector} {\n${lines.join('\n')}\n}`
}

/** Source of the committed `chromeTheme.generated.css`. */
export function renderChromeThemeCss(accent: string): string {
  const theme = resolveChromeTheme(accent)
  return `/**
 * GENERATED FILE — do not edit by hand.
 * Regenerate with \`npx tsx scripts/gen-chrome-theme.ts\`.
 *
 * Chrome page / surface / elevated / hairline / primary+muted ink, resolved
 * from the Categorical projection of the default system (accent ${accent},
 * radix). \`--fg-faint\` is not generated: it stays hand-tuned in index.css
 * as decorative metadata ink. See \`src/lib/chromeTheme.ts\`.
 */

${block(':root, .light', theme.vars.light, theme.labels.light)}

${block('.dark', theme.vars.dark, theme.labels.dark)}
`
}
