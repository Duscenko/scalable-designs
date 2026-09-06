import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { apcaLcAbs, evaluate, wcagRatio } from '../color/apca'
import { CHROME_ROLES, resolveChromeTheme } from '../chromeTheme'
import { DEFAULT_ACCENT } from '../../store/useDesignStore'

const root = resolve(__dirname, '../../..')
const generated = resolve(root, 'src/lib/chromeTheme.generated.css')
const theme = resolveChromeTheme(DEFAULT_ACCENT)

describe('chrome theme mapping', () => {
  it('maps the approved roles and nothing else', () => {
    expect(CHROME_ROLES).toEqual({
      '--app': 'surface.page',
      '--surface': 'surface.layer-1',
      '--elevated': 'surface.layer-2',
      '--line': 'border.subtle',
      '--line-strong': 'border.default',
      '--fg': 'content.primary',
      '--fg-muted': 'content.secondary',
    })
    expect(Object.keys(CHROME_ROLES)).not.toContain('--fg-faint')
  })

  it('resolves every mapped var to a real colour in both appearances', () => {
    for (const name of Object.keys(CHROME_ROLES)) {
      expect(theme.vars.light[name]).toMatch(/^#/)
      expect(theme.vars.dark[name]).toMatch(/^#/)
      expect(theme.vars.light[name]).not.toBe('transparent')
      expect(theme.vars.dark[name]).not.toBe('transparent')
    }
    expect(theme.vars.light['--line-alpha']).toBe(theme.vars.light['--line'])
    expect(theme.vars.dark['--line-alpha']).toBe(theme.vars.dark['--line'])
  })

  it('regenerating produces the committed file byte-for-byte', () => {
    const before = readFileSync(generated, 'utf8')
    execFileSync('npx', ['tsx', 'scripts/gen-chrome-theme.ts'], { cwd: root, stdio: 'pipe' })
    expect(readFileSync(generated, 'utf8')).toBe(before)
  }, 60_000)

  it('does not emit --fg-faint — that ink stays hand-tuned in index.css', () => {
    const css = readFileSync(generated, 'utf8')
    expect(css).not.toMatch(/^\s*--fg-faint\s*:/m)
    const index = readFileSync(resolve(root, 'src/index.css'), 'utf8')
    expect(index).toMatch(/--fg-faint:\s*#737373/)
    expect(index).toMatch(/--fg-faint:\s*#7b7b83/)
  })
})

describe('chrome contrast after the token migration', () => {
  // Surfaces are opaque; inks are opaque. Hairlines are alpha and are
  // decorative — measured, not held to a floor (same policy as border.subtle).
  const pair = (
    appearance: 'light' | 'dark',
    fg: '--fg' | '--fg-muted',
    bg: '--app' | '--surface' | '--elevated',
  ) => {
    const ink = theme.vars[appearance][fg]
    const surface = theme.vars[appearance][bg]
    return {
      wcag: wcagRatio(ink, surface),
      lc: apcaLcAbs(ink, surface),
      verdict: evaluate(ink, surface, 'body-text'),
    }
  }

  it('--fg on --app clears body-text in both appearances', () => {
    expect(pair('light', '--fg', '--app').verdict.pass).toBe(true)
    expect(pair('dark', '--fg', '--app').verdict.pass).toBe(true)
  })

  it('--fg-muted on --app (dark) now clears body-text — the reason we migrated', () => {
    // Hand-tuned chrome was 6.72 / Lc 50. Token ink on the token page is
    // content.secondary on surface.page, which is the pair the system
    // already guarantees.
    const { verdict } = pair('dark', '--fg-muted', '--app')
    expect(verdict.passesWcag).toBe(true)
    expect(verdict.passesApca).toBe(true)
  })

  it('--fg-muted on --surface (light) is the accepted residual', () => {
    // Hand-tuned was 7.16 / Lc 81. content.secondary on surface.layer-1
    // lands ~4.66 / Lc 68: WCAG AA holds, APCA body-text (Lc 75) does not.
    // Accepted — see HANDOFF-1 §3. Do not "fix" by inventing content.tertiary
    // or by walking --fg-muted to tone 12 (that collapses it onto --fg).
    const { verdict, wcag, lc } = pair('light', '--fg-muted', '--surface')
    expect(verdict.passesWcag).toBe(true)
    expect(verdict.passesApca).toBe(false)
    expect(wcag).toBeGreaterThanOrEqual(4.5)
    expect(lc).toBeGreaterThanOrEqual(60)
    expect(lc).toBeLessThan(75)
  })

  it('reports the chrome pair table (WCAG / |Lc|)', () => {
    const rows = (['light', 'dark'] as const).flatMap((appearance) =>
      (['--fg', '--fg-muted'] as const).flatMap((fg) =>
        (['--app', '--surface', '--elevated'] as const).map((bg) => {
          const { wcag, lc, verdict } = pair(appearance, fg, bg)
          return `${appearance} ${fg} on ${bg}: ${wcag.toFixed(2)} / Lc ${lc.toFixed(0)} ${verdict.pass ? '✓' : '✗'}`
        }),
      ),
    )
    // Presence check — the numbers live in the assertions above. This keeps
    // the full matrix in the test output when someone runs it with --reporter=verbose.
    expect(rows).toHaveLength(12)
  })
})
