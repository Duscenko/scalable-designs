// Primary Color — the Color hub's "Primitives" tab: a Figma-style families
// table (Accent · Neutral · State · custom families) listing every tone as a
// token row with editable light/dark values, eye toggles on the theme
// columns and a per-row picker. The family nav on the left doubles as the
// promoted DEFINE surface Picker Color used to own — a quick-edit strip under
// the column header (hex field, scale, algorithm settings) edits
// whichever family is active, so palette definition and usage now live on one
// screen. The nav groups families under a THEME folder (see BASE_FOLDER). A
// "+ New theme" CTA below the folder list opens the SAME `ThemePanel`
// Semantics' "+ Theme" mints from — adding a theme creates the primitive
// families it reads, which is a Primitives concern too, not only Semantics'. Token
// names in the table are the EXACT exported names
// (tokenGenerator's flattenScale prefixes: accent/neutral/error/success/
// warning/info/<slug>), so the table, the semantic sources and tokens.json
// never disagree.

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useDesignStore, makeDesignDefaults, type ThemeSources } from '../../store/useDesignStore'
import type { ColorScale } from '../../types/tokens'
import {
  NAMING_SCHEMES, BASE_TONE, generateColorScale, generateAlphaScale,
  generateDarkColorScale, generateFamilyDarkScale, backgroundFromBase,
  neutralFromBrand, recommendStateColors, checkContrast, accessibleSolidTone, readableInk,
  BLACK_ALPHA_SCALE, WHITE_ALPHA_SCALE,
} from '../../lib/colorUtils'
import {
  useApplyAccentColor, useApplyGrayColor, useApplyStateColor, useEnsureColorScales,
  resolveThemePages, resolveFamilyPages,
} from '../../lib/colorActions'
import {
  SWATCH, CHECKER, ScaleRow, usePopoverPlacement, TokenDetailsModal, DeleteThemeModal,
  curatedPaletteFor, COLOR_RAIL_WIDTH, COLOR_RAIL_COLLAPSED_WIDTH, COLLAPSED_RAIL_WELL,
} from './colorControls'
import { ColorPickerPanel } from '../ui/ColorField'
import { ColorAgentButton } from '../ui/shimmer-button'
import { SlidersIcon, SparkleCircleIcon, PaletteIcon } from '../ui/icons'
import { themesUsingFamily, FAMILY_SLOTS, GLOBAL_FAMILY, familySlotFor, type FamilySlot } from '../../lib/themeSources'
import { ColorControls, ScaleSettingsModal } from './Step2_ColorPalette'
import ThemePanel from './ThemePanel'
import VariableCollectionRail, { FolderIcon } from './VariableCollectionRail'
import { buildFamilyExport, buildAlphaFamilyExport, ALPHA_EXPORT_FORMATS, FAMILY_FORMAT_OPTIONS, type WizardFormat, type WizardFile } from '../../lib/exportWizard'
import { appearanceOrder, type ThemeAppearance } from '../../lib/themeModes'
import { THEME_LIBRARY_WIDTH } from './themeWorkspaceLayout'
import { TOP_NAV_H } from './TopNav'
import { TABLE_HEADER_PX, tableHeaderClass, tableRowClass } from './tableChrome'

// ── Family groups ───────────────────────────────────────────────────────────
// The second nav level, inside each theme folder. Which group a family lands
// in is DERIVED from `themeSources` — a custom family reads as "Accents"
// precisely because its theme's `brand` slot points at it (see `homeOf`).
//
// There is no "+ Add family" control here: minting a single family meant also
// deciding which theme slot should reference it (or inventing a theme to hold
// it), which was too much flow for a nav header. Families are created as a
// side effect of adding a THEME — the "+ New theme" CTA at the bottom of this
// nav (and Semantics' "+ Theme"), which asks for the accent/neutral/status
// colours it needs and files the families it mints under that theme's folder
// automatically.
export const FAMILY_GROUPS = ['Accents', 'Neutrals', 'States', 'Custom'] as const
export type FamilyGroup = (typeof FAMILY_GROUPS)[number]

/** The family-edit drawer docks exactly like `ThemePanel` — these mirror its
 *  private `PANEL_W` (360) and `SHELL_ROWS` (`TOP_NAV_H` + 52px toolbar), used
 *  only as the width cap and the top fallback when the family `<nav>` hasn't
 *  been measured yet. */
const DOCK_W = 360
const DOCK_TOP_FALLBACK = TOP_NAV_H + 52
/** Bottom inset — clears the shell's 28px attribution footer (`h-7`) plus the
 *  same 8px breathing gap the panel keeps everywhere else, so the drawer stops
 *  ABOVE the "Built by…" line instead of overlapping it. `ThemePanel` uses the
 *  identical value. */
const DOCK_BOTTOM = 28 + 8

// ── Small icons (mirroring the Alias table's visual language) ────────────────

function EyeIcon({ active }: { active: boolean }) {
  return active ? (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19M6.61 6.61A13.53 13.53 0 0 0 2 12s3.5 8 10 8a9.74 9.74 0 0 0 5.39-1.61M2 2l20 20" />
    </svg>
  )
}

// ── Radix role bands — which tones (1-12) serve which purpose. Shown once at
// the bottom of the families table after the token rows; the Color Agent already
// knows these groupings, so repeating them as row captions added noise. ───────
const TONE_BANDS: { max: number; label: string }[] = [
  { max: 2, label: 'Backgrounds' },
  { max: 5, label: 'Interactive components' },
  { max: 8, label: 'Borders' },
  { max: 10, label: 'Solid colors' },
  { max: 12, label: 'Accessible text' },
]

// What a step is FOR — mirrored in the table footer and the Token Details dialog.
const TONE_DESCRIPTIONS: { max: number; text: string }[] = [
  { max: 2,  text: 'App background. Step 1 is the page itself; step 2 is a subtle surface on top of it.' },
  { max: 5,  text: 'Interactive component fills — 3 at rest, 4 on hover, 5 while active.' },
  { max: 8,  text: 'Borders — 6 subtle, 7 the default, 8 on hover or focus.' },
  { max: 10, text: 'Solid fills. Step 9 is the anchor — the family’s own colour, verbatim — and 10 is its hover.' },
  { max: 12, text: 'Accessible text on the page — 11 clears WCAG AA (≈4.5:1), 12 is the high-contrast step.' },
]

function toneDescription(tone: number): string {
  return TONE_DESCRIPTIONS.find((b) => tone <= b.max)?.text ?? ''
}

function toneRangeLabel(max: number, index: number): string {
  const min = index === 0 ? 1 : TONE_BANDS[index - 1].max + 1
  return min === max ? `${min}` : `${min}–${max}`
}

/** WCAG badge — AA/AAA for text pairs, LG when only large text passes. */
function WcagBadge({ fg, bg }: { fg: string; bg: string }) {
  const r = checkContrast(fg, bg)
  const cls =
    r >= 4.5
      ? 'text-status-success bg-status-success/10'
      : r >= 3
      ? 'text-status-warning bg-status-warning/10'
      : 'text-status-danger bg-status-danger/10'
  const tag = r >= 7 ? 'AAA' : r >= 4.5 ? 'AA' : r >= 3 ? 'LG' : '✕'
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-mono text-mini font-semibold tabular-nums ${cls}`}>
      {r.toFixed(2)}:1 {tag}
    </span>
  )
}

function WcagPairChip({ label, fg, bg }: { label: string; fg: string; bg: string }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <span
        className="w-9 h-7 rounded-md flex items-center justify-center text-body font-semibold flex-shrink-0 ring-1 ring-black/10 dark:ring-white/10"
        style={{ backgroundColor: bg, color: fg }}
        aria-hidden
      >
        Aa
      </span>
      <span className="flex flex-col min-w-0 gap-0.5">
        <span className="font-mono text-mini text-fg-muted truncate" title={label}>{label}</span>
        <WcagBadge fg={fg} bg={bg} />
      </span>
    </div>
  )
}

/** Which groups render as full-height rows; the rest go `compact`. Accents and
 *  Neutrals are the two a designer actually reads tone by tone, and that split
 *  is what the board already did when it hardcoded `core` vs `states`. */
const OVERVIEW_FULL_GROUPS: readonly FamilyGroup[] = ['Accents', 'Neutrals']

/** Neutral-family picker — global neutral OR any custom family slotted as gray. */
function familyUsesNeutralPicker(
  f: Family,
  homeOf: (family: Family) => { folder: string; group: FamilyGroup },
): boolean {
  if (f.isAlpha) return false
  if (f.key === 'neutral') return true
  return homeOf(f).group === 'Neutrals'
}

/** Accent-family picker — global accent OR any custom family slotted as brand. */
function familyUsesAccentPicker(
  f: Family,
  homeOf: (family: Family) => { folder: string; group: FamilyGroup },
): boolean {
  if (f.isAlpha) return false
  if (f.key === 'accent') return true
  return homeOf(f).group === 'Accents'
}

/** The gray primitive the previewed theme reads — same target as Theme Preview. */
function isPreviewThemeGrayFamily(
  f: Family,
  previewTheme: string,
  themeSources: Record<string, { gray?: string } | undefined>,
): boolean {
  const grayKey = themeSources[previewTheme]?.gray ?? 'neutral'
  if (f.key === 'neutral') return grayKey === 'neutral'
  return f.customKey === grayKey
}

function curatedPaletteKeyForFamily(
  f: Family,
  themeSources: Record<string, ThemeSources>,
): string {
  if (f.key === 'neutral' || f.key === 'accent') return f.key
  const custKey = f.customKey
  if (!custKey) return f.key
  const slot = familySlotFor(custKey, themeSources)
  if (slot === 'gray') return 'neutral'
  if (slot === 'brand') return 'accent'
  if (slot) return slot
  return f.key
}

// Mid interactive step — unmistakably translucent in nav/overview swatches.
const ALPHA_NAV_TONE = 5

function overviewScale(family: Family, appearance: 'light' | 'dark') {
  if (family.isAlpha) {
    return appearance === 'light'
      ? (family.solidLight ?? family.light)
      : (family.solidDark ?? family.dark)
  }
  return appearance === 'light' ? family.light : family.dark
}

function OverviewSwatch({ family }: { family: Family }) {
  if (family.isAlpha) {
    const value = family.light[ALPHA_NAV_TONE] ?? family.base
    return (
      // `light` — this chip reads the LIGHT ramp, so its damero has to stand in
      // for the light page or the two disagree (see ScaleRow's checkerAppearance).
      <span
        className={`${SWATCH} relative overflow-hidden flex-shrink-0 light`}
        style={{ ...CHECKER, backgroundSize: '5px 5px' }}
        aria-hidden
      >
        <span className="absolute inset-0" style={{ backgroundColor: value }} />
      </span>
    )
  }
  return <span className={`${SWATCH} flex-shrink-0`} style={{ backgroundColor: family.base }} aria-hidden />
}

// Overview footer — one chrome recipe so borders never stack two grays.
const overviewPanel = 'rounded-xl border border-line bg-surface overflow-hidden'
const overviewDivide = 'divide-y divide-line'

/** Same column tracks as the tone table + sticky header — overview ramps must
 *  use this or the light/dark headers drift over the swatches when scrolling. */
const PRIMITIVE_TABLE_GRID: CSSProperties = {
  gridTemplateColumns: 'minmax(12rem,1.15fr) repeat(2, minmax(10rem,1fr)) 2.75rem',
}

/** Quick-edit strip: Color Agent is `size-icon` (36px). Hex + ramp match that,
 *  with 12px padding above/below so the row isn't flush to the chrome. */
const STRIP_CONTROL_HEIGHT = 36
const QUICK_EDIT_STRIP_PAD = 12
const QUICK_EDIT_STRIP_HEIGHT = STRIP_CONTROL_HEIGHT + QUICK_EDIT_STRIP_PAD * 2

// The tone table's column header is the 52px band that lines up with
// “Color variables” in the rail — same row as Radius's TOKEN NAME. The
// quick-edit strip sits UNDER it, not above: putting the strip first is
// what used to drop TOKEN NAME 60px below the title.

function RampPreviewBlock({
  family,
  namingLabels,
  active,
  compact = false,
  embedded = false,
}: {
  family: Family
  namingLabels: string[]
  active?: boolean
  compact?: boolean
  /** Inside the shared ramp panel — no nested border/background. */
  embedded?: boolean
}) {
  const light = family.isAlpha ? family.light : overviewScale(family, 'light')
  const dark = family.isAlpha ? family.dark : overviewScale(family, 'dark')
  const rowProps = {
    labels: namingLabels,
    joined: true as const,
    numbersInside: true as const,
    showNumbers: false as const,
    size: compact ? ('thin' as const) : ('default' as const),
    checkerboard: family.isAlpha,
  }

  const rampCell = 'flex items-center px-2.5 py-1.5 border-r border-line min-w-0'

  return (
    <div
      className={`grid items-stretch transition-colors ${
        embedded ? '' : `${overviewPanel} p-4`
      } ${active ? 'bg-accent-ui/[0.06]' : ''}`}
      style={PRIMITIVE_TABLE_GRID}
    >
      <div className="flex items-center gap-2 py-2.5 pl-4 pr-3 min-w-0 border-r border-line">
        <OverviewSwatch family={family} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-ui font-semibold text-fg truncate">{family.label}</span>
            {active ? (
              <span className="text-micro font-semibold uppercase tracking-widest text-accent-ui flex-shrink-0">Editing</span>
            ) : null}
          </div>
          {family.isAlpha ? (
            <p className="text-mini text-fg-faint mt-0.5">Translucent ramp · checkerboard shows alpha</p>
          ) : (
            <p className="text-mini font-mono text-fg-faint mt-0.5 truncate">{family.base.toUpperCase()}</p>
          )}
        </div>
      </div>
      <div className={rampCell}>
        <ScaleRow scale={light} ariaLabel={`${family.label} light scale`} {...rowProps} checkerAppearance="light" />
      </div>
      <div className={rampCell}>
        <ScaleRow scale={dark} ariaLabel={`${family.label} dark scale`} {...rowProps} checkerAppearance="dark" />
      </div>
      <span className="flex items-center justify-center text-fg-faint/40" aria-hidden>
        <SlidersIcon />
      </span>
    </div>
  )
}

/** Scroll tail — scale roles, full system ramp board, WCAG pairs for accent. */
function FamilyRampOverview({
  groups,
  activeKey,
  namingLabels,
}: {
  /** The SAME `{ label, items }` groups the family nav renders — not a second
   *  enumeration of family keys. The board used to hardcode
   *  `['accent','accent-alpha','neutral']` + the four solid states, which broke
   *  twice over: every alpha twin but Accent's was missing (`neutral-a`,
   *  `black-a`/`white-a`, all four `*-a` statuses), and in the Themes workspace
   *  the hardcoded GLOBAL keys resolve to nothing at all for a theme whose
   *  slots point at custom families (`core-copy-error`, …) — so the board went
   *  nearly empty exactly where the theme's own ramps live. Deriving it from
   *  the nav's groups means the board and the rail can't disagree about which
   *  ramps this system has. */
  groups: { label: FamilyGroup; items: Family[] }[]
  activeKey: string
  namingLabels: string[]
}) {
  const inGroup = (label: FamilyGroup) => groups.find((g) => g.label === label)?.items ?? []
  // The WCAG pairs need A representative accent and neutral, whatever they're
  // called — `byKey('accent')` found nothing once a theme's brand was a custom
  // family. First solid of each group is that theme's own.
  const accent = inGroup('Accents').find((f) => !f.isAlpha)
  const neutral = inGroup('Neutrals').find((f) => !f.isAlpha)

  const accentLight = accent ? overviewScale(accent, 'light') : null
  const accentDark = accent ? overviewScale(accent, 'dark') : null
  const neutralLight = neutral ? overviewScale(neutral, 'light') : null
  const neutralDark = neutral ? overviewScale(neutral, 'dark') : null

  const solidLight = accentLight ? (accentLight[accessibleSolidTone(accentLight)] ?? accent!.base) : '#000'
  const solidDark = accentDark ? (accentDark[accessibleSolidTone(accentDark)] ?? accent!.base) : '#000'

  return (
    <section className="border-t border-line bg-app">
      <div className="px-4 py-6">
        <h3 className="text-mini font-semibold uppercase tracking-widest text-fg-faint mb-1">Scale guide</h3>
        <p className="text-caption text-fg-faint mb-3">Radix 1–12 — same meaning in every family below.</p>
        <ul className="flex flex-col gap-2.5">
          {TONE_BANDS.map((band, i) => (
            <li key={band.max} className="flex gap-3 min-w-0">
              <span className="w-9 flex-shrink-0 font-mono text-caption tabular-nums text-fg-faint pt-px">
                {toneRangeLabel(band.max, i)}
              </span>
              <span className="text-body leading-snug text-fg-muted min-w-0">
                <span className="font-medium text-fg">{band.label}</span>
                {' — '}
                {TONE_DESCRIPTIONS.find((d) => d.max === band.max)?.text}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t border-line">
        <div className="px-4 pt-6 pb-3">
          <h3 className="text-mini font-semibold uppercase tracking-widest text-fg-faint">System ramps</h3>
          <p className="text-caption text-fg-faint mt-1">Every ramp — each solid beside its alpha twin, plus the fixed black/white ladders. Light and dark.</p>
        </div>
        <div className={`border-t border-line ${overviewDivide}`}>
          {groups.map((group) => {
            const alphaCount = group.items.filter((f) => f.isAlpha).length
            return (
              <div key={group.label} className={overviewDivide}>
                <div className="grid items-center bg-elevated/20" style={PRIMITIVE_TABLE_GRID}>
                  <div className="col-span-4 px-4 py-2.5">
                    <span className="text-mini font-semibold uppercase tracking-widest text-fg-faint">{group.label}</span>
                    <p className="text-mini text-fg-faint mt-0.5">
                      {group.items.filter((f) => !f.isAlpha).map((f) => f.label).join(' · ') || '—'}
                      {alphaCount > 0 && ` · ${alphaCount} alpha ${alphaCount === 1 ? 'ramp' : 'ramps'}`}
                    </p>
                  </div>
                </div>
                {group.items.map((f) => (
                  <RampPreviewBlock
                    key={f.key}
                    embedded
                    compact={!OVERVIEW_FULL_GROUPS.includes(group.label)}
                    family={f}
                    namingLabels={namingLabels}
                    active={f.key === activeKey}
                  />
                ))}
              </div>
            )
          })}
        </div>
      </div>

      {accentLight && accentDark ? (
        <div className="border-t border-line px-4 py-6 flex flex-col gap-3">
          <h3 className="text-mini font-semibold uppercase tracking-widest text-fg-faint">WCAG contrast</h3>
          <p className="text-caption text-fg-faint">Live pairs from accent and neutral ramps.</p>
          <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
            <WcagPairChip label="Accent text · light" fg={accentLight[12] ?? '#000'} bg={accentLight[1] ?? '#fff'} />
            <WcagPairChip label="Accent text · dark" fg={accentDark[12] ?? '#fff'} bg={accentDark[1] ?? '#000'} />
            <WcagPairChip label="Accent ink · solid light" fg={readableInk(solidLight)} bg={solidLight} />
            <WcagPairChip label="Accent ink · solid dark" fg={readableInk(solidDark)} bg={solidDark} />
            {neutralLight && neutralDark ? (
              <>
                <WcagPairChip label="Neutral text · light" fg={neutralLight[12] ?? '#000'} bg={neutralLight[1] ?? '#fff'} />
                <WcagPairChip label="Neutral text · dark" fg={neutralDark[12] ?? '#fff'} bg={neutralDark[1] ?? '#000'} />
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}

// The alpha tone the family NAV previews. Not the anchor (step 9 composites to
// a near-opaque overlay, so it reads as a plain solid chip and defeats the
// point); a mid interactive step is unmistakably translucent while still
// carrying the family's hue.
function FamilySwatch({ family, dark, onClick }: {
  family: Family
  dark: boolean
  /** Same "the colour chip itself opens the picker" rule as the quick-edit
   *  strip's `HexCell` swatch — a chip that looks clickable and only the
   *  neighbouring pencil actually works reads as broken, and most people reach
   *  for the colour first. Omitted for alpha families: nothing to edit (an
   *  alpha ramp is derived, see AlphaHexCell), so the chip stays a plain
   *  swatch there, same as the pencil already being withheld for them. */
  onClick?: () => void
}) {
  if (!family.isAlpha) {
    return onClick ? (
      <button
        type="button"
        onClick={onClick}
        aria-haspopup="dialog"
        aria-label={`Edit ${family.label} color`}
        title={`Edit ${family.label} — ${family.base}`}
        className={`${SWATCH} flex-shrink-0 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg`}
        style={{ backgroundColor: family.base }}
      />
    ) : (
      <span className={SWATCH} style={{ backgroundColor: family.base }} />
    )
  }
  const value = (dark ? family.dark : family.light)[ALPHA_NAV_TONE] ?? family.base
  return (
    // The damero follows the ramp this chip is reading, not the chrome — see
    // ScaleRow's `checkerAppearance`. Without it White Alpha's nav chip is a
    // white wash on a near-white checker whenever the app is in light chrome.
    <span
      className={`${SWATCH} relative overflow-hidden ${dark ? 'dark' : 'light'}`}
      style={{ ...CHECKER, backgroundSize: '5px 5px' }}
      title={`${family.label} — a translucent ramp (${value})`}
    >
      <span className="absolute inset-0" style={{ backgroundColor: value }} />
    </span>
  )
}


// ── Per-column quick export ─────────────────────────────────────────────────
// The icon sits in the light and dark column headers, so what it exports is
// unambiguous: THIS family, THIS appearance. Picking a format copies the
// result to the clipboard — the glyph is the app's copy/export mark and the
// whole point is pasting one ramp into code or an AI prompt; the guided
// wizard (Export pill) is still the way to get files on disk.
//
// It is NOT a second exporter: `buildFamilyExport` assembles a normal
// WizardSelection and runs it through `buildWizardExport`, so this output is
// byte-identical to running the wizard scoped the same way.
// 304 fit one label + one trailing icon. Copy moved from "click the label" to
// its own icon (matching download instead of hiding behind a whole-row click
// no one could see was clickable) needs a second w-10 cell + divider — widened
// to keep the label from truncating under two dedicated action columns.
const EXPORT_MENU_W = 420

// This popover's own shorthand for the format list — NOT a rename of
// `FAMILY_FORMAT_OPTIONS` itself. The wizard now speaks in destinations
// (Figma / Code / AI); this compact menu still names file formats because a
// single Accent ramp is a file, not a place. `badge` mirrors Escala JSON's
// "Figma plugin" pill: W3C's flat $value/$type tree is what Figma's OWN
// "Import variables" accepts with no plugin in the loop.
const MENU_FORMAT_LABEL: Partial<Record<WizardFormat, string>> = { w3c: 'W3C Design' }
const MENU_FORMAT_BADGE: Partial<Record<WizardFormat, string>> = { w3c: 'Figma native', escala: 'Figma plugin' }

function ColumnExportMenu({ family, label, appearance, isAlpha, scale }: {
  family: string
  label: string
  appearance: 'light' | 'dark'
  /** Routes through `buildAlphaFamilyExport` (reads `colors.primitiveAlpha`)
   *  instead of the solid-primitive pipeline, and narrows the offered formats
   *  to `ALPHA_EXPORT_FORMATS` — Tailwind/Markdown have no alpha concept in
   *  `sectionExport` and would silently export nothing or the solid twin. */
  isAlpha?: boolean
  /** The actual alpha hex map for THIS column — `buildAlphaFamilyExport` can't
   *  re-derive it, since alpha values are solved against a page (see
   *  `alphaColorOver`) and aren't stored anywhere the export pipeline reads
   *  from independently. Ignored when `isAlpha` is false. */
  scale?: Record<number, string>
}) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState<WizardFormat | null>(null)
  const [downloaded, setDownloaded] = useState<WizardFormat | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const place = usePopoverPlacement(ref, open)

  // The header lives inside the table's `overflow-auto` column, so an
  // absolutely-positioned panel is CLIPPED at that container's bottom edge
  // (measured: a ~340px menu overflows on any normal window height). Same
  // problem — and same fix — as the family picker below: portal it to <body>
  // and position `fixed` off the button's measured rect, re-measured on scroll
  // (capture, so the table's own scroll counts) and resize.
  const [rect, setRect] = useState<DOMRect | null>(null)
  useEffect(() => {
    if (!open) { setRect(null); return }
    const measure = () => { const r = ref.current?.getBoundingClientRect(); if (r) setRect(r) }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => { window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true) }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      const t = e.target as Node
      if (ref.current?.contains(t) || panelRef.current?.contains(t)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  // One call site for "give me this format's files", branching to whichever
  // builder actually knows how to read this family's values — the split
  // exists at the DATA layer (see `buildAlphaFamilyExport`'s own comment for
  // why), not duplicated here in `copy`/`downloadOne`.
  const buildFiles = (format: WizardFormat): WizardFile[] =>
    isAlpha && scale ? buildAlphaFamilyExport(family, scale, format) : buildFamilyExport(family, appearance, format)

  function copy(format: WizardFormat) {
    const files = buildFiles(format)
    navigator.clipboard.writeText(
      files.map((f) => (files.length > 1 ? `/* ${f.name} */\n${f.content}` : f.content)).join('\n\n'),
    )
    setCopied(format)
    setTimeout(() => { setCopied(null); setOpen(false) }, 900)
  }

  // Same `buildFiles` call as `copy` — a download is the identical scoped
  // output, just saved instead of put on the clipboard, so the two can never
  // disagree about what "this format, this ramp" means. Doesn't close the
  // popover (unlike `copy`): downloading is the slower action of the two, and
  // someone comparing formats will likely want a second one right after —
  // closing on them would undo the point of leaving it open.
  function downloadOne(format: WizardFormat) {
    const files = buildFiles(format)
    for (const f of files) {
      const mime = f.name.endsWith('.json') ? 'application/json' : f.name.endsWith('.css') || f.name.endsWith('.scss') ? 'text/css' : 'text/plain'
      const url = URL.createObjectURL(new Blob([f.content], { type: mime }))
      const a = document.createElement('a')
      a.href = url
      a.download = f.name
      a.click()
      URL.revokeObjectURL(url)
    }
    setDownloaded(format)
    setTimeout(() => setDownloaded(null), 900)
  }

  const panel = open && rect
    ? createPortal(
        <AnimatePresence>
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            // `dialog`, not `menu` — a menu's children must be menuitems, and
            // each row is now a `group` of two independent buttons (copy,
            // download) rather than one activatable item.
            role="dialog"
            aria-label={`Export ${label} — ${appearance}`}
            style={{
              position: 'fixed',
              // Right-aligned to the icon, clamped so a column near either
              // viewport edge still shows the whole panel.
              left: Math.min(Math.max(8, rect.right - EXPORT_MENU_W), window.innerWidth - EXPORT_MENU_W - 8),
              ...(place.up ? { bottom: window.innerHeight - rect.top + 8 } : { top: rect.bottom + 8 }),
              maxHeight: place.max,
              width: EXPORT_MENU_W,
            }}
            className="z-50 rounded-2xl border border-line bg-app shadow-xl flex flex-col overflow-hidden normal-case tracking-normal"
          >
            <div className="flex items-baseline justify-between gap-2 px-4 pt-3 pb-2 flex-shrink-0">
              <span className="text-mini font-semibold uppercase tracking-widest text-fg-faint">Format</span>
              <span className="text-caption font-normal text-fg-faint truncate">{label} · {appearance}</span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-3 pb-3 flex flex-col gap-1.5">
                  {(isAlpha
                    ? FAMILY_FORMAT_OPTIONS.filter((f) => ALPHA_EXPORT_FORMATS.includes(f.key))
                    : FAMILY_FORMAT_OPTIONS
                  ).map((f) => {
                const copyDone = copied === f.key
                const downloadDone = downloaded === f.key
                const badge = MENU_FORMAT_BADGE[f.key]
                return (
                  // Copy and download are two EQUAL actions now, so both get a
                  // dedicated icon in their own cell — the label used to double
                  // as the copy button (click anywhere on it), which read as
                  // one action with an unrelated icon bolted on rather than two
                  // choices. The label itself is plain text now, not a control.
                  <div
                    key={f.key}
                    role="group"
                    aria-label={`${MENU_FORMAT_LABEL[f.key] ?? f.label} — ${label} ${appearance}`}
                    className={`flex items-stretch rounded-xl border transition-colors ${
                      copyDone || downloadDone ? 'border-status-success/60 bg-status-success/[0.08]' : 'border-line hover:border-line-strong'
                    }`}
                  >
                    <div className="flex-1 min-w-0 px-3 py-2">
                      <span className="flex items-center gap-2">
                        <span className="text-ui font-medium text-fg">{MENU_FORMAT_LABEL[f.key] ?? f.label}</span>
                        {badge && (
                          <span className="px-1.5 py-[1px] rounded-full bg-accent-ui/15 text-accent-ui text-micro font-semibold uppercase tracking-wide flex-shrink-0">
                            {badge}
                          </span>
                        )}
                        {(copyDone || downloadDone) && (
                          <span className="ml-auto text-caption font-semibold text-status-success flex-shrink-0">
                            {copyDone ? 'Copied' : 'Downloaded'}
                          </span>
                        )}
                      </span>
                      <span className="block text-caption font-normal text-fg-faint truncate">
                        {/* Escala JSON is a whole-document contract — say so here
                            rather than let it read as family-scoped like the rest. */}
                        {f.key === 'escala' ? 'The whole tokens.json — not scoped to this ramp' : f.hint}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copy(f.key)}
                      aria-label={`Copy ${label} — ${appearance} as ${MENU_FORMAT_LABEL[f.key] ?? f.label}`}
                      title={`Copy as ${MENU_FORMAT_LABEL[f.key] ?? f.label}`}
                      className="flex-shrink-0 w-10 flex items-center justify-center border-l border-line text-fg-faint hover:text-fg hover:bg-elevated/40 transition-colors"
                    >
                      {copyDone ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M5 15C4.06812 15 3.60218 15 3.23463 14.8478C2.74458 14.6448 2.35523 14.2554 2.15224 13.7654C2 13.3978 2 12.9319 2 12V5.2C2 4.0799 2 3.51984 2.21799 3.09202C2.40973 2.71569 2.71569 2.40973 3.09202 2.21799C3.51984 2 4.0799 2 5.2 2H12C12.9319 2 13.3978 2 13.7654 2.15224C14.2554 2.35523 14.6448 2.74458 14.8478 3.23463C15 3.60218 15 4.06812 15 5M12.2 22H18.8C19.9201 22 20.4802 22 20.908 21.782C21.2843 21.5903 21.5903 21.2843 21.782 20.908C22 20.4802 22 19.9201 22 18.8V12.2C22 11.0799 22 10.5198 21.782 10.092C21.5903 9.71569 21.2843 9.40973 20.908 9.21799C20.4802 9 19.9201 9 18.8 9H12.2C11.0799 9 10.5198 9 10.092 9.21799C9.71569 9.40973 9.40973 9.71569 9.21799 10.092C9 10.5198 9 11.0799 9 12.2V18.8C9 19.9201 9 20.4802 9.21799 20.908C9.40973 21.2843 9.71569 21.5903 10.092 21.782C10.5198 22 11.0799 22 12.2 22Z" />
                        </svg>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadOne(f.key)}
                      aria-label={`Download ${label} — ${appearance} as ${MENU_FORMAT_LABEL[f.key] ?? f.label}`}
                      title={`Download as ${MENU_FORMAT_LABEL[f.key] ?? f.label}`}
                      className="flex-shrink-0 w-10 flex items-center justify-center rounded-r-xl border-l border-line text-fg-faint hover:text-fg hover:bg-elevated/40 transition-colors"
                    >
                      {downloadDone ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M21 15V16.2C21 17.8802 21 18.7202 20.673 19.362C20.3854 19.9265 19.9265 20.3854 19.362 20.673C18.7202 21 17.8802 21 16.2 21H7.8C6.11984 21 5.27976 21 4.63803 20.673C4.07354 20.3854 3.6146 19.9265 3.32698 19.362C3 18.7202 3 17.8802 3 16.2V15M17 10L12 15M12 15L7 10M12 15V3" />
                        </svg>
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          </motion.div>
        </AnimatePresence>,
        document.body,
      )
    : null

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Export the ${label} family — ${appearance}`}
        title={`Copy the ${appearance} ${label} ramp in any format`}
        className={`w-6 h-6 flex items-center justify-center rounded-md transition-colors ${
          open ? 'bg-elevated text-fg' : 'text-fg-faint hover:text-fg hover:bg-elevated'
        }`}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M20.7914 12.6074C21.0355 12.3981 21.1575 12.2935 21.2023 12.169C21.2415 12.0598 21.2415 11.9402 21.2023 11.831C21.1575 11.7065 21.0355 11.6018 20.7914 11.3926L12.3206 4.13196C11.9004 3.77176 11.6903 3.59166 11.5124 3.58725C11.3578 3.58342 11.2101 3.65134 11.1124 3.77122C11 3.90915 11 4.18589 11 4.73936V9.03462C8.86532 9.40807 6.91159 10.4897 5.45971 12.1139C3.87682 13.8845 3.00123 16.1759 3 18.551V19.1629C4.04934 17.8989 5.35951 16.8765 6.84076 16.1659C8.1467 15.5394 9.55842 15.1683 11 15.0705V19.2606C11 19.8141 11 20.0908 11.1124 20.2288C11.2101 20.3486 11.3578 20.4166 11.5124 20.4127C11.6903 20.4083 11.9004 20.2282 12.3206 19.868L20.7914 12.6074Z" />
        </svg>
      </button>
      {panel}
    </div>
  )
}

// ── Editable hex cell (swatch + live hex field, draft pattern) ───────────────

function HexCell({ value, onChange, ariaLabel, onSwatchClick, swatchLabel, compact }: {
  value: string
  onChange: (hex: string) => void
  ariaLabel: string
  /** When set, the swatch becomes a button opening a picker/dialog for this
   *  value. A colour chip that looks clickable and isn't reads as broken, and
   *  the swatch is the part users aim at first; the hex text stays directly
   *  editable either way. The quick-edit strip opens the family picker; the
   *  table cells open that tone's Token Details on the clicked appearance. */
  onSwatchClick?: () => void
  swatchLabel?: string
  /** Tighter strip variant — no copy affordance (reset lives beside it). */
  compact?: boolean
}) {
  const [draft, setDraft] = useState(value.replace(/^#/, '').toUpperCase())
  const [focused, setFocused] = useState(false)
  const [copied, setCopied] = useState(false)

  // Track outside changes (accent swap regenerates the ramp) unless mid-type.
  useEffect(() => { if (!focused) setDraft(value.replace(/^#/, '').toUpperCase()) }, [value, focused])

  function handle(raw: string) {
    const cleaned = raw.replace(/[^0-9a-fA-F]/g, '').slice(0, 6)
    setDraft(cleaned.toUpperCase())
    if (cleaned.length === 6) onChange(`#${cleaned.toLowerCase()}`)
  }

  function copy() {
    navigator.clipboard.writeText(`#${value.replace(/^#/, '').toLowerCase()}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 900)
  }

  return (
    // `group/hex` scopes the hover to THIS cell, not the whole row (the row
    // itself is `group` for its own trailing "expand tone" button) — hovering
    // the dark column shouldn't reveal a copy icon on the light one.
    <div className={`group/hex flex items-center min-w-0 ${compact ? 'gap-1.5' : 'gap-2'}`}>
      {onSwatchClick ? (
        <button
          type="button"
          onClick={onSwatchClick}
          aria-haspopup="dialog"
          aria-label={swatchLabel ?? 'Open color picker'}
          title={swatchLabel ?? 'Open color picker'}
          className={`${compact ? 'w-4 h-4 rounded-[3px] flex-shrink-0 ring-1 ring-black/10' : SWATCH} transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg`}
          style={{ backgroundColor: value }}
        />
      ) : (
        <span className={compact ? 'w-4 h-4 rounded-[3px] flex-shrink-0 ring-1 ring-black/10' : SWATCH} style={{ backgroundColor: value }} />
      )}
      <input
        value={draft}
        onChange={(e) => handle(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        spellCheck={false}
        aria-label={ariaLabel}
        className={
          compact
            ? 'w-[4.25rem] flex-shrink-0 bg-transparent text-caption font-mono tabular-nums text-fg px-1 py-0 outline-none'
            : 'flex-1 min-w-0 bg-app text-body font-mono tabular-nums text-fg rounded-md border border-transparent hover:border-line focus:border-fg px-1.5 py-1 outline-none transition-colors'
        }
      />
      {!compact && (
      <>
      {/* Hidden until the cell is hovered/focused — a copy icon sitting there
          permanently on every one of the 12×2 rows would out-noise the hex
          text it's next to. `focus-visible` keeps it reachable without a mouse. */}
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? 'Copied' : `Copy ${ariaLabel}`}
        title={copied ? 'Copied' : 'Copy hex value'}
        className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded text-fg-faint hover:text-fg hover:bg-elevated opacity-0 group-hover/hex:opacity-100 focus-visible:opacity-100 transition-opacity"
      >
        {copied ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 6L9 17l-5-5" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </button>
      </>
      )}
    </div>
  )
}

// ── Read-only alpha cell — an alpha value is SOLVED against the page it
// renders on (see colorUtils' alphaColorOver), never independently editable,
// so this has no input, just the swatch (over a checkerboard, so the
// translucency itself stays legible instead of reading as a flat, wrong-
// looking color) and the hex as static text. ──
function AlphaHexCell({ value, solid, solidName, compact, appearance }: {
  value: string
  solid?: string
  solidName?: string
  compact?: boolean
  /** The page this alpha was solved against — re-scopes the checkerboard's own
   *  `--surface`/`--elevated` so it stands in for THAT page, not the chrome's.
   *  See `ScaleRow`'s `checkerAppearance` for the measurements. */
  appearance?: 'light' | 'dark'
}) {
  // Split swatch when the solid twin is known: the LEFT half is the raw alpha
  // over the checkerboard (so the translucency is unmistakable), the RIGHT half
  // is the solid tone it composites to. Side by side they read as one fact —
  // "this alpha IS accent-3" — which a lone faint chip never communicated; the
  // checkerboard proved it was translucent but not WHICH tone it reproduced.
  const title = solid && solidName
    ? `${value} — the alpha that renders as ${solidName} (${solid}) over its page. Derived, not directly editable.`
    : `${value} — derived, not directly editable`
  return (
    <div className={`flex items-center min-w-0 ${compact ? 'gap-1.5' : 'gap-2'}`}>
      <span
        className={`${compact ? 'w-4 h-4 rounded-[3px] ring-1 ring-black/10' : SWATCH} relative overflow-hidden flex-shrink-0 ${appearance ?? ''}`}
        style={{ ...CHECKER, backgroundSize: compact ? '5px 5px' : '6px 6px' }}
        title={title}
      >
        <span className={`absolute inset-y-0 left-0 ${solid ? 'right-1/2' : 'right-0'}`} style={{ backgroundColor: value }} />
        {solid && <span className="absolute inset-y-0 left-1/2 right-0" style={{ backgroundColor: solid }} />}
      </span>
      <span
        className={`min-w-0 truncate font-mono tabular-nums text-fg-muted ${
          compact ? 'w-[4.25rem] flex-shrink-0 text-caption' : 'w-full text-body px-1.5 py-1'
        }`}
        title={title}
      >
        {value.replace(/^#/, '').toUpperCase()}
      </span>
    </div>
  )
}

// ── Family model — every primitive ramp the system carries ───────────────────

interface Family {
  key: string
  label: string
  /** Export prefix — the token name is `<tokenPrefix>-<toneLabel>`, matching tokenGenerator. */
  tokenPrefix: string
  base: string
  light: ColorScale
  dark: ColorScale
  setLight: (s: ColorScale) => void
  setDark: (s: ColorScale) => void
  /** Custom-family key — removable from the nav. */
  customKey?: string
  /** Derived alpha twin (e.g. Accent-Alpha) — solved from another family
   *  against the page it renders on, never independently set. Cells render
   *  read-only, over a checkerboard so the translucency stays legible instead
   *  of reading as a flat (and page-appearance-dependent) wrong color. */
  isAlpha?: boolean
  /** For an alpha twin of a CUSTOM family: the family key it derives from, so
   *  it files into the same theme folder as its solid instead of drifting into
   *  "Custom" on its own. */
  alphaOf?: string
  /** For an alpha twin: the SOLID ramp it reproduces when composited over its
   *  page. Rendered beside the translucent value so a row reads as "this alpha
   *  IS that solid" rather than an unrelated faint colour. */
  solidLight?: ColorScale
  solidDark?: ColorScale
}

// ── Theme folders ───────────────────────────────────────────────────────────
// The nav is two levels: a THEME folder, then that theme's Accents/Neutrals/
// States. Every family has exactly one home theme, so nothing is duplicated:
//
//  · The globals (accent, neutral, the four states) belong to `BASE_FOLDER` —
//    labelled "Theme 1" rather than a theme's name because BOTH built-in modes
//    (light + dark) read them; they're one palette seen two ways, not two.
//  · A custom family belongs to the FIRST theme in `themeOrder` whose sources
//    reference it — i.e. the theme that minted it when it was added in
//    Semantics. A theme that reuses a global for a slot doesn't re-home it.
//  · Anything no theme references falls to `CUSTOM_FOLDER`.
const BASE_FOLDER = '__base'
const CUSTOM_FOLDER = '__custom'

export default function ColorPrimitives({
  previewTheme = 'light',
  previewAppearance,
  onPreviewThemeChange,
  onPreviewAppearanceChange,
  focusFamilyKey,
  revealFamily,
  query: externalQuery,
  railCollapsed = false,
  managedThemesExternally = false,
}: {
  previewTheme?: string
  previewAppearance?: ThemeAppearance
  onPreviewThemeChange?: (theme: string) => void
  onPreviewAppearanceChange?: (appearance: ThemeAppearance) => void
  /** External request to switch the active family (e.g. NewTokenWizard just
   *  created it) — a family key (`custom-<slug>`), re-applied whenever it
   *  changes to a new value. */
  focusFamilyKey?: string | null
  /** A Semantics ramp-grid label ("open this ramp in the table") asked to
   *  select a family. `key` is the VOCABULARY name (`accent`, `neutral`,
   *  `error`…) — resolved here against the previewed theme's own families
   *  (a theme's `neutral` slot may point at a custom `<key>-gray` family).
   *  `seq` bumps on every click so re-selecting the same family re-fires. */
  revealFamily?: { key: string; seq: number } | null
  /** Shared with the Foundation toolbar so search occupies one consistent
   *  position across Primitives and Semantics. */
  query?: string
  /** Collapses this view's own 198px left column to a swatch strip. LIFTED
   *  to `Configurator` so TopNav's brand block and FoundationWorkbench's
   *  Groups cell track the same width. */
  railCollapsed?: boolean
  /** Suppresses duplicate theme lifecycle controls when Themes Library owns them. */
  managedThemesExternally?: boolean
  /** Opens Gradients, a collection in the System colors rail. */
  onOpenGradients?: () => void
}) {
  const store = useDesignStore()
  const {
    primaryColor, primaryScale, setPrimaryScale,
    primaryDarkScale, setPrimaryDarkScale,
    grayBaseColor, grayLightScale, grayDarkScale, setGrayLightScale, setGrayDarkScale,
    errorColor, errorScale, errorDarkScale, setErrorScale, setErrorDarkScale,
    warningColor, warningScale, warningDarkScale, setWarningScale, setWarningDarkScale,
    successColor, successScale, successDarkScale, setSuccessScale, setSuccessDarkScale,
    infoColor, infoScale, infoDarkScale, setInfoScale, setInfoDarkScale,
    customColors, updateCustomColor, removeCustomColor,
    removeTheme,
    pageBackground, darkBackground, themeKinds, themeSources, themeOrder,
    colorAlgorithm, colorNaming, contrastShift, neutralTint,
    linkNeutralToAccent, setLinkNeutralToAccent,
    linkStatesToAccent, setLinkStatesToAccent,
    setContrastShift, setNeutralTint,
  } = store
  const applyAccentColor = useApplyAccentColor()
  const applyGrayColor = useApplyGrayColor()
  const applyStateColor = useApplyStateColor()

  // Seed any ramp that's still empty (a fresh system may land here straight
  // from Home's "Start setting tokens" CTA).
  useEnsureColorScales()

  const preferredAppearance = themeKinds[previewTheme] ?? 'light'
  const activeAppearance = previewAppearance ?? preferredAppearance
  const appearanceColumns = appearanceOrder(preferredAppearance)
  const darkPreview = activeAppearance === 'dark'

  const namingLabels = (NAMING_SCHEMES.find((s) => s.key === colorNaming) ?? NAMING_SCHEMES[0]).labels

  // Retinting Accent cascades to Neutral only while the link is on — the flag
  // now lives in the STORE (`linkNeutralToAccent`), not as local state in a
  // popover. This used to be hardcoded `false` with a comment pointing at
  // Picker Color as the place "move both together" lives; Picker Color was
  // retired and the behaviour went with it, so the neutral silently stopped
  // tracking the accent everywhere. The toggle is in the scale-settings gear,
  // beside Neutral tint — the setting that decides how much accent hue the
  // linked neutral even carries.
  const changeAccent = (hex: string) => {
    const linked = useDesignStore.getState().linkNeutralToAccent
    applyAccentColor(hex, linked, previewTheme)
  }

  // Harmonize the four state colours with the accent. `recommendStateColors`
  // blends only CHROMA — each state keeps its canonical lightness and hue,
  // because the hue IS the semantics (a red that drifts toward a green accent
  // stops reading as an error). So this makes the set share the accent's
  // saturation character without touching what any of them mean. Used both for
  // the toggle's swatch preview and to actually apply the link — same value,
  // so the preview can never promise something the click doesn't deliver.
  const stateRecommendation = useMemo(() => recommendStateColors(primaryColor), [primaryColor])
  const changeNeutral = (hex: string) => applyGrayColor(hex, previewTheme)

  // ── Families table state ──
  const [activeFamily, setActiveFamily] = useState('accent')
  const query = externalQuery ?? ''
  // Which tone's Token Details dialog is open, and which appearance that
  // dialog is currently editing. Rows used to expand INLINE here while the
  // identical job on the Semantics tab opened a dialog — same hub, same "edit
  // one token's value" task, two different interactions. Primitives now opens
  // the SAME shared TokenDetailsModal, so there's one thing to learn.
  const [expandedTone, setExpandedTone] = useState<number | null>(null)
  const [detailMode, setDetailMode] = useState<'light' | 'dark'>('light')
  const reduce = useReducedMotion() ?? false
  /** The tones table's scroll container — the Token Details dialog's anchor. */
  const tableRef = useRef<HTMLDivElement>(null)

  // Scale-settings gear (algorithm/naming/contrast shift) — promoted from
  // Picker Color into the quick-edit strip below.
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsAnchorRef = useRef<HTMLDivElement>(null)
  // Theme folder pending deletion. The rail's per-family trash is LOCKED while
  // a theme references that family ("remove the theme first") — and until now
  // the only place to remove a theme was Semantics' column header, which is a
  // different tab. So a custom family created by "+ Theme" was, in practice,
  // undeletable from the screen that shows it. This is that missing exit:
  // deleting the theme frees its families into Custom, where the existing
  // per-family trash already works. Nothing about the colours is destroyed —
  // only the theme and the semantic values mapped to it.
  const [themeToDelete, setThemeToDelete] = useState<string | null>(null)
  // "+ New theme" CTA under the folder list — opens the SAME `ThemePanel`
  // Semantics' `+` and column pencil open, in the same docked position.
  // Adding a theme is a colour decision (it mints the primitive families the
  // new theme reads), so it belongs on this rail too, not only in Semantics.
  const [addThemeOpen, setAddThemeOpen] = useState(false)

  // A family created elsewhere (NewTokenWizard) requests focus — switch to it
  // so the table actually shows the family + names the user just picked,
  // instead of silently staying on whatever was active before.
  useEffect(() => {
    if (focusFamilyKey) setActiveFamily(focusFamilyKey)
  }, [focusFamilyKey])

  // A no-op setter for derived families (Accent-Alpha) — never actually
  // invoked since every edit affordance (pencil, per-row expand) is guarded
  // off for `isAlpha` families below; it exists only to satisfy `Family`'s
  // shape without special-casing every call site that expects a setter.
  const noopSet = useCallback((_s: ColorScale) => {}, [])

  // EVERY family carries both scales (the Radix two-scale model) — the light
  // column edits the light ramp, the dark column its own dark twin.
  const families: Family[] = useMemo(() => [
    { key: 'accent',  label: 'Accent',  tokenPrefix: 'accent',  base: primaryColor,  light: primaryScale,   dark: primaryDarkScale, setLight: setPrimaryScale,   setDark: setPrimaryDarkScale },
    {
      key: 'accent-alpha', label: 'Accent-Alpha', tokenPrefix: 'accent-a', base: primaryColor,
      // Solved against each appearance's own page — see colorUtils'
      // alphaColorOver — never independently set, so both scales are derived
      // live rather than stored.
      light: generateAlphaScale(primaryScale, pageBackground, 'light'),
      dark: generateAlphaScale(primaryDarkScale, darkBackground, 'dark'),
      setLight: noopSet, setDark: noopSet, isAlpha: true,
      solidLight: primaryScale, solidDark: primaryDarkScale,
    },
    { key: 'neutral', label: 'Neutral', tokenPrefix: 'neutral', base: grayBaseColor, light: grayLightScale, dark: grayDarkScale,    setLight: setGrayLightScale, setDark: setGrayDarkScale },
    {
      key: 'neutral-alpha', label: 'Neutral-Alpha', tokenPrefix: 'neutral-a', base: grayBaseColor,
      light: generateAlphaScale(grayLightScale, pageBackground, 'light'),
      dark: generateAlphaScale(grayDarkScale, darkBackground, 'dark'),
      setLight: noopSet, setDark: noopSet, isAlpha: true,
      solidLight: grayLightScale, solidDark: grayDarkScale,
    },
    // Black/White Alpha — a DIFFERENT kind of alpha from every entry above.
    // Neutral-Alpha (and Accent-/Error-/etc.-Alpha) are SOLVED: tone N
    // reproduces that family's own solid N when composited over ITS page, so
    // they're page- and appearance-dependent by construction. Black/White
    // Alpha are the other half of "THE ALPHA LAYER" — a FIXED opacity ladder
    // (the published Radix blackA/whiteA scale, verbatim), agnostic to any
    // background, for washes/scrims/rims that have to work over a surface
    // the token itself doesn't know about. They already exported correctly
    // (`colors.primitiveAlpha['black-a-*']`/`['white-a-*']`, tokenGenerator.ts)
    // — this only gives them somewhere to be SEEN and browsed, which they
    // previously had nowhere: a plugin import surfaced them as real Figma
    // variables with no equivalent row in this nav, reading as unexplained
    // clutter. Filed under Neutrals (see homeOf) because they're the
    // universal, brand-agnostic ladder — the same reason `black-a`/`white-a`
    // sit beside `neutral`/`neutral-a` in the export's own primitive keys.
    // No `solidLight`/`solidDark`: there's no single solid these reproduce
    // (that's the whole point — they work over an unknown backdrop), so
    // `overviewScale`'s `?? family.light` fallback shows the ladder itself.
    {
      key: 'black-alpha', label: 'Black Alpha', tokenPrefix: 'black-a', base: '#000000',
      light: BLACK_ALPHA_SCALE, dark: BLACK_ALPHA_SCALE,
      setLight: noopSet, setDark: noopSet, isAlpha: true,
    },
    {
      key: 'white-alpha', label: 'White Alpha', tokenPrefix: 'white-a', base: '#ffffff',
      light: WHITE_ALPHA_SCALE, dark: WHITE_ALPHA_SCALE,
      setLight: noopSet, setDark: noopSet, isAlpha: true,
    },
    { key: 'error',   label: 'Error',   tokenPrefix: 'error',   base: errorColor,    light: errorScale,     dark: errorDarkScale,   setLight: setErrorScale,     setDark: setErrorDarkScale },
    {
      key: 'error-alpha', label: 'Error-Alpha', tokenPrefix: 'error-a', base: errorColor,
      light: generateAlphaScale(errorScale, pageBackground, 'light'),
      dark: generateAlphaScale(errorDarkScale, darkBackground, 'dark'),
      setLight: noopSet, setDark: noopSet, isAlpha: true,
      solidLight: errorScale, solidDark: errorDarkScale,
    },
    { key: 'success', label: 'Success', tokenPrefix: 'success', base: successColor,  light: successScale,   dark: successDarkScale, setLight: setSuccessScale,   setDark: setSuccessDarkScale },
    {
      key: 'success-alpha', label: 'Success-Alpha', tokenPrefix: 'success-a', base: successColor,
      light: generateAlphaScale(successScale, pageBackground, 'light'),
      dark: generateAlphaScale(successDarkScale, darkBackground, 'dark'),
      setLight: noopSet, setDark: noopSet, isAlpha: true,
      solidLight: successScale, solidDark: successDarkScale,
    },
    { key: 'warning', label: 'Warning', tokenPrefix: 'warning', base: warningColor,  light: warningScale,   dark: warningDarkScale, setLight: setWarningScale,   setDark: setWarningDarkScale },
    {
      key: 'warning-alpha', label: 'Warning-Alpha', tokenPrefix: 'warning-a', base: warningColor,
      light: generateAlphaScale(warningScale, pageBackground, 'light'),
      dark: generateAlphaScale(warningDarkScale, darkBackground, 'dark'),
      setLight: noopSet, setDark: noopSet, isAlpha: true,
      solidLight: warningScale, solidDark: warningDarkScale,
    },
    { key: 'info',    label: 'Info',    tokenPrefix: 'info',    base: infoColor,     light: infoScale,      dark: infoDarkScale,    setLight: setInfoScale,      setDark: setInfoDarkScale },
    {
      key: 'info-alpha', label: 'Info-Alpha', tokenPrefix: 'info-a', base: infoColor,
      light: generateAlphaScale(infoScale, pageBackground, 'light'),
      dark: generateAlphaScale(infoDarkScale, darkBackground, 'dark'),
      setLight: noopSet, setDark: noopSet, isAlpha: true,
      solidLight: infoScale, solidDark: infoDarkScale,
    },
    // EVERY custom family gets an alpha twin right after it, exactly like the
    // globals do — built adjacent so the pair stays together in whatever group
    // the solid lands in. These are real exported tokens, not display-only
    // rows: `tokenGenerator` (see its `store.customColors.forEach` → `alphaOf`)
    // emits `<key>-a*` for every custom family, unconditionally.
    //
    // This used to be gated on `brandFamilyKeys` — only a family some theme
    // read as its BRAND got a twin here. That gate disagreed with the export,
    // and the gap was the whole "alpha state ramps aren't showing" report: a
    // theme minted from a System Style points its error/warning/success/info
    // slots at custom families (`core-copy-error`, …), so in the Themes
    // workspace `activeThemeFamilies` drops the GLOBAL `error-alpha` (its
    // source `error` isn't one of that theme's slots) while the custom
    // statuses never got a twin to replace it — every status alpha ramp
    // vanished from the nav, the table and the overview, while
    // `core-copy-error-a-1…12` shipped to tokens.json and imported into Figma
    // as variables with no row anywhere in the UI. That is exactly the
    // unexplained-clutter failure the Black/White Alpha entry above exists to
    // close, so the gate is gone rather than extended slot by slot.
    ...customColors.flatMap((c): Family[] => {
      const solid: Family = {
        key: `custom-${c.key}`,
        label: c.label,
        tokenPrefix: c.key,
        base: c.base,
        light: c.scale,
        dark: c.darkScale ?? c.scale,
        setLight: (s: ColorScale) => updateCustomColor(c.key, { scale: s }),
        setDark: (s: ColorScale) => updateCustomColor(c.key, { darkScale: s }),
        customKey: c.key,
      }
      // Same page the solid custom ramp was grown against (theme paper), not
      // the open system's globals — otherwise tone 1 lands near-opaque.
      const pages = resolveFamilyPages(
        { pageBackground, darkBackground, neutralTint, themeSources, customColors },
        c.key,
      )
      return [solid, {
        key: `custom-${c.key}-alpha`,
        label: `${c.label}-Alpha`,
        tokenPrefix: `${c.key}-a`,
        base: c.base,
        light: generateAlphaScale(c.scale, pages.light, 'light'),
        dark: generateAlphaScale(c.darkScale ?? c.scale, pages.dark, 'dark'),
        setLight: noopSet, setDark: noopSet, isAlpha: true, alphaOf: c.key,
        solidLight: c.scale, solidDark: c.darkScale ?? c.scale,
      }]
    }),
  ], [
    primaryColor, primaryScale, setPrimaryScale,
    primaryDarkScale, setPrimaryDarkScale,
    pageBackground, darkBackground, neutralTint, themeSources, noopSet,
    grayBaseColor, grayLightScale, grayDarkScale, setGrayLightScale, setGrayDarkScale,
    primaryDarkScale, setPrimaryDarkScale,
    errorColor, errorScale, errorDarkScale, setErrorScale, setErrorDarkScale,
    successColor, successScale, successDarkScale, setSuccessScale, setSuccessDarkScale,
    warningColor, warningScale, warningDarkScale, setWarningScale, setWarningDarkScale,
    infoColor, infoScale, infoDarkScale, setInfoScale, setInfoDarkScale,
    customColors, updateCustomColor,
  ])

  /**
   * The Themes Library owns the active theme. In that workspace Primitives is
   * a collection for the selected theme, not a catalogue of every theme's
   * private families. Keep shared slots (neutral/status) when that theme uses
   * them, but never leak another theme's accent into this rail or overview.
   */
  const activeThemeFamilies = useMemo(() => {
    if (!managedThemesExternally) return families
    // Resolve every slot the way `resolveThemePalette` does: the theme's own
    // family reference when it sets one, else the GLOBAL family. A system with
    // no "+Theme" families has no `themeSources` entry at all, so without the
    // global fallback this filtered to nothing — the rail lost Accent, its
    // alpha twin and the shared neutral/status ramps. The fallback keeps those
    // (exactly as before the Themes Library split) while still never letting
    // another theme's private accent family leak in.
    const refs = themeSources[previewTheme]
    const sources = new Set(FAMILY_SLOTS.map((slot) => refs?.[slot] || GLOBAL_FAMILY[slot]))
    return families.filter((item) => {
      // Black/White Alpha aren't referenced by any theme slot — no theme's
      // brand/gray/status ever points at them, because they're the universal
      // ladder, not a per-theme family (see their own entry above). The
      // slot-membership filter this function otherwise applies would drop
      // them from every theme, so they're kept unconditionally instead.
      if (item.key === 'black-alpha' || item.key === 'white-alpha') return true
      const sourceKey = item.customKey ?? item.alphaOf ?? item.key.replace(/-alpha$/, '')
      return sources.has(sourceKey)
    })
  }, [families, managedThemesExternally, previewTheme, themeSources])

  const family = activeThemeFamilies.find((f) => f.key === activeFamily) ?? activeThemeFamilies[0] ?? families[0]

  // ── Folders (Figma-style collections) ──
  // The nav groups families by the ROLE they serve, not by insertion order:
  // Accents (the brand + every custom family a theme reads as its accent),
  // Neutrals (base + theme neutrals), States (the four intents + custom status
  // families) and Custom for free-standing families no theme references yet.
  // States stays here too — this rail is EVERY color primitive's usage table
  // (Backgrounds/Interactive/Borders/Solid/Text bands), and Error/Success/
  // Warning/Info are primitives same as Accent/Neutral; Picker Color showing
  // their full scale for quick editing doesn't remove them from usage.
  // Derived from `themeSources`, so a family minted by "Add theme" files
  // itself under the right folder with zero bookkeeping.
  /** A family's home folder + the group it sits in there. See BASE_FOLDER. */
  const homeOf = useCallback(
    (f: Family): { folder: string; group: FamilyGroup } => {
      // Globals — one palette, read by both built-in modes.
      if (f.key === 'accent' || f.key === 'accent-alpha') return { folder: BASE_FOLDER, group: 'Accents' }
      if (f.key === 'neutral' || f.key === 'neutral-alpha' || f.key === 'black-alpha' || f.key === 'white-alpha') {
        return { folder: BASE_FOLDER, group: 'Neutrals' }
      }
      const custKey = f.customKey ?? f.alphaOf
      if (!custKey) return { folder: BASE_FOLDER, group: 'States' }
      // Custom family — homed to the first theme that references it, under the
      // group matching the SLOT it fills there (brand → Accents, gray →
      // Neutrals, any status slot → States).
      for (const theme of themeOrder) {
        const refs = themeSources[theme]
        if (!refs) continue
        for (const slot of FAMILY_SLOTS) {
          if (refs[slot] !== custKey) continue
          return {
            folder: theme,
            group: slot === 'brand' ? 'Accents' : slot === 'gray' ? 'Neutrals' : 'States',
          }
        }
      }
      return { folder: CUSTOM_FOLDER, group: 'Custom' }
    },
    [themeOrder, themeSources],
  )

  const navFolders = useMemo(() => {
    const byFolder = new Map<string, Map<FamilyGroup, Family[]>>()
    families.forEach((f) => {
      const { folder, group } = homeOf(f)
      if (!byFolder.has(folder)) byFolder.set(folder, new Map())
      const groups = byFolder.get(folder)!
      if (!groups.has(group)) groups.set(group, [])
      groups.get(group)!.push(f)
    })
    // Base first, then themes in the user's own column order, Custom last.
    const order = [BASE_FOLDER, ...themeOrder.filter((t) => t !== BASE_FOLDER), CUSTOM_FOLDER]
    return order
      .filter((k) => byFolder.has(k))
      .map((k) => ({
        key: k,
        label:
          k === BASE_FOLDER ? (managedThemesExternally ? 'System colors' : 'Theme 1')
          : k === CUSTOM_FOLDER ? 'Custom'
          : k.charAt(0).toUpperCase() + k.slice(1),
        groups: FAMILY_GROUPS
          .map((label) => ({ label, items: byFolder.get(k)!.get(label) ?? [] }))
          .filter((g) => g.items.length > 0),
      }))
  }, [families, homeOf, managedThemesExternally, themeOrder])

  const visibleNavFolders = useMemo(() => {
    if (!managedThemesExternally) return navFolders
    return [{
      key: BASE_FOLDER,
      label: 'System colors',
      groups: FAMILY_GROUPS
        .map((label) => ({ label, items: activeThemeFamilies.filter((family) => homeOf(family).group === label) }))
        .filter((group) => group.items.length > 0),
    }]
  }, [activeThemeFamilies, homeOf, managedThemesExternally, navFolders])

  /** Groups for the scroll-tail ramp board — the SAME partition the nav uses
   *  (`homeOf`), over whatever families this workspace is showing, so the board
   *  and the rail can't list different ramps. Folder-agnostic on purpose: the
   *  board is one "System ramps" section, not one per theme folder. */
  const overviewGroups = useMemo(
    () => FAMILY_GROUPS
      .map((label) => ({ label, items: activeThemeFamilies.filter((f) => homeOf(f).group === label) }))
      .filter((g) => g.items.length > 0),
    [activeThemeFamilies, homeOf],
  )

  // Collapsed nav sections. Keys are a whole folder's own key, or
  // `<folder>/<group>` for one of its Accents/Neutrals/States groups, so the
  // two levels collapse independently.
  //
  // Fresh-mount default: every THEME folder (not Base, not Custom) starts
  // collapsed. `homeOf` above homes a "+ Theme"-minted family under its own
  // theme's folder — so a system with two or three extra themes used to load
  // Primitives with every one of them, plus their own Accents/Neutrals/States
  // groups, already expanded: a wall of ramps before you'd picked which theme
  // to even look at. Base (the globals every system starts with) and Custom
  // stay open, since those are what a fresh system — or one with no extra
  // themes yet — actually wants visible on first look. This is a LAZY
  // initializer, not an effect: `navFolders` is already computed by the time
  // render reaches this line, so the very first paint is already collapsed —
  // no expand-then-snap-shut flash.
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    const collapsed = new Set<string>()
    navFolders.forEach((folder) => {
      if (folder.key !== BASE_FOLDER && folder.key !== CUSTOM_FOLDER) collapsed.add(folder.key)
      // Neutrals and States start closed — a fresh system reaches for its
      // Accent first, and those two groups are noise until it does.
      folder.groups.forEach((group) => {
        if (group.label === 'Neutrals' || group.label === 'States') {
          collapsed.add(`${folder.key}/${group.label}`)
        }
      })
    })
    return collapsed
  })
  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Theme folders are an ACCORDION: opening one collapses every other folder,
  // so the nav never shows two themes' ramp trees at once. A system with a
  // handful of "+ Theme" families otherwise stacked Theme 1 + Mint + Custom +
  // … all expanded, and it wasn't obvious which theme the table/preview were
  // actually on. Clicking an already-open folder just closes it (plain
  // toggle). Only the OUTER `folder.key` entries are touched — the
  // `<folder>/<group>` Accents/Neutrals/States keys keep their own state, so
  // reopening a folder lands on the same groups you left open inside it.
  const toggleFolderExclusive = (folderKey: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (!prev.has(folderKey)) {
        // was open → collapse it
        next.add(folderKey)
      } else {
        // was collapsed → open it, collapse the rest
        visibleNavFolders.forEach((f) => {
          if (f.key === folderKey) next.delete(f.key)
          else next.add(f.key)
        })
      }
      return next
    })
  }

  // Which theme a nav FOLDER previews. A real theme folder (`sky`, `violet`)
  // IS that theme; `__base` ("Theme 1") stands in for the first built-in;
  // `__custom` holds unreferenced families and previews nothing. Clicking a
  // folder header switches the whole surface — ramps, Preview, Artefacts,
  // .MD — to that theme, so selecting a theme in the nav shows its result,
  // the same as clicking a column eye in Semantics.
  const folderThemeKey = useCallback(
    (folderKey: string): string | null => {
      if (folderKey === CUSTOM_FOLDER) return null
      if (folderKey === BASE_FOLDER) return themeOrder[0] ?? 'light'
      return themeOrder.includes(folderKey) ? folderKey : null
    },
    [themeOrder],
  )
  /** The Family key of a theme's ACCENT — the family whose ramp IS that theme's
   *  identity. A theme references its brand slot by customColors key
   *  (`themeSources[t].brand === 'sky'`), and this nav keys that family
   *  `custom-sky`; a theme with no override (the built-in light/dark) reads the
   *  global `accent`. */
  const themeAccentFamilyKey = useCallback(
    (themeKey: string): string | null => {
      const brand = themeSources[themeKey]?.brand
      const key = !brand || brand === 'accent' ? 'accent' : `custom-${brand}`
      return families.some((f) => f.key === key) ? key : null
    },
    [families, themeSources],
  )

  // Selecting a theme must move the TABLE too, not just the preview. Switching
  // `previewTheme` alone left the quick-edit strip, the token rows and the ramp
  // overview on whichever family was selected before — so picking "Theme 1"
  // while Sky's accent was active showed the Theme-1 preview beside `sky-1…12`
  // and Sky's hex, i.e. two different themes on one screen. Landing on the
  // theme's own accent is what makes "the ramp changed" true.
  const selectFolderTheme = (folderKey: string) => {
    const tk = folderThemeKey(folderKey)
    if (!tk) return
    if (tk !== previewTheme) onPreviewThemeChange?.(tk)
    const accentKey = themeAccentFamilyKey(tk)
    if (accentKey && accentKey !== activeFamily) {
      setActiveFamily(accentKey)
      setExpandedTone(null)
    }
  }

  // When the previewed theme changes, land on THAT theme's accent so the
  // quick-edit strip and table can't show one theme's preview beside another
  // theme's ramp. Runs on `previewTheme` (and that theme's brand slot) only —
  // NOT on every family rebuild. `themeAccentFamilyKey` closes over `families`,
  // which is a new array after any status retint; listing it here snapped the
  // table back to Accent the moment you edited Success, so the picker showed
  // the new green and the ramp stayed the previous purple.
  const previewBrand = themeSources[previewTheme]?.brand
  useEffect(() => {
    if (!managedThemesExternally) return
    const accentKey = themeAccentFamilyKey(previewTheme)
    if (accentKey) {
      setActiveFamily(accentKey)
      setExpandedTone(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [managedThemesExternally, previewTheme, previewBrand])

  // A Semantics ramp-grid label ("edit this ramp in the table") asked to select
  // a family. Runs AFTER the theme→accent effect above so an explicit request
  // wins on the same mount that a tab-switch triggers that reset. The grid
  // speaks VOCABULARY (`accent`, `neutral`, `neutral-dark`, `error`…); resolve
  // to a real family key — a direct `tokenPrefix` match (built-in families),
  // else via the previewed theme's slot ref (its `neutral` slot may point at a
  // custom `<key>-gray` family). Keyed on `seq` so a repeat click re-fires.
  useEffect(() => {
    if (!revealFamily) return
    const vocab = revealFamily.key
    const slot: FamilySlot | null =
      vocab === 'accent' ? 'brand'
      : vocab === 'neutral' || vocab === 'neutral-dark' ? 'gray'
      : (['error', 'warning', 'success', 'info'] as const).includes(vocab as never) ? (vocab as FamilySlot)
      : null
    let target = activeThemeFamilies.find((f) => !f.isAlpha && f.tokenPrefix === vocab)
    if (!target && slot) {
      const custKey = themeSources[previewTheme]?.[slot]
      const wanted = custKey ? [`custom-${custKey}`, custKey] : [GLOBAL_FAMILY[slot], `custom-${GLOBAL_FAMILY[slot]}`]
      target = activeThemeFamilies.find((f) => !f.isAlpha && wanted.includes(f.key))
    }
    // Set state in response to an explicit external command — the same shape as
    // the `focusFamilyKey` and theme→accent effects above.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (target) {
      setActiveFamily(target.key)
      setExpandedTone(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealFamily?.seq])

  const q = query.trim().toLowerCase()
  const tones = Array.from({ length: 12 }, (_, i) => i + 1)
  const rowName = (tone: number) => `${family.tokenPrefix}-${namingLabels[tone - 1] ?? tone}`
  // The SOLID token an alpha row reproduces — `accent-a-3` → `accent-3`. The
  // alpha prefix is the solid's plus "-a" (see the alpha families above), so
  // dropping that suffix recovers the solid's exported name exactly.
  const solidRowName = (tone: number) =>
    `${family.tokenPrefix.replace(/-a$/, '')}-${namingLabels[tone - 1] ?? tone}`
  const visibleTones = q ? tones.filter((tone) => rowName(tone).toLowerCase().includes(q)) : tones

  const setTone = (scale: ColorScale, setter: (s: ColorScale) => void, tone: number, hex: string) =>
    setter({ ...scale, [tone]: hex })

  // ── Per-family colour editing ──
  // The nav used to be selection-only: to retint a family you had to go back up
  // to the quick bar and know which control owned it. Each row now carries a
  // pencil that opens the picker for THAT family, routed to whichever applier
  // owns it.
  const [editFamily, setEditFamily] = useState<string | null>(null)
  const editRef = useRef<HTMLDivElement>(null)
  const editPopRef = useRef<HTMLDivElement>(null)
  const navRef = useRef<HTMLElement>(null)

  // Which appearance the family-edit drawer's picker reads against. The base
  // hex a family is anchored on is shared by both twins (tone 9 is identical
  // light/dark), so this doesn't change WHAT you edit — it changes the SPECTRUM
  // you judge it against: the SV canvas corners, and the Follows preview's page.
  // Seeded from whatever's previewed when the drawer opens, then the user can
  // flip it in the header without closing the drawer, switching the previewed
  // appearance and reopening.
  const [editAppearance, setEditAppearance] = useState<ThemeAppearance>('light')
  useEffect(() => {
    if (editFamily) setEditAppearance(activeAppearance)
  }, [editFamily, activeAppearance])

  // Theme-scoped accent — same read as Theme Preview's quick-settings rail, so
  // the Primitives neutral picker and the Theme Preview neutral picker share
  // one harmonized curated ramp and the same displayed value when linked.
  const pickerThemeAccent = useMemo(() => {
    const brandFamily = themeSources[previewTheme]?.brand ?? 'accent'
    if (brandFamily === 'accent') return primaryColor
    return customColors.find((c) => c.key === brandFamily)?.base ?? primaryColor
  }, [previewTheme, themeSources, primaryColor, customColors])

  // The picker is 256px wide but the nav column is 198px AND scrolls
  // (`overflow-y-auto`), with two more `overflow:hidden` wrappers above it from
  // the folder/group collapse animations. An absolutely-positioned popover
  // inside that stack gets CLIPPED on its right edge and top — which is exactly
  // the bug: the state pickers rendered as a sliver inside the rail's mask.
  //
  // No arrangement of z-index fixes an overflow clip, so the popover is
  // portaled to <body> and positioned `fixed` off a measured rect instead.
  //
  // That rect is the NAV's, not the clicked row's. Anchoring per-row put every
  // family's picker somewhere different — and worse, the rows sit low enough
  // that the placement hook flipped most of them ABOVE their row, where a
  // ~520px panel ran off the top of the window: measured at 833px tall, Error
  // opened at y=9 (jammed against the viewport edge, overlapping TopNav) while
  // Success opened at y=46 and Info at y=119. Same control, four positions,
  // one of them clipped. Anchoring to the nav gives every family ONE position,
  // and it's beside the column rather than over it, so the family list stays
  // readable while you edit — the same "dock the picker next to the column,
  // not on top of it" move the quick-edit strip's popover makes.
  // Re-measured on scroll (capture phase, so an ancestor's scroll counts) and
  // on resize.
  const [navRect, setNavRect] = useState<DOMRect | null>(null)
  useEffect(() => {
    if (!editFamily) { setNavRect(null); return }
    const measure = () => {
      const r = navRef.current?.getBoundingClientRect()
      if (r) setNavRect(r)
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [editFamily])

  useEffect(() => {
    if (!editFamily) return
    function onDown(e: MouseEvent) {
      const t = e.target as Node
      // Both the anchor row AND the portaled popover count as "inside" — the
      // popover is no longer a DOM descendant of the row, so checking only the
      // row would close the picker on its own clicks.
      if (editRef.current?.contains(t) || editPopRef.current?.contains(t)) return
      setEditFamily(null)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setEditFamily(null) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [editFamily])

  // The quick-edit strip's hex swatch is just a second door into the SAME
  // family-edit drawer (`editFamily` / `editPortal` above) — it used to open
  // its own separately-anchored popover, which is exactly the "one job, three
  // controls" split the dock unified.
  const openFamilyEdit = () => { if (!family.isAlpha) setEditFamily(family.key) }

  // ── Reset a family to its factory colour ──
  // Read from `makeDesignDefaults()` — the SAME factory a brand-new system is
  // seeded from — rather than a hardcoded hex table here, so "reset" can never
  // drift from what "default" actually means. Built once per mount: the factory
  // also builds gradients and ramps, which there's no reason to redo per render.
  const factory = useMemo(() => makeDesignDefaults(), [])
  /** The factory base for a family, or null when there ISN'T one — a custom
   *  family was invented by the user, so there's no default to return it to,
   *  and an alpha twin is solved from its solid rather than set. Those two get
   *  no button at all instead of a dead one. */
  const defaultBaseFor = (f: Family): string | null => {
    if (f.isAlpha || f.customKey) return null
    switch (f.key) {
      case 'accent': return factory.primaryColor
      case 'neutral': return factory.grayBaseColor
      case 'error': return factory.errorColor
      case 'warning': return factory.warningColor
      case 'success': return factory.successColor
      case 'info': return factory.infoColor
      default: return null
    }
  }

  const changeFamilyBase = (f: Family, hex: string) => {
    // Derived (Accent-Alpha) — nothing to set independently.
    if (f.isAlpha) return
    if (f.customKey) {
      const refs = themeSources[previewTheme]
      if (refs?.gray === f.customKey) return changeNeutral(hex)
      if (refs?.brand === f.customKey) return changeAccent(hex)
      for (const slot of ['error', 'warning', 'success', 'info'] as const) {
        if (refs?.[slot] === f.customKey) return applyStateColor(slot, hex, false, previewTheme)
      }
      try {
        const pages = resolveThemePages(useDesignStore.getState(), previewTheme)
        updateCustomColor(f.customKey, {
          base: hex,
          scale: generateColorScale(hex, colorAlgorithm, contrastShift, pages.light),
          darkScale: generateFamilyDarkScale(hex, colorAlgorithm, contrastShift, pages.dark),
        })
      } catch { /* invalid hex — ignore */ }
      return
    }
    if (f.key === 'accent') return changeAccent(hex)
    if (f.key === 'neutral') return changeNeutral(hex)
    applyStateColor(f.key as 'error' | 'warning' | 'success' | 'info', hex)
  }

  // Built here rather than inline in the nav so it renders ONCE, outside every
  // clipping ancestor — and it DOCKS exactly like `ThemePanel` (the "New/Edit
  // theme" drawer): flush against the Color Variables column, top-aligned with
  // it, full height to an 8px bottom gap. Same portal, same `rounded-r-2xl
  // border-l-0` shell, same shadow, same 52px header with a close button, same
  // left-slide in/out. Editing a family's base colour and minting a theme are
  // the same KIND of action on the same column, so they read as the same
  // drawer — this used to be a small `w-64` floater beside the rail (and the
  // quick-edit strip opened its own separate anchored popover), which made one
  // job look like three different controls. `DOCK_W` mirrors `ThemePanel`'s
  // `PANEL_W`; `dockLeft` follows the rail's collapsed/expanded width off the
  // shared constants so a collapsed rail can't leave it floating over the strip.
  const editingFamily = editFamily ? families.find((f) => f.key === editFamily) ?? null : null
  const editingUsesNeutralPicker = editingFamily ? familyUsesNeutralPicker(editingFamily, homeOf) : false
  const editingUsesAccentPicker = editingFamily ? familyUsesAccentPicker(editingFamily, homeOf) : false
  const editingNeutralCoordinated = editingFamily
    ? isPreviewThemeGrayFamily(editingFamily, previewTheme, themeSources)
    : false
  const editingFamilyPickerValue = editingFamily && editingNeutralCoordinated && linkNeutralToAccent
    ? neutralFromBrand(pickerThemeAccent, neutralTint)
    : editingFamily?.base ?? ''
  const editingPickerAppearance = editingNeutralCoordinated ? activeAppearance : editAppearance
  // In Themes Library mode this drawer belongs to the library boundary, not
  // the nested Color families rail. It therefore opens exactly where “New
  // theme” opens: immediately to the right of the extreme-left library.
  const dockLeft = managedThemesExternally ? THEME_LIBRARY_WIDTH : (railCollapsed ? COLOR_RAIL_COLLAPSED_WIDTH : COLOR_RAIL_WIDTH)
  const editPortal = editingFamily && navRect
    ? createPortal(
        <AnimatePresence>
          <motion.div
            ref={editPopRef}
            key={editingFamily.key}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            role="dialog"
            aria-label={`Edit ${editingFamily.label} color`}
            style={{
              position: 'fixed',
              left: dockLeft,
              top: managedThemesExternally ? TOP_NAV_H : (navRect.top > 0 ? navRect.top : DOCK_TOP_FALLBACK),
              bottom: DOCK_BOTTOM,
              width: Math.min(DOCK_W, Math.max(280, window.innerWidth - dockLeft - 16)),
            }}
            className="z-50 rounded-r-2xl border border-l-0 border-line bg-app shadow-[16px_0_48px_-12px_rgba(0,0,0,0.28)] flex flex-col overflow-hidden"
          >
            <header className="flex items-center gap-2 px-4 h-[52px] border-b border-line flex-shrink-0">
              <span className={SWATCH} style={{ backgroundColor: editingFamilyPickerValue }} />
              <span className="flex-1 min-w-0 truncate text-sm font-semibold text-fg">{editingFamily.label}</span>
              {/* Theme Preview's neutral picker follows the hub appearance with
                  no local toggle — match that for the previewed theme's gray. */}
              {!editingNeutralCoordinated && (
              <div className="flex flex-shrink-0 rounded-md border border-line overflow-hidden" role="group" aria-label="Preview appearance">
                {(['light', 'dark'] as const).map((mode) => {
                  const on = editAppearance === mode
                  const bg = mode === 'dark' ? darkBackground : pageBackground
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setEditAppearance(mode)}
                      aria-pressed={on}
                      className={`px-2 py-1 text-mini font-medium capitalize transition-colors ${on ? '' : 'bg-surface text-fg-muted hover:text-fg'}`}
                      style={on ? { backgroundColor: bg, color: readableInk(bg) } : undefined}
                    >
                      {mode}
                    </button>
                  )
                })}
              </div>
              )}
              <span className="text-caption font-mono tabular-nums text-fg-faint flex-shrink-0">{editingFamilyPickerValue.toUpperCase()}</span>
              <button
                type="button"
                aria-label="Close"
                title="Close"
                onClick={() => setEditFamily(null)}
                className="ml-1 text-fg-faint hover:text-fg transition-colors w-6 h-6 flex items-center justify-center flex-shrink-0"
              >
                <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M10 2 2 10M2 2l8 8" />
                </svg>
              </button>
            </header>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain scrollbar-always p-4">
              <ColorPickerPanel
                value={editingFamilyPickerValue}
                onChange={(hex) => changeFamilyBase(editingFamily, hex)}
                suggestions
                palette={editingUsesNeutralPicker || editingUsesAccentPicker
                  ? []
                  : curatedPaletteFor(curatedPaletteKeyForFamily(editingFamily, themeSources))}
                dynamicNeutralPalette={editingUsesNeutralPicker}
                dynamicAccentPalette={editingUsesAccentPicker}
                neutralRampFrom={editingUsesNeutralPicker ? pickerThemeAccent : undefined}
                followAccent={editingUsesAccentPicker}
                appearance={editingPickerAppearance}
                fieldAppearance={editingPickerAppearance}
              />
            </div>
          </motion.div>
        </AnimatePresence>,
        document.body,
      )
    : null

  // ── Token Details dialog (one tone of the active family) ──
  // "Reset" means: put this tone back to what the generator produces for the
  // family's own base — the primitives' equivalent of Semantics' "reset to
  // the recommended tone". Computed from the SAME generators the family was
  // built with (neutral has its own dark builder), so a reset can't disagree
  // with what editing the family colour would produce.
  const standardScales = useMemo(() => {
    try {
      // "Reset to standard" has to reproduce what the APPLIERS produce, so the
      // neutral's two ramps take the tint exactly the way `useApplyGrayColor`
      // passes it — otherwise Reset would quietly hand back the untinted curve
      // and read as a bug the moment the tint is Tinted/Vivid.
      const pages = family.customKey
        ? resolveFamilyPages(useDesignStore.getState(), family.customKey)
        : { light: pageBackground, dark: darkBackground, isGray: family.key === 'neutral' }
      const isNeutral = family.key === 'neutral' || pages.isGray
      return {
        light: generateColorScale(family.base, colorAlgorithm, contrastShift, pages.light, 'light', isNeutral ? neutralTint : undefined),
        dark: isNeutral
          ? generateDarkColorScale(family.base, colorAlgorithm, contrastShift, pages.dark, neutralTint)
          : generateFamilyDarkScale(family.base, colorAlgorithm, contrastShift, pages.dark),
      }
    } catch {
      return null
    }
  }, [family.base, family.key, family.customKey, colorAlgorithm, contrastShift, pageBackground, darkBackground, neutralTint])

  const detailsModal = !family.isAlpha && expandedTone != null ? (() => {
    const tone = expandedTone
    const name = rowName(tone)
    const modesByAppearance = {
      light: { key: 'light' as const, value: family.light[tone] ?? '#ffffff', std: standardScales?.light[tone], set: (hex: string) => setTone(family.light, family.setLight, tone, hex) },
      dark: { key: 'dark' as const, value: family.dark[tone] ?? '#000000', std: standardScales?.dark[tone], set: (hex: string) => setTone(family.dark, family.setDark, tone, hex) },
    }
    const modes = appearanceColumns.map((appearance) => modesByAppearance[appearance])
    const modified = modes.some((m) => m.std && m.value.toLowerCase() !== m.std.toLowerCase())
    return (
      <TokenDetailsModal
        key={`${family.key}-${tone}`}
        name={name}
        // Matches what `exporters.ts` actually emits for a primitive
        // (`--color-accent-9`), so the chip is copy-pasteable as-is.
        cssVarName={`color-${name}`}
        description={toneDescription(tone)}
        onReset={() => modes.forEach((m) => { if (m.std) m.set(m.std) })}
        resetDisabled={!modified}
        onClose={() => setExpandedTone(null)}
        reduce={reduce}
        anchorRef={tableRef}
        initialOpenKey={detailMode}
        // One collapsible card per appearance, first open — the same shape
        // Semantics' modes use. Collapsed peers are what make stacking full
        // HSV pickers affordable here: only the mode you opened is tall.
        sections={modes.map((m) => ({
          key: m.key,
          label: m.key,
          kind: m.key,
          content: <ColorPickerPanel value={m.value} onChange={m.set} />,
        }))}
      />
    )
  })() : null

  const gridStyle = PRIMITIVE_TABLE_GRID

  return (
    // No enter animation on the tab panel itself. The three Color tabs now
    // share an identical three-row chrome, and `centerKey` (Configurator) is
    // `f-color` for all of them — so the OUTER fade only fires when you switch
    // foundations, which is what should animate. Animating here too made the
    // rail, strip and header fade+slide 12px on every tab click even though
    // they render in the same place: the chrome appeared to jump while only
    // the content had actually changed.
    <div className="h-full flex flex-col">
      {/* ── Body: folders flush under Groups; tabs · ramp · table on the right ── */}
      <div className="flex flex-1 min-h-0 items-stretch">
      <VariableCollectionRail navRef={navRef} collapsed={railCollapsed} ariaLabel="Color collections and groups">
        {railCollapsed ? (
          <div className="relative flex items-center justify-center pb-3 mb-1 border-b border-line">
            <FamilySwatch
              family={family}
              dark={darkPreview}
              onClick={family.isAlpha ? undefined : openFamilyEdit}
            />
          </div>
        ) : null}
        {railCollapsed ? (
          visibleNavFolders.flatMap((folder) => folder.groups).map((group, gi) => (
            <div key={`${group.label}-${gi}`} className="flex flex-col items-center gap-0.5">
              {gi > 0 && <span className="w-6 h-px bg-line my-1.5 flex-shrink-0" aria-hidden />}
              {group.items.map((f) => {
                const isActive = family.key === f.key
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => { setActiveFamily(f.key); setExpandedTone(null) }}
                    aria-current={isActive}
                    title={`${f.label}${f.isAlpha ? '' : ` — ${f.base}`}`}
                    aria-label={f.label}
                    className={`${COLLAPSED_RAIL_WELL} rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg ${
                      isActive ? 'bg-elevated shadow-sm' : 'hover:bg-elevated/50'
                    }`}
                  >
                    <FamilySwatch family={f} dark={darkPreview} />
                  </button>
                )
              })}
            </div>
          ))
        ) : (
        visibleNavFolders.map((folder) => {
          const folderCollapsed = managedThemesExternally && folder.key === BASE_FOLDER ? false : collapsedGroups.has(folder.key)
          const folderPreviewed = folderThemeKey(folder.key) === previewTheme
          const fixedFolder = managedThemesExternally && folder.key === BASE_FOLDER
          return (
          <div key={folder.key} className="flex flex-col">
            {/* Theme folder — the outer level. Its Accents/Neutrals/States sit
                inside it, so a second theme's families never mix with the
                base palette's. */}
            {/* A THEME folder (not Base, not Custom) can be deleted from here
                — see `themeToDelete`. The trash is hover-only so the rail stays
                quiet, but it's always reachable by keyboard.
                No `pr-*` on this wrapper: a reserved right gutter for the trash
                button used to sit here unconditionally, so on Theme 1/Custom
                (which never render it) the folder's own chevron landed ~7px
                left of its child groups' chevrons — the base folder and its
                Accents/Neutrals/States rows read as two different right edges
                in one tree. Both the folder button and the group button below
                already carry their own `px-2.5`, so with no extra wrapper
                padding their trailing chevrons share the exact same inset
                from the nav's edge. When the trash button DOES render, `gap-1`
                alone separates it from the label — same flush-right pattern
                every other trailing icon in this nav already uses. */}
            {/* `fixedFolder` (the Themes workspace's single "System colors"
                wrapper) renders NO header: it was a non-interactive row —
                `onClick` undefined, `tabIndex={-1}`, no chevron, only ever ONE
                of them — so it added a nesting level without adding
                information, exactly the `hideHeader` case the Custom group
                already handles. Its Accents / Neutrals / States groups render
                directly under the section's own "Groups" heading. */}
            {!fixedFolder && (
            <div className="group/folder relative flex items-center w-full">
            <button
              type="button"
              onClick={() => { toggleFolderExclusive(folder.key); if (!managedThemesExternally) selectFolderTheme(folder.key) }}
              aria-expanded={!folderCollapsed}
              aria-current={folderPreviewed ? 'true' : undefined}
              title={folderPreviewed ? `${folder.label} — shown in preview` : folderThemeKey(folder.key) ? `Preview the ${folder.label} theme` : undefined}
              className={`w-full flex items-center gap-1.5 pl-2.5 pr-8 pt-2.5 pb-1 text-body font-semibold transition-colors ${
                folderPreviewed ? 'text-accent-ui' : 'text-fg-muted hover:text-fg'
              }`}
            >
              <span className="flex-shrink-0 flex items-center">
                {folderPreviewed ? <EyeIcon active /> : <FolderIcon size={12} />}
              </span>
              <span className="flex-1 text-left truncate">{folder.label}</span>
            </button>
            <div className="absolute right-2.5 top-0 bottom-0 flex items-center gap-1.5 pointer-events-none">
              {!managedThemesExternally && folder.key !== BASE_FOLDER && folder.key !== CUSTOM_FOLDER && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setThemeToDelete(folder.key)
                  }}
                  aria-label={`Delete theme ${folder.label}`}
                  title={`Delete the ${folder.label} theme — its color families stay, and move to Custom`}
                  className="pointer-events-auto flex-shrink-0 w-5 h-5 flex items-center justify-center rounded text-fg-faint hover:text-status-danger hover:bg-status-danger/10 opacity-0 group-hover/folder:opacity-100 focus-visible:opacity-100 transition-all"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  </svg>
                </button>
              )}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={`flex-shrink-0 transition-transform ${folderCollapsed ? '-rotate-90' : ''}`}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
            </div>
            )}
            <AnimatePresence initial={false}>
              {!folderCollapsed && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  style={{ overflow: 'hidden' }}
                >
        {folder.groups.map((group) => {
          const groupKey = `${folder.key}/${group.label}`
          const collapsed = collapsedGroups.has(groupKey)
          // The Custom folder's only group IS "Custom" — a second header
          // repeating the folder's own name adds a level without adding
          // information, so it renders its families directly.
          const hideHeader = folder.key === CUSTOM_FOLDER
          return (
            <div key={groupKey} className={`flex flex-col gap-0.5 ${fixedFolder ? '' : 'pl-2'}`}>
            {!hideHeader && (
            <button
              type="button"
              onClick={() => toggleGroup(groupKey)}
              aria-expanded={!collapsed}
              className="flex items-center gap-1.5 px-2.5 pt-2.5 pb-1 text-caption font-semibold text-fg-faint hover:text-fg-muted transition-colors"
            >
              <FolderIcon size={11} />
              <span className="flex-1 text-left">{group.label}</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={`flex-shrink-0 transition-transform ${collapsed ? '-rotate-90' : ''}`}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            )}
            <AnimatePresence initial={false}>
              {(!collapsed || hideHeader) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  style={{ overflow: 'hidden' }}
                >
            {group.items.map((f) => {
              const isActive = family.key === f.key
              return (
                <div key={f.key} className="relative group/fam" ref={editFamily === f.key ? editRef : undefined}>
                  {/* Was one `<button>` wrapping the swatch + label — the swatch
                      is now its own button (opens the picker directly, see
                      `FamilySwatch`), and a button can't nest another button.
                      Split into two siblings sharing the same row styling
                      instead: the swatch button, then the label as the
                      "select this family" trigger. */}
                  <div
                    aria-current={isActive}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors ${f.customKey ? 'pr-12' : 'pr-7'} ${
                      isActive ? 'bg-elevated text-fg shadow-sm' : 'text-fg-muted hover:bg-elevated/50 hover:text-fg'
                    }`}
                  >
                    <FamilySwatch
                      family={f}
                      dark={darkPreview}
                      onClick={() => { setActiveFamily(f.key); setEditFamily((k) => (k === f.key ? null : f.key)) }}
                    />
                    <button
                      type="button"
                      onClick={() => { setActiveFamily(f.key); setExpandedTone(null) }}
                      className="flex-1 min-w-0 text-left"
                    >
                      <span className="block truncate text-ui font-medium">{f.label}</span>
                    </button>
                  </div>
                  {/* Edit — stays visible on the active row so the affordance is
                      findable without hunting for it on hover. Not offered for
                      Accent-Alpha: it's derived (see AlphaHexCell), nothing to
                      retint independently. */}
                  {!f.isAlpha && (
                    <button
                      onClick={() => { setActiveFamily(f.key); setEditFamily((k) => (k === f.key ? null : f.key)) }}
                      aria-haspopup="dialog"
                      aria-expanded={editFamily === f.key}
                      aria-label={`Edit ${f.label} color`}
                      title={`Edit ${f.label} — ${f.base}`}
                      className={`absolute ${f.customKey ? 'right-7' : 'right-1.5'} top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-fg-faint hover:text-fg hover:bg-elevated transition-all ${
                        isActive || editFamily === f.key ? 'opacity-100' : 'opacity-0 group-hover/fam:opacity-100 focus-visible:opacity-100'
                      }`}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                    </button>
                  )}
                  {f.customKey && (() => {
                    // A theme resolves THROUGH its families, so one in use can't
                    // be deleted — say so on the control instead of leaving a
                    // button that silently does nothing.
                    const usedBy = themesUsingFamily(f.customKey, themeSources)
                    return (
                      <button
                        onClick={() => {
                          if (usedBy.length) return
                          removeCustomColor(f.customKey!)
                          if (isActive) setActiveFamily('accent')
                        }}
                        disabled={usedBy.length > 0}
                        aria-label={usedBy.length ? `${f.label} is used by ${usedBy.join(', ')}` : `Remove ${f.label}`}
                        title={
                          usedBy.length
                            ? `In use by ${usedBy.length === 1 ? 'theme' : 'themes'} ${usedBy.join(', ')} — remove the ${usedBy.length === 1 ? 'theme' : 'themes'} first`
                            : `Remove ${f.label}`
                        }
                        className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full transition-all ${
                          usedBy.length
                            ? 'text-fg-faint opacity-0 group-hover/fam:opacity-60 cursor-not-allowed'
                            : 'text-fg-faint hover:text-status-danger hover:bg-status-danger/10 opacity-0 group-hover/fam:opacity-100'
                        }`}
                      >
                        {usedBy.length ? (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <rect x="4" y="11" width="16" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
                          </svg>
                        ) : (
                          <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M10 2 2 10M2 2l8 8" /></svg>
                        )}
                      </button>
                    )
                  })()}
                  <AnimatePresence>
                    {/* The picker itself is NOT rendered here — it's portaled
                        to <body> once, below. See `editPortal`. */}
                  </AnimatePresence>
                </div>
              )
            })}
                </motion.div>
              )}
            </AnimatePresence>
            </div>
          )
        })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          )
        })
        )}
        {!railCollapsed && !managedThemesExternally && (
          <button
            type="button"
            onClick={() => setAddThemeOpen((v) => !v)}
            aria-haspopup="dialog"
            aria-expanded={addThemeOpen}
            className="mt-2 mx-2 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-line-strong px-2.5 py-2 text-body font-medium text-fg-faint hover:text-fg hover:border-fg-faint hover:bg-elevated/40 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="flex-shrink-0">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New theme
          </button>
        )}
      </VariableCollectionRail>

      <div className="flex-1 min-w-0 flex flex-col bg-app min-h-0">
        <div ref={tableRef} className="flex-1 min-w-0 overflow-auto">
            <div className="min-w-[24rem]">
              {/* Column header first — this 52px band is the one that lines
                  up with “Color variables” in the rail, same as Radius's
                  TOKEN NAME row. Sticky at top-0 so scrolling the tones
                  never hides the eye toggles, per-column export, or the
                  settings gear. */}
              <div
                className={tableHeaderClass('grid')}
                style={gridStyle}
              >
                <span className="flex items-center pl-4 border-r border-line">Primitive collection</span>
                {appearanceColumns.map((col) => {
                  const isPreviewed = activeAppearance === col
                  return (
                    <span key={col} className={`flex items-center px-2.5 border-r border-line min-w-0 ${isPreviewed ? 'bg-accent-ui/[0.06]' : ''}`}>
                      <button
                        onClick={() => onPreviewAppearanceChange?.(col)}
                        aria-pressed={isPreviewed}
                        title={isPreviewed ? `${col} — shown in preview` : `Show ${col} in the preview`}
                        className={`flex items-center gap-1.5 flex-1 min-w-0 px-1.5 py-1 rounded-md transition-colors ${
                          isPreviewed ? 'text-accent-ui' : 'text-fg-faint hover:text-fg-muted hover:bg-elevated/50'
                        }`}
                      >
                        <EyeIcon active={isPreviewed} />
                        <span className="truncate">{col}</span>
                      </button>
                      {/* Export lives per COLUMN, not per table: an icon here
                          can only mean "this family, this appearance", which
                          is exactly the scope a ramp is useful in. Offered on
                          alpha families too now — `ColumnExportMenu` routes
                          them through `buildAlphaFamilyExport` (reads
                          `colors.primitiveAlpha`) instead of the solid-primitive
                          pipeline, and narrows the format list to what that
                          builder can produce correctly (see
                          `ALPHA_EXPORT_FORMATS`). */}
                      <ColumnExportMenu
                        family={family.tokenPrefix}
                        label={family.label}
                        appearance={col}
                        isAlpha={family.isAlpha}
                        scale={col === 'light' ? family.light : family.dark}
                      />
                    </span>
                  )
                })}
                <span className="flex items-center justify-center py-3 text-fg-faint" aria-hidden>
                  <SlidersIcon />
                </span>
              </div>
              {/* Quick-edit strip sits UNDER the column header, still inside
                  the scroll surface so it pins below TOKEN NAME (`top` =
                  the 52px header) rather than covering it. Isolate keeps
                  the tone-9 anchor ring from painting over the header
                  when overview ramps scroll underneath. */}
              <div
                className="sticky z-20 flex items-center gap-2.5 pl-4 pr-3 border-b border-line bg-app isolate"
                style={{ height: QUICK_EDIT_STRIP_HEIGHT, top: TABLE_HEADER_PX, paddingTop: QUICK_EDIT_STRIP_PAD, paddingBottom: QUICK_EDIT_STRIP_PAD }}
              >
          {!railCollapsed && (
            family.isAlpha ? (
              <div className="flex-shrink-0 h-9 px-1.5 rounded-[10px] border border-line bg-surface flex items-center">
                <AlphaHexCell
                  compact
                  value={(darkPreview ? family.dark[BASE_TONE] : family.light[BASE_TONE]) ?? '#000000'}
                  solid={(darkPreview ? family.solidDark : family.solidLight)?.[BASE_TONE]}
                  solidName={solidRowName(BASE_TONE)}
                  appearance={darkPreview ? 'dark' : 'light'}
                />
              </div>
            ) : (
              <div className="relative flex-shrink-0">
                <div className="h-9 flex items-stretch rounded-[10px] border border-line bg-surface overflow-hidden">
                  <div className="flex items-center pl-1.5 pr-0.5">
                    <HexCell
                      compact
                      value={family.base}
                      onChange={(hex) => changeFamilyBase(family, hex)}
                      ariaLabel={`${family.label} base color`}
                      onSwatchClick={openFamilyEdit}
                      swatchLabel={`Open color picker for ${family.label}`}
                    />
                  </div>
                  {(() => {
                    const def = defaultBaseFor(family)
                    if (!def) return null
                    const atDefault = family.base.toLowerCase() === def.toLowerCase()
                    return (
                      <>
                        <span className="w-px self-stretch bg-line my-1.5 flex-shrink-0" aria-hidden />
                        <button
                          type="button"
                          onClick={() => changeFamilyBase(family, def)}
                          disabled={atDefault}
                          aria-label={`Reset ${family.label} to the default color`}
                          title={atDefault ? `${family.label} is at its default (${def})` : `Reset to default (${def})`}
                          className="flex-shrink-0 w-7 flex items-center justify-center text-fg-muted hover:text-fg hover:bg-elevated disabled:opacity-35 disabled:hover:text-fg-muted disabled:hover:bg-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-fg"
                        >
                          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M2.5 7a4.5 4.5 0 1 0 1.3-3.2M3.5 1.5v2.4h2.4" />
                          </svg>
                        </button>
                      </>
                    )
                  })()}
                </div>
              </div>
            )
          )}
          <div className="flex-1 min-w-0 overflow-hidden">
            <ScaleRow
              scale={darkPreview ? family.dark : family.light}
              labels={namingLabels}
              ariaLabel={`${family.label} scale`}
              joined
              numbersInside
              size="md"
              checkerboard={family.isAlpha}
              checkerAppearance={darkPreview ? 'dark' : 'light'}
            />
          </div>
          <div ref={settingsAnchorRef} className="relative flex-shrink-0">
            <ColorAgentButton
              active={settingsOpen}
              onClick={() => setSettingsOpen((o) => !o)}
              aria-haspopup="dialog"
              aria-expanded={settingsOpen}
              aria-label="Color Agent"
              title="Color Agent"
              className="h-9 w-9"
            >
              <SparkleCircleIcon />
            </ColorAgentButton>
            <ScaleSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} anchorRef={settingsAnchorRef}>
              <ColorControls
                contrastShift={contrastShift}
                onShift={setContrastShift}
                accentHex={primaryColor}
                appearance={darkPreview ? 'dark' : 'light'}
                onPickAccent={(hex) => {
                  setLinkNeutralToAccent(true)
                  setLinkStatesToAccent(true)
                  applyAccentColor(hex, true, previewTheme)
                }}
                neutralTint={neutralTint}
                onTint={(t) => {
                  setNeutralTint(t)
                  applyGrayColor(linkNeutralToAccent ? neutralFromBrand(primaryColor, t) : grayBaseColor, previewTheme, true)
                }}
                tintPreview={(t) => backgroundFromBase(grayBaseColor, darkPreview ? 'dark' : 'light', t)}
                linkNeutral={linkNeutralToAccent}
                onLinkNeutral={(v) => {
                  setLinkNeutralToAccent(v)
                  if (v) applyGrayColor(neutralFromBrand(primaryColor, neutralTint), previewTheme, true)
                }}
                linkedNeutralPreview={neutralFromBrand(primaryColor, neutralTint)}
                linkStates={linkStatesToAccent}
                onLinkStates={(v) => {
                  setLinkStatesToAccent(v)
                  if (v) {
                    applyStateColor('error', stateRecommendation.error, true, previewTheme)
                    applyStateColor('warning', stateRecommendation.warning, true, previewTheme)
                    applyStateColor('success', stateRecommendation.success, true, previewTheme)
                    applyStateColor('info', stateRecommendation.info, true, previewTheme)
                  }
                }}
                linkedStatesPreview={stateRecommendation}
              />
            </ScaleSettingsModal>
          </div>
              </div>

              {visibleTones.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-fg-faint">No tokens match “{query}”.</div>
              ) : (
                visibleTones.map((tone, i) => {
                  const name = rowName(tone)
                  const expanded = expandedTone === tone
                  return (
                    <div
                      key={tone}
                      className={tableRowClass(i, 'grid')}
                      style={gridStyle}
                    >
                        <div className="flex items-center gap-2 py-2.5 pl-4 pr-3 min-w-0 border-r border-line text-fg-faint">
                          <PaletteIcon size={14} />
                          <code className="font-mono text-body text-fg-muted truncate">{name}</code>
                          {tone === BASE_TONE && (
                            <span className="text-nano font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-elevated text-fg-faint flex-shrink-0">anchor</span>
                          )}
                        </div>
                        {appearanceColumns.map((appearance) => {
                          const scale = appearance === 'light' ? family.light : family.dark
                          const solid = appearance === 'light' ? family.solidLight : family.solidDark
                          const setScale = appearance === 'light' ? family.setLight : family.setDark
                          return (
                            <div key={appearance} className="flex items-center px-2.5 py-1.5 border-r border-line min-w-0">
                              {family.isAlpha ? (
                                <AlphaHexCell
                                  value={scale[tone] ?? '#00000000'}
                                  solid={solid?.[tone]}
                                  solidName={solidRowName(tone)}
                                  appearance={appearance}
                                />
                              ) : (
                                <HexCell
                                  value={scale[tone] ?? (appearance === 'light' ? '#ffffff' : '#000000')}
                                  onChange={(hex) => setTone(scale, setScale, tone, hex)}
                                  ariaLabel={`${name} ${appearance} value`}
                                  // The swatch opens the SAME Token Details
                                  // dialog the trailing sliders icon does, on
                                  // THIS appearance — a colour chip that looks
                                  // clickable and isn't reads as broken (the
                                  // hex text stays directly editable either
                                  // way). Matches the quick-edit strip's
                                  // swatch, which already opens the family
                                  // picker on click.
                                  onSwatchClick={() => {
                                    setDetailMode(appearance)
                                    setExpandedTone(tone)
                                  }}
                                  swatchLabel={`Open token details for ${name} (${appearance})`}
                                />
                              )}
                            </div>
                          )
                        })}
                        {family.isAlpha ? (
                          // Derived, not editable — see AlphaHexCell.
                          <div aria-hidden className="flex items-center justify-center w-full h-full text-fg-faint/40">
                            <SlidersIcon />
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setDetailMode(activeAppearance)
                              setExpandedTone((cur) => (cur === tone ? null : tone))
                            }}
                            aria-haspopup="dialog"
                            aria-expanded={expanded}
                            aria-label={`Open token details for ${name}`}
                            title="Token details"
                            className={`flex items-center justify-center w-full h-full transition-colors ${
                              expanded ? 'text-accent-ui' : 'text-fg-faint hover:text-fg'
                            }`}
                          >
                            <SlidersIcon />
                          </button>
                        )}
                    </div>
                  )
                })
              )}

              <FamilyRampOverview groups={overviewGroups} activeKey={family.key} namingLabels={namingLabels} />
            </div>
        </div>
      </div>
      </div>

      {/* Per-family colour picker — portaled out of the nav so the rail's
          scroll mask can't clip it (see `editRect`). Rendered once for
          whichever family is being edited, not per row. */}
      {editPortal}

      {/* Token Details — the SAME dialog Semantics' rows open (see
          colorControls' TokenDetailsModal), not an inline row expansion. */}
      <AnimatePresence>{detailsModal}</AnimatePresence>

      {/* Same confirmation Semantics' column header uses (shared from
          colorControls) — one destructive action, one warning. */}
      <AnimatePresence>
        {themeToDelete && (
          <DeleteThemeModal
            key="delete-theme"
            name={themeToDelete.charAt(0).toUpperCase() + themeToDelete.slice(1)}
            isPreviewed={previewTheme === themeToDelete}
            onCancel={() => setThemeToDelete(null)}
            onConfirm={() => {
              // Re-point the preview before the column disappears, exactly as
              // Semantics' deleteTheme does.
              if (previewTheme === themeToDelete) {
                const next = themeOrder.find((t) => t !== themeToDelete)
                if (next) onPreviewThemeChange?.(next)
              }
              removeTheme(themeToDelete)
              setThemeToDelete(null)
            }}
          />
        )}
      </AnimatePresence>

      {/* The ONE theme panel — same component, same docked position, whether
          it's opened from here or from Semantics' `+` / column pencil. */}
      {!managedThemesExternally && <ThemePanel
        open={addThemeOpen}
        onClose={() => setAddThemeOpen(false)}
        appearance={darkPreview ? 'dark' : 'light'}
        railCollapsed={railCollapsed}
        onCreated={(key) => { onPreviewThemeChange?.(key); setAddThemeOpen(false) }}
      />}
    </div>
  )
}
