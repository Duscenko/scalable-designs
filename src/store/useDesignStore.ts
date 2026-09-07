import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { COMPONENT_KEYS, ESSENTIAL_COMPONENT_KEYS } from '../lib/componentCatalogue'
import { FONT_SIZE_STANDARD, LINE_HEIGHT_STANDARD, FONT_WEIGHT_STANDARD, TYPE_SCALE_KEYS, TYPE_SCALE_MODES, buildTypeScale } from '../lib/typographyStandard'
import { mergeTypeRoles, type TypeRoleModes } from '../lib/typeRoles'
import {
  PADDING_STANDARD,
  RADIUS_STANDARD,
  SIZE_STANDARD,
  SELECTOR_STANDARD,
  SPACING_STANDARD,
  STROKE_STANDARD,
  GRID_STANDARD,
  GRID_FRAME_STANDARD,
  defaultLayoutRoles,
  mergeLayoutRoles,
  mergeGridFrame,
  applyDesktopFrameToGrid,
  nearestSpacingStep,
  scaleRadiusFromLg,
  SPACING_STEPS,
  BREAKPOINT_STEPS,
  breakpointKey,
  completeRadiusScale,
  isGradedRadiusRamp,
  radiusRolesAreLegacyDefault,
  LEGACY_RADIUS_ROLE_RUNGS,
  LEGACY_RADIUS_LG_FACTOR,
  type GridFrameModes,
} from '../lib/layoutTokens'
import type { PhosphorWeight } from '../lib/phosphorIcons'
import { DEFAULT_NEUTRAL_TINT, neutralFromBrand, recommendStateColors, type ColorAlgorithm, type ColorNaming, type NeutralTint } from '../lib/colorUtils'
import { accessibleSolidTone, generateColorScale, generateFamilyDarkScale, generateDarkColorScale } from '../lib/colorUtils'
import {
  type GradientDef, type GradientAssignments,
  makeDefaultGradients, makeDefaultGradientAssignments,
  brandCoverStops, brandAvatarStops, stopsMatch, derivedStopsFor, linkedStopsFor,
  LEGACY_MOSS_GLOW_STOPS,
} from '../lib/gradients'
import { slugify } from '../lib/utils'
import { generatePublishId, isPublishId } from '../lib/publishId'
// Type-only: semanticArchitectures imports semanticRoles (which imports this
// store's constants), so a value import here would create a runtime cycle.
import type { SemanticArchitecture } from '../lib/semanticArchitectures'
import { aiSourceFromLegacyLibrary, type IconAiSourceKey } from '../lib/iconLibraries'
import { themeModeKey, type ThemeAppearance, type ThemeSemanticModes } from '../lib/themeModes'
import type { ThemeFoundationOverride } from '../lib/themeFoundations'

interface ColorScale {
  [key: number]: string // 1–12 tones
}

// A user-defined color family: named, with an auto-generated 1–12 scale that
// adapts to the same structure as brand/error/warning/success/info.
export interface CustomColor {
  key: string // slug — unique, used as the token prefix (e.g. "teal" → teal-1…12)
  label: string // display name
  base: string // hex the scale derives from (tone 6)
  scale: ColorScale
  /** Dark-appearance twin, anchored to `darkBackground` (Radix ships every
   *  colour as two scales). Optional only for forward-compat with pre-v40
   *  snapshots — `useEnsureColorScales` backfills it. */
  darkScale?: ColorScale
}

// Family names reserved by the built-in scales — custom colors can't use them.
export const RESERVED_COLOR_KEYS = ['accent', 'neutral', 'error', 'warning', 'success', 'info']

// Per-theme primitive palette — a custom "style theme" carries its own 1–12
// scales (brand/neutral/semantic) instead of drawing from the global ones. The
// built-in light/dark themes have NO entry here and fall back to the globals.
/**
 * A theme's RESOLVED ramps — what `sourceScaleFor` reads. Always derived, never
 * persisted: see `ThemeSources`.
 */
export interface ThemePalette {
  brand: ColorScale
  gray: ColorScale
  error: ColorScale
  warning: ColorScale
  success: ColorScale
  info: ColorScale
}

/**
 * A theme's colour SOURCES — which primitive family each slot resolves through.
 * Values are family KEYS ('accent' | 'neutral' | 'error' | 'success' |
 * 'warning' | 'info' | a `customColors` key), never raw scales.
 *
 * This is the "a theme is a reading of the primitives" rule enforced at the data
 * model: a theme cannot hold a colour of its own, so it can't drift from the
 * family it points at — retint the family and every theme referencing it moves
 * with it. Creating a theme with a new colour therefore CREATES that family in
 * Primitives (see `AddThemeModal`), and a family in use can't be deleted.
 */
export interface ThemeSources {
  brand: string
  gray: string
  error: string
  warning: string
  success: string
  info: string
}

export const DEFAULT_THEME_SOURCES: ThemeSources = {
  brand: 'accent', gray: 'neutral', error: 'error',
  warning: 'warning', success: 'success', info: 'info',
}

interface TypographyTokens {
  fontFamily: string
  headingFontFamily: string
  sizes: Record<string, string>
  lineHeights: Record<string, string>
  weights: Record<string, number>
  /** Text roles aliasing the primitive scale, with Desktop and Mobile mappings. */
  roles: Record<string, TypeRoleModes>
}

// ── Fixed neutral scales from the Figma design system ─────────────────────
export const GRAY_LIGHT_SCALE: ColorScale = {
  1: '#fdfdfd', 2: '#fafafa', 3: '#f5f5f5',  4: '#e9eaeb',
  5: '#d5d7da', 6: '#a4a7ae', 7: '#717680',  8: '#535862',
  9: '#414651', 10: '#252b37', 11: '#181d27', 12: '#0a0d12',
}

// LEGACY — pre-Radix-model ramp, mirrored the wrong way (tone 1 = light,
// tone 12 = `darkBackground`) from back when dark themes read this single
// fixed constant instead of generating their own ramp (see the v31→v32
// migration below). Keep it EXACTLY as-is: its only remaining job is seeding
// that one migration so genuinely pre-v32 localStorage keeps the dark it
// already had. Nothing else should read it — see DEFAULT_GRAY_DARK_SCALE.
export const GRAY_DARK_SCALE: ColorScale = {
  1: '#fafafa', 2: '#f7f7f7', 3: '#f0f0f1',  4: '#ececed',
  5: '#cecfd2', 6: '#94979c', 7: '#85888e',  8: '#61656c',
  9: '#373a41', 10: '#22262f', 11: '#13161b', 12: '#0c0e12',
}

// The CURRENT model's dark neutral ramp for the default accent/gray/darkBackground
// — tone 1 IS darkBackground (identity, matching generateColorScale's own dark
// ramps), computed with the real generator so it can't drift from what editing
// the gray color would actually produce. Used as the default for fresh systems
// and as the live fallback wherever `grayDarkScale` is unexpectedly missing —
// GRAY_DARK_SCALE above stayed the wrong (inverted) ramp for both of those until
// now, which is why a brand-new system's dark mode could render backwards
// (tone 1 near-white) for anyone who reached Alias/Semantics or previewed dark
// before ever editing a color primitive.
export const DEFAULT_GRAY_DARK_SCALE: ColorScale = generateDarkColorScale('#6c737f', 'radix', 0, '#0c0e12')
// The default accent's ramp, computed by the real generator at module load for
// the same reason DEFAULT_GRAY_DARK_SCALE is: it seeds the built-in gradients'
// tone-backed stops (see makeDefaultGradients), so a brand-new system's
// "linked to accent" gradients reference real primitives from the first render
// instead of loose hex. Generated HERE, not inside lib/gradients.ts — that
// module is deliberately dependency-free, and importing the generator there
// created an init-order cycle (makeDesignDefaults() runs at import time and
// found generateColorScale still undefined).
/** The platform's default accent — Core blue, matching the Core / Minimalist
 *  preset. Exported so "reset to defaults" and the new-system dialog derive
 *  their blue from the SAME constant `makeDesignDefaults` seeds. */
export const DEFAULT_ACCENT = '#2970ff'
export const DEFAULT_ACCENT_SCALE: ColorScale = generateColorScale(DEFAULT_ACCENT, 'radix', 0, '#ffffff')
// The same ramp's DARK twin, for the same reason: a linked gradient stop is one
// `tone` reference resolved into BOTH appearances, so a brand-new system's
// gradients carry a dark version from the first render rather than rendering
// their light hexes on the dark page until the first accent edit.
export const DEFAULT_ACCENT_DARK_SCALE: ColorScale = generateFamilyDarkScale('#2970ff', 'radix', 0, '#0c0e12')
// ──────────────────────────────────────────────────────────────────────────

// Semantic role keys, seeded empty. Shared by the light (semanticTokens) and
// dark (darkSemanticTokens) maps so both stay in sync as roles are added.
// Old (v23) → new (v24) semantic-token key map. Single source of truth for the
// readable-taxonomy rename: the v23→v24 migration relabels persisted theme
// values without losing any user customisation. Append-only — never reorder.
export const SEMANTIC_KEY_RENAME: Record<string, string> = {
  // ── Surface (was bg-* neutral surfaces + states) ──
  'bg-primary': 'surface-0', 'bg-primary_alt': 'surface-0-alt', 'bg-primary_hover': 'surface-0-hover',
  'bg-secondary': 'surface-1', 'bg-secondary_alt': 'surface-1-alt', 'bg-secondary_hover': 'surface-1-hover',
  'bg-secondary_subtle': 'surface-1-subtle', 'bg-tertiary': 'surface-2', 'bg-quaternary': 'surface-3',
  'bg-active': 'surface-selected', 'bg-primary-solid': 'surface-inverse', 'bg-secondary-solid': 'surface-inverse-muted',
  'bg-overlay': 'surface-overlay',
  'bg-accent-primary': 'surface-brand-subtle', 'bg-accent-primary_alt': 'surface-brand-subtle-alt',
  'bg-accent-secondary': 'surface-brand-muted', 'bg-accent-section': 'surface-brand-strong',
  'bg-accent-section_subtle': 'surface-brand-strong-alt',
  // ── Action (was brand solid fills + disabled) ──
  'bg-accent-solid': 'action-primary', 'bg-accent-solid_hover': 'action-primary-hover',
  'bg-disabled': 'action-disabled', 'bg-disabled_subtle': 'action-disabled-subtle',
  // ── Status (was bg-{error,warning,success,info}-*) ──
  'bg-error-primary': 'status-error-subtle', 'bg-error-secondary': 'status-error-muted', 'bg-error-solid': 'status-error',
  'bg-warning-primary': 'status-warning-subtle', 'bg-warning-secondary': 'status-warning-muted', 'bg-warning-solid': 'status-warning',
  'bg-success-primary': 'status-success-subtle', 'bg-success-secondary': 'status-success-muted', 'bg-success-solid': 'status-success',
  'bg-info-primary': 'status-info-subtle', 'bg-info-secondary': 'status-info-muted', 'bg-info-solid': 'status-info',
  // ── Icon (was fg-*) ──
  'fg-primary': 'icon-primary', 'fg-secondary': 'icon-secondary', 'fg-secondary_hover': 'icon-secondary-hover',
  'fg-tertiary': 'icon-tertiary', 'fg-tertiary_hover': 'icon-tertiary-hover',
  'fg-quaternary': 'icon-quaternary', 'fg-quaternary_hover': 'icon-quaternary-hover',
  'fg-white': 'icon-on-inverse', 'fg-disabled': 'icon-disabled', 'fg-disabled_subtle': 'icon-disabled-subtle',
  'fg-accent-primary': 'icon-brand', 'fg-accent-primary_alt': 'icon-brand-alt',
  'fg-accent-secondary': 'icon-brand-secondary', 'fg-accent-secondary_alt': 'icon-brand-secondary-alt',
  'fg-error-primary': 'icon-error', 'fg-error-secondary': 'icon-error-secondary',
  'fg-warning-primary': 'icon-warning', 'fg-warning-secondary': 'icon-warning-secondary',
  'fg-success-primary': 'icon-success', 'fg-success-secondary': 'icon-success-secondary',
  'fg-info-primary': 'icon-info', 'fg-info-secondary': 'icon-info-secondary',
  // ── Text ──
  'text-secondary_hover': 'text-secondary-hover', 'text-tertiary_hover': 'text-tertiary-hover',
  'text-white': 'text-on-inverse', 'text-placeholder_subtle': 'text-placeholder-subtle',
  'text-primary_on-accent': 'text-on-brand', 'text-secondary_on-accent': 'text-on-brand-secondary',
  'text-tertiary_on-accent': 'text-on-brand-tertiary', 'text-quaternary_on-accent': 'text-on-brand-quaternary',
  'text-accent-primary': 'text-brand', 'text-accent-secondary': 'text-brand-secondary',
  'text-accent-secondary_hover': 'text-brand-secondary-hover', 'text-accent-tertiary': 'text-brand-tertiary',
  'text-accent-tertiary_alt': 'text-brand-tertiary-alt',
  'text-error-primary': 'text-error', 'text-warning-primary': 'text-warning',
  'text-success-primary': 'text-success', 'text-info-primary': 'text-info',
  // ── Border ──
  'border-primary': 'border-strong', 'border-secondary': 'border-default', 'border-secondary_alt': 'border-default-alt',
  'border-tertiary': 'border-subtle', 'border-disabled_subtle': 'border-disabled-subtle',
  'border-accent': 'border-brand', 'border-accent_alt': 'border-brand-alt', 'border-error_subtle': 'border-error-subtle',
  // (text-primary, text-secondary, text-tertiary, text-quaternary, text-disabled,
  //  text-placeholder, border-disabled, border-error — keys unchanged.)
}

/** Rename the keys of one semantic-token map old→new, preserving values. Idempotent. */
function renameSemanticKeys(map: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!map || typeof map !== 'object') return map
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(map)) out[SEMANTIC_KEY_RENAME[k] ?? k] = v as string
  return out
}

const EMPTY_SEMANTIC: Record<string, string> = {
  // ── Surface ───────────────────────────────────────────────
  'surface-0': '', 'surface-0-alt': '', 'surface-0-hover': '',
  'surface-1': '', 'surface-1-alt': '', 'surface-1-hover': '', 'surface-1-subtle': '',
  'surface-2': '', 'surface-3': '',
  'surface-selected': '', 'surface-inverse': '', 'surface-inverse-muted': '', 'surface-overlay': '',
  'surface-brand-subtle': '', 'surface-brand-subtle-alt': '', 'surface-brand-muted': '',
  'surface-brand-strong': '', 'surface-brand-strong-alt': '',
  // ── Action ────────────────────────────────────────────────
  'action-primary': '', 'action-primary-hover': '',
  'action-disabled': '', 'action-disabled-subtle': '',
  // ── Status ────────────────────────────────────────────────
  'status-error-subtle': '', 'status-error-muted': '', 'status-error': '',
  'status-warning-subtle': '', 'status-warning-muted': '', 'status-warning': '',
  'status-success-subtle': '', 'status-success-muted': '', 'status-success': '',
  'status-info-subtle': '', 'status-info-muted': '', 'status-info': '',
  // ── Text ──────────────────────────────────────────────────
  'text-primary': '', 'text-on-brand': '',
  'text-secondary': '', 'text-secondary-hover': '', 'text-on-brand-secondary': '',
  'text-tertiary': '', 'text-tertiary-hover': '', 'text-on-brand-tertiary': '',
  'text-quaternary': '', 'text-on-brand-quaternary': '',
  'text-on-inverse': '', 'text-disabled': '',
  'text-placeholder': '', 'text-placeholder-subtle': '',
  'text-brand': '',
  'text-brand-secondary': '', 'text-brand-secondary-hover': '',
  'text-brand-tertiary': '', 'text-brand-tertiary-alt': '',
  'text-error': '', 'text-warning': '', 'text-success': '', 'text-info': '',
  // ── Icon ──────────────────────────────────────────────────
  'icon-primary': '',
  'icon-secondary': '', 'icon-secondary-hover': '',
  'icon-tertiary': '', 'icon-tertiary-hover': '',
  'icon-quaternary': '', 'icon-quaternary-hover': '',
  'icon-on-inverse': '', 'icon-disabled': '', 'icon-disabled-subtle': '',
  'icon-brand': '', 'icon-brand-alt': '',
  'icon-brand-secondary': '', 'icon-brand-secondary-alt': '',
  'icon-error': '', 'icon-error-secondary': '',
  'icon-warning': '', 'icon-warning-secondary': '',
  'icon-success': '', 'icon-success-secondary': '',
  'icon-info': '', 'icon-info-secondary': '',
  // ── Border ────────────────────────────────────────────────
  'border-strong': '',
  'border-default': '', 'border-default-alt': '',
  'border-subtle': '',
  'border-disabled': '', 'border-disabled-subtle': '',
  'border-brand': '', 'border-brand-alt': '',
  'border-error': '', 'border-error-subtle': '',
}

// ── Default token sets for the Opacity / Shadow / Grid / Sizes foundations ──
export const OPACITY_DEFAULT: Record<string, string> = {
  '0': '0%', '5': '5%', '10': '10%', '20': '20%',
  '40': '40%', '60': '60%', '80': '80%', '100': '100%',
}

export const SHADOW_DEFAULT: Record<string, string> = {
  xs: '0 1px 2px rgba(10,13,18,0.05)',
  sm: '0 1px 3px rgba(10,13,18,0.10), 0 1px 2px -1px rgba(10,13,18,0.10)',
  md: '0 4px 6px -1px rgba(10,13,18,0.10), 0 2px 4px -2px rgba(10,13,18,0.06)',
  lg: '0 12px 16px -4px rgba(10,13,18,0.08), 0 4px 6px -2px rgba(10,13,18,0.03)',
  xl: '0 20px 24px -4px rgba(10,13,18,0.08), 0 8px 8px -4px rgba(10,13,18,0.03)',
  '2xl': '0 24px 48px -12px rgba(10,13,18,0.18)',
}

export const GRID_DEFAULT: Record<string, string> = { ...GRID_STANDARD }

export const SIZES_DEFAULT: Record<string, string> = { ...SIZE_STANDARD }
export const STROKE_DEFAULT: Record<string, string> = { ...STROKE_STANDARD }

// Surface padding — resolved px of spacing step 5 (20px on the 4px grid).
export const PADDING_DEFAULT: Record<string, string> = { ...PADDING_STANDARD }

// ── Multi design system ──────────────────────────────────────────────────────
// Everything needed to restore a design session. Excludes nav state,
// `projectCreated`, `savedSystems` itself, and the GitHub token (which lives
// only in localStorage 'sd-github-token' and must never enter a snapshot).
export interface DesignSnapshot {
  projectName: string
  projectDescription: string
  /** The system's STABLE publish identity — the `?project=` key `/api/tokens`
   *  is written to and the Figma plugin reads from. See `lib/publishId.ts` for
   *  why it exists: the key used to be `slugify(<Figma file name>)`, which
   *  defaults to the first theme's LABEL, so renaming a theme silently moved
   *  the publish target and left every connected plugin on a stale (or absent)
   *  blob.
   *
   *  `''` means "not minted yet" — every pre-v72 system, and every system
   *  reset to defaults. It is minted LAZILY, on the first publish
   *  (`ensurePublishId`), rather than in `makeDesignDefaults()`: that factory
   *  runs on every reset and at module load, and minting there would burn a
   *  fresh identity on a browser that has never published anything.
   *
   *  In the SNAPSHOT, not a top-level preference: it identifies the system, so
   *  it has to travel with a saved kit and with `.escala/system.json`. The
   *  consequence — two people loading the same kit share an id and the second
   *  one loses the publish claim — is what `regeneratePublishId()` is for. */
  publishId: string
  colorAlgorithm: ColorAlgorithm
  contrastShift: number
  colorNaming: ColorNaming
  // How much of the Neutral's colour reaches the page (see NEUTRAL_TINTS).
  // Part of the snapshot, not a global preference: it changes the generated
  // ramps, so a saved system has to carry its own level.
  neutralTint: NeutralTint
  /** While true, the Neutral is DERIVED from the accent (`neutralFromBrand`) and
   *  re-derived on every accent change. Editing the Neutral directly clears it —
   *  see `useApplyGrayColor` — so a hand-picked neutral is never silently
   *  overwritten on the next accent edit. Snapshot state, not a preference:
   *  it decides what the neutral ramp IS. */
  linkNeutralToAccent: boolean
  /** Same contract as `linkNeutralToAccent`, for the four status primitives.
   *  While true, Error/Warning/Success/Info are DERIVED from the accent
   *  (`recommendStateColors` — blends only chroma, hue + lightness stay put so
   *  red stays red) and re-derived on every accent change. Editing a state
   *  directly clears it — see `useApplyStateColor` — so a hand-picked state
   *  colour is never silently overwritten on the next accent edit. */
  linkStatesToAccent: boolean
  // Page background primitive (Radix custom-palette input) — anchors tone 1 of
  // every generated ramp and is the compositing base for derived alpha ramps.
  pageBackground: string
  // Its dark-theme twin — anchors tone 12 of `grayDarkScale`, which dark themes
  // read as surface-0 (recDarkTone inverts the gray hierarchy). Kept separate
  // from `pageBackground` so a light page and a dark page can each be chosen.
  darkBackground: string
  primaryColor: string
  primaryScale: ColorScale
  // Dark-appearance twin of every COLOURED family — the Radix two-scale model.
  // A dark theme resolves brand/status tones from these, not from the light
  // ramps, so tints deepen onto the dark page instead of a light one.
  primaryDarkScale: ColorScale
  grayBaseColor: string
  grayLightScale: ColorScale
  // Dark-appearance neutral ramp, generated from `grayBaseColor` (itself derived
  // from the accent when linked) anchored to `darkBackground`. Gray roles in a
  // dark theme resolve from this instead of `grayLightScale`.
  grayDarkScale: ColorScale
  errorColor: string
  errorScale: ColorScale
  errorDarkScale: ColorScale
  warningColor: string
  warningScale: ColorScale
  warningDarkScale: ColorScale
  successColor: string
  successScale: ColorScale
  successDarkScale: ColorScale
  infoColor: string
  infoScale: ColorScale
  infoDarkScale: ColorScale
  customColors: CustomColor[]
  themes: Record<string, Record<string, string>>
  /** Canonical semantic values: every library theme owns Light and Dark. */
  themeSemantics: ThemeSemanticModes
  themeOrder: string[]
  themeKinds: Record<string, 'light' | 'dark'>
  // Display-only names for the Theme Library and Theme Preview hub. Theme keys
  // remain stable because they are used by the token engine and integrations.
  themeLabels: Record<string, string>
  themeSources: Record<string, ThemeSources>
  /** Theme-scoped overrides of the existing foundation collections. */
  themeFoundations: Record<string, ThemeFoundationOverride>
  /** Which System Style a theme was adopted FROM (theme key → preset id).
   *  Design data, not chrome: it is what "Reset" resets TO. A theme with no
   *  entry was made by hand and resets to the system defaults instead. */
  themeOrigin: Record<string, string>
  typography: TypographyTokens
  spacing: Record<string, string>
  radius: Record<string, string>
  opacity: Record<string, string>
  shadows: Record<string, string>
  grid: Record<string, string>
  sizes: Record<string, string>
  /** Square selector glyphs (checkbox · radio · switch · badge dot), xs–xl. */
  selector: Record<string, string>
  /** Border-width / ring-spread primitive ramp (none · sm · md · lg). */
  stroke: Record<string, string>
  // Per-side surface padding (top/right/bottom/left) for padded surfaces.
  padding: Record<string, string>
  /** Intent aliases → primitive step keys. Never raw px. */
  radiusRoles: Record<string, string>
  spacingRoles: Record<string, string>
  sizeRoles: Record<string, string>
  selectorRoles: Record<string, string>
  strokeRoles: Record<string, string>
  breakpointRoles: Record<string, string>
  /** Desktop / mobile layout recipes. Gutter/margin alias spacing; container aliases a breakpoint. */
  gridFrame: GridFrameModes
  // Radix-style `panelBackground` — whether raised surfaces (surface-1: cards,
  // panels, sections) render solid, with alpha + backdrop blur, or reuse the
  // primitives page background (`pageBackground`).
  panelBackground: 'solid' | 'translucent' | 'page'
  /**
   * How a destructive or confirming action is painted. `solid` fills it with
   * the severity and puts the solved ink on top; `soft` gives it a translucent
   * wash of the severity with the severity's own text. Both are legitimate and
   * the choice is a STYLE decision — see `StatusAction` in themePresets.
   */
  statusAction: 'soft' | 'solid'
  /**
   * Phosphor icon WEIGHT the previewed system renders glyphs at — `thin`,
   * `light`, `regular`, `bold`, `fill`, `duotone`. A style axis, not a token:
   * the icon set is always the recommended Phosphor library, only the stroke
   * weight varies. See `themePresets`.
   */
  iconWeight: PhosphorWeight
  // Which semantic token architecture the export projects the 89-role catalogue
  // into (Alias/Semantics picker). 'flat' = the classic shape; the others are
  // additive projections (see lib/semanticArchitectures.ts).
  semanticArchitecture: SemanticArchitecture
  /**
   * Per-architecture edits to the projected semantic tokens, as PRIMITIVE REFS
   * (`{accent.9}`) — never loose hex, so a non-flat architecture keeps the same
   * "resolve through a primitive" contract the flat matrix has. Keyed
   * architecture → `category.token` → mode, where `mode` is a THEME KEY
   * ('light', 'dark', or any custom theme — Categorical resolves one column per
   * theme; Vibrancy/Tonal only ever use 'light'/'dark', their math has no
   * per-theme concept). Absent = the projection's own value. Structurally
   * compatible with the pre-N-theme shape (`{light?, dark?}` is a valid
   * `Record<string,string>`), so no store-version migration was needed.
   */
  architectureOverrides: Record<string, Record<string, Record<string, string>>>
  // Gradients foundation — named gradients + which one drives each preview
  // surface. Exported in tokens.json (`gradients`) / variables.css / README.
  gradients: GradientDef[]
  gradientAssignments: GradientAssignments
  // Scratch palette for the custom color picker's "Saved" swatches.
  savedColors: string[]
  selectedComponents: string[]
  completedFoundations: string[]
  iconLibrary: string
  iconAiSource: IconAiSourceKey
  customIcons: { name: string; svg: string }[]
  figmaLastPublishAt: string | null
  githubRepo: string | null
  githubLastPushAt: string | null
}

export interface SavedSystem {
  id: string
  name: string
  description: string
  repo: string
  savedAt: string // ISO of the last successful push
  snapshot: DesignSnapshot
  // How the entry got here — 'github' (push), 'local' (Save button), or
  // 'imported' (the Import-your-design-system flow). Optional: entries saved
  // before v35 are backfilled by the migration.
  source?: 'github' | 'local' | 'imported'
}

// Factory (not a const): every call returns fresh object references, so a
// reset never aliases a saved snapshot's nested objects.
export function makeDesignDefaults(): DesignSnapshot {
  return {
    projectName: 'Escala',
    projectDescription: '',
    // Lazily minted — see the field's own note. A reset genuinely IS a new
    // system, so clearing it here (rather than carrying the old id over) is
    // the honest behaviour: the next publish gets its own identity.
    publishId: '',
    colorAlgorithm: 'radix',
    contrastShift: 0,
    // Radix's own 1-12 numbering — every ramp is already stored this way
    // internally (see BASE_TONE), so this just makes new systems' on-screen
    // labels and export match it too. Existing persisted systems keep
    // whatever naming they already have; this only seeds fresh ones.
    colorNaming: 'numeric',
    // Today's behaviour verbatim — `subtle`'s constants ARE the ones
    // backgroundFromBase used to hardcode, so a fresh system is unchanged.
    neutralTint: DEFAULT_NEUTRAL_TINT,
    // A fresh system starts harmonized — its neutral has no history worth
    // protecting, and an accent-tinted grey is the model the rest of the
    // system documents (Radix/HeroUI).
    linkNeutralToAccent: true,
    // Same reasoning as linkNeutralToAccent: a fresh system's states have no
    // hand-picked history worth protecting, so they start harmonized with the
    // accent's chroma too.
    linkStatesToAccent: true,
    pageBackground: '#ffffff',
    darkBackground: '#0c0e12',
    primaryColor: DEFAULT_ACCENT,
    primaryScale: {},
    primaryDarkScale: {},
    grayBaseColor: '#6c737f',
    grayLightScale: { ...GRAY_LIGHT_SCALE },
    grayDarkScale: { ...DEFAULT_GRAY_DARK_SCALE },
    errorColor: '#f04438',
    errorScale: {},
    errorDarkScale: {},
    warningColor: '#f79009',
    warningScale: {},
    warningDarkScale: {},
    successColor: '#17b26a',
    successScale: {},
    successDarkScale: {},
    infoColor: '#2e90fa',
    infoScale: {},
    infoDarkScale: {},
    customColors: [],
    themes: { light: { ...EMPTY_SEMANTIC }, dark: { ...EMPTY_SEMANTIC } },
    themeSemantics: {
      light: { light: { ...EMPTY_SEMANTIC }, dark: { ...EMPTY_SEMANTIC } },
      dark: { light: { ...EMPTY_SEMANTIC }, dark: { ...EMPTY_SEMANTIC } },
    },
    themeOrder: ['light', 'dark'],
    themeKinds: { light: 'light', dark: 'dark' },
    themeLabels: {},
    themeSources: {},
    themeFoundations: {},
    themeOrigin: {},
    typography: {
      fontFamily: 'Inter',
      headingFontFamily: 'Inter',
      sizes: { ...FONT_SIZE_STANDARD },
      lineHeights: { ...LINE_HEIGHT_STANDARD },
      weights: { ...FONT_WEIGHT_STANDARD },
      roles: mergeTypeRoles(),
    },
    spacing: { ...SPACING_STANDARD },
    radius: { ...RADIUS_STANDARD },
    opacity: { ...OPACITY_DEFAULT },
    shadows: { ...SHADOW_DEFAULT },
    grid: { ...GRID_DEFAULT },
    sizes: { ...SIZE_STANDARD },
    selector: { ...SELECTOR_STANDARD },
    stroke: { ...STROKE_STANDARD },
    padding: { ...PADDING_STANDARD },
    radiusRoles: defaultLayoutRoles('radius'),
    spacingRoles: defaultLayoutRoles('spacing'),
    sizeRoles: defaultLayoutRoles('size'),
    selectorRoles: defaultLayoutRoles('selector'),
    strokeRoles: defaultLayoutRoles('stroke'),
    breakpointRoles: defaultLayoutRoles('breakpoint'),
    gridFrame: mergeGridFrame(GRID_FRAME_STANDARD),
    panelBackground: 'solid',
    statusAction: 'solid',
    iconWeight: 'regular',
    semanticArchitecture: 'categorical',
    architectureOverrides: {},
    gradients: makeDefaultGradients(DEFAULT_ACCENT, DEFAULT_ACCENT_SCALE, DEFAULT_ACCENT_DARK_SCALE),
    gradientAssignments: makeDefaultGradientAssignments(),
    savedColors: [],
    // A brand-new system starts with the curated essentials, not all 58 — see
    // ESSENTIAL_COMPONENT_KEYS. Existing systems are untouched: this only runs
    // for a store with no persisted state at all (migrate() above handles
    // returning users, and never reaches for this constant).
    selectedComponents: [...ESSENTIAL_COMPONENT_KEYS],
    completedFoundations: [],
    iconLibrary: 'phosphor',
    iconAiSource: 'phosphor',
    customIcons: [],
    figmaLastPublishAt: null,
    githubRepo: null,
    githubLastPushAt: null,
  }
}

const SNAPSHOT_KEYS = Object.keys(makeDesignDefaults()) as (keyof DesignSnapshot)[]

// Deep clone matters on both capture and load: snapshots must be decoupled
// from live state or edits mutate the saved entry via shared nested objects.
function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function captureSnapshot(state: DesignSnapshot): DesignSnapshot {
  return deepClone(
    Object.fromEntries(SNAPSHOT_KEYS.map((k) => [k, state[k]])) as unknown as DesignSnapshot
  )
}

/** Narrows a full snapshot down to ONE theme — the "save just this theme"
 *  half of the Kits save flow (`KitsPopover`'s scope choice). Only the
 *  THEME LAYER is trimmed: `themes`/`themeOrder`/`themeKinds`/`themeSources`
 *  keep just the chosen key, and `architectureOverrides` drops every mode
 *  entry that isn't it (an override is keyed `architecture →
 *  category.token → theme key`, so a dropped theme would otherwise leave
 *  orphaned override data pointing at a theme the saved kit no longer has).
 *  Every PRIMITIVE stays untouched — accent/neutral/states/custom families,
 *  typography, spacing, radius, shadows, grid, sizes, gradients, icons. A
 *  theme is "a reading of the primitives" (see CLAUDE.md), never a place
 *  that owns colour, so scoping the reading down doesn't require touching
 *  what it reads FROM. This does mean a custom family minted only for a
 *  DROPPED theme survives in the kit as an unreferenced primitive — left
 *  alone deliberately rather than cascading the prune: the family is still
 *  fully editable, and once no theme's `themeSources` points at it, the nav's
 *  own delete lock already opens on its own (same "in use by theme X" rule
 *  every other family-deletion path already follows) — that's the existing,
 *  discoverable way to clean it up, not a silent extra deletion here. */
export function scopeSnapshotToTheme(snapshot: DesignSnapshot, themeKey: string): DesignSnapshot {
  if (!snapshot.themeOrder.includes(themeKey)) return snapshot
  const architectureOverrides = Object.fromEntries(
    Object.entries(snapshot.architectureOverrides).map(([arch, tokens]) => [
      arch,
      Object.fromEntries(
        Object.entries(tokens)
          .map(([tokenKey, modes]): [string, Record<string, string>] =>
            [tokenKey, modes[themeKey] ? { [themeKey]: modes[themeKey] } : {}]
          )
          .filter(([, modes]) => Object.keys(modes).length > 0)
      ),
    ])
  )
  return {
    ...snapshot,
    themeOrder: [themeKey],
    themes: { [themeKey]: snapshot.themes[themeKey] },
    themeSemantics: snapshot.themeSemantics[themeKey]
      ? { [themeKey]: snapshot.themeSemantics[themeKey] }
      : {},
    themeKinds: snapshot.themeKinds[themeKey] ? { [themeKey]: snapshot.themeKinds[themeKey] } : {},
    themeLabels: snapshot.themeLabels[themeKey] ? { [themeKey]: snapshot.themeLabels[themeKey] } : {},
    themeSources: snapshot.themeSources[themeKey] ? { [themeKey]: snapshot.themeSources[themeKey] } : {},
    themeFoundations: snapshot.themeFoundations[themeKey] ? { [themeKey]: snapshot.themeFoundations[themeKey] } : {},
    themeOrigin: snapshot.themeOrigin?.[themeKey] ? { [themeKey]: snapshot.themeOrigin[themeKey] } : {},
    architectureOverrides,
  }
}

/** Builds the `SavedSystem` entry `saveCurrentSystem`/`saveCurrentSystemAsTheme`
 *  both upsert — ONE place deciding the id (repo id when GitHub-connected, else
 *  a stable slug of the project name) so the two save paths can never disagree
 *  about which existing kit a save should update vs. create fresh. */
function buildSavedSystemEntry(
  state: Pick<DesignStore, 'githubRepo' | 'projectName' | 'projectDescription'>,
  snapshot: DesignSnapshot,
  /** Overrides the entry name + local id slug (a theme-scoped save names the
   *  kit after the theme, not the project). A connected repo still wins the id. */
  nameOverride?: string,
): SavedSystem {
  const name = nameOverride?.trim() || state.projectName
  const id = state.githubRepo ?? `local:${slugify(name) || 'design-system'}`
  return {
    id,
    name,
    description: state.projectDescription,
    repo: state.githubRepo ?? '',
    savedAt: new Date().toISOString(),
    snapshot,
    source: state.githubRepo ? 'github' : 'local',
  }
}

interface DesignStore {
  // Home / onboarding
  projectName: string
  /** Mirrors `DesignSnapshot.publishId` — the stable `/api/tokens` key. */
  publishId: string
  setProjectName: (name: string) => void
  /** The system's publish id, minting one on first call. Returns it, so the
   *  publish path can read and persist in a single step. Idempotent. */
  ensurePublishId: () => string
  /** Mint a NEW identity, abandoning the old one. The escape hatch for the one
   *  case a stable id makes worse: a kit loaded in a second browser carries
   *  the first browser's id, and `/api/tokens` will refuse its publish (401,
   *  `claim-lost`) because the claim lives with whoever published first.
   *  Deliberately explicit — it disconnects every Figma file pointing at the
   *  old id, so it can never be a side effect of something else. */
  regeneratePublishId: () => string
  projectDescription: string
  setProjectDescription: (d: string) => void
  // True once the user has confirmed the "New Design System" card on Home.
  // Gates Home between the onboarding card and the overview dashboard.
  projectCreated: boolean
  setProjectCreated: (v: boolean) => void

  // Connection status (shown on Home; written by the connect views)
  figmaLastPublishAt: string | null // ISO timestamp of the last successful POST to /api/tokens
  setFigmaLastPublishAt: (iso: string | null) => void
  githubRepo: string | null // "owner/repo" once connected (Fase GitHub)
  setGithubRepo: (repo: string | null) => void
  githubLastPushAt: string | null
  setGithubLastPushAt: (iso: string | null) => void
  // When on, the configurator re-publishes the token set to /api/tokens shortly
  // after every edit, so the Figma plugin's live sync always reads the current
  // state. A global preference (not per-system), driven by useAutoFigmaSync().
  autoSyncFigma: boolean
  setAutoSyncFigma: (v: boolean) => void
  // The plugin content hash (`PLUGIN_BUILD`) the user last downloaded. When it
  // differs from the shipped `PLUGIN_BUILD`, the Sync hub flags an available
  // update on its "Download plugin" row. A global preference (not per-system),
  // null until the first download so a first-time user sees no false "update".
  pluginBuildSeen: string | null
  setPluginBuildSeen: (build: string) => void

  // Color — scale generation algorithm + contrast shift (drive every 1–12 ramp)
  // and the token-naming scheme used in the export.
  colorAlgorithm: ColorAlgorithm
  contrastShift: number
  colorNaming: ColorNaming
  neutralTint: NeutralTint
  linkNeutralToAccent: boolean
  setLinkNeutralToAccent: (v: boolean) => void
  linkStatesToAccent: boolean
  setLinkStatesToAccent: (v: boolean) => void
  setColorAlgorithm: (a: ColorAlgorithm) => void
  setContrastShift: (n: number) => void
  setColorNaming: (n: ColorNaming) => void
  /** Writes the level only. Regenerating the page + every ramp from it is
   *  `useApplyGrayColor(grayBaseColor)`'s job — one code path for "the base
   *  changed", whether it was the hex or how much of it survives. */
  setNeutralTint: (t: NeutralTint) => void

  // Page background primitive — the surface every ramp is generated against
  // (tone-1 anchor) and the compositing base for the exported alpha ramps.
  pageBackground: string
  setPageBackground: (hex: string) => void

  // Dark-theme page background — anchors tone 12 of `grayDarkScale` (= surface-0
  // in dark). Its presets are derived from the accent, so the dark page carries
  // the brand's hue.
  darkBackground: string
  setDarkBackground: (hex: string) => void

  // Step 2 — Brand / accent color (user-defined, generates 12-tone scale)
  primaryColor: string
  primaryScale: ColorScale
  primaryDarkScale: ColorScale
  setPrimaryColor: (hex: string) => void
  setPrimaryScale: (scale: ColorScale) => void
  setPrimaryDarkScale: (scale: ColorScale) => void

  // Step 2 — Neutral gray (user-selectable flavor, generates light + dark scales)
  grayBaseColor: string
  grayLightScale: ColorScale
  grayDarkScale: ColorScale
  setGrayBaseColor: (hex: string) => void
  setGrayLightScale: (scale: ColorScale) => void
  setGrayDarkScale: (scale: ColorScale) => void

  // Step 2 — Semantic state scales (user-adjustable, default from Figma DS)
  errorColor: string
  errorScale: ColorScale
  errorDarkScale: ColorScale
  setErrorColor: (hex: string) => void
  setErrorScale: (scale: ColorScale) => void
  setErrorDarkScale: (scale: ColorScale) => void

  warningColor: string
  warningScale: ColorScale
  warningDarkScale: ColorScale
  setWarningColor: (hex: string) => void
  setWarningScale: (scale: ColorScale) => void
  setWarningDarkScale: (scale: ColorScale) => void

  successColor: string
  successScale: ColorScale
  successDarkScale: ColorScale
  setSuccessColor: (hex: string) => void
  setSuccessScale: (scale: ColorScale) => void
  setSuccessDarkScale: (scale: ColorScale) => void

  infoColor: string
  infoScale: ColorScale
  infoDarkScale: ColorScale
  setInfoColor: (hex: string) => void
  setInfoScale: (scale: ColorScale) => void
  setInfoDarkScale: (scale: ColorScale) => void

  // Step 2 — Custom color families (name + auto-generated 1–12 scale)
  customColors: CustomColor[]
  addCustomColor: (c: CustomColor) => void
  updateCustomColor: (key: string, updates: Partial<Omit<CustomColor, 'key'>>) => void
  removeCustomColor: (key: string) => void

  // Step 3 — Semantic tokens, one map per theme. 'light' and 'dark' always
  // exist (protected); the user can add more. Every theme shares the same role
  // keys. `themeKinds` records whether a theme reads as light or dark — it
  // drives the recommended tones and which gray ramp seeds it.
  themes: Record<string, Record<string, string>>
  themeSemantics: ThemeSemanticModes
  themeOrder: string[]
  themeKinds: Record<string, 'light' | 'dark'>
  themeLabels: Record<string, string>
  // Per-theme primitive palettes — only custom "style themes" have an entry;
  // light/dark fall back to the global scales.
  themeSources: Record<string, ThemeSources>
  themeFoundations: Record<string, ThemeFoundationOverride>
  themeOrigin: Record<string, string>
  setThemeOrigin: (key: string, presetId: string | null) => void
  setThemeToken: (theme: string, key: string, value: string) => void
  mergeThemeTokens: (theme: string, partial: Record<string, string>) => void
  setThemeModeToken: (theme: string, appearance: ThemeAppearance, key: string, value: string) => void
  mergeThemeModeTokens: (theme: string, appearance: ThemeAppearance, partial: Record<string, string>) => void
  addTheme: (key: string, kind: 'light' | 'dark', sources: ThemeSources) => void
  removeTheme: (key: string) => void
  // Reorder the theme columns (drag-to-reorder in the Semantic matrix).
  setThemeOrder: (order: string[]) => void
  // Rename a custom theme — re-keys its entry across themes/kinds/palettes and
  // preserves column order. No-op for the protected light/dark keys or on a
  // collision with an existing key.
  renameTheme: (oldKey: string, newKey: string) => void
  setThemeLabel: (key: string, label: string) => void
  // Update a theme's mode + palette in place, keeping its token overrides. Works
  // for light/dark too — giving them a palette entry decouples them from the
  // global scales (they then read their own frozen ramps via sourceScaleFor).
  updateTheme: (key: string, kind: 'light' | 'dark', sources: ThemeSources) => void
  // Updates a custom theme's own palette (no-op for light/dark, which have no
  // palette entry and draw from the global scales instead).
  mergeThemeSources: (key: string, partial: Partial<ThemeSources>) => void
  setThemeFoundations: (key: string, foundations: ThemeFoundationOverride | null) => void
  patchThemeFoundations: (key: string, partial: ThemeFoundationOverride) => void

  // Step 4 — Typography
  typography: TypographyTokens
  setTypography: (t: TypographyTokens) => void

  // Foundations — Spacing & Radius (separate rail sections, shared store fields)
  spacing: Record<string, string>
  radius: Record<string, string>
  setSpacing: (s: Record<string, string>) => void
  setRadius: (r: Record<string, string>) => void

  // Foundations — Opacity / Shadow / Grid / Sizes token tables
  opacity: Record<string, string>
  shadows: Record<string, string>
  grid: Record<string, string>
  sizes: Record<string, string>
  setOpacity: (o: Record<string, string>) => void
  setShadows: (s: Record<string, string>) => void
  setGrid: (g: Record<string, string>) => void
  setSizes: (s: Record<string, string>) => void
  selector: Record<string, string>
  setSelector: (s: Record<string, string>) => void
  stroke: Record<string, string>
  setStroke: (s: Record<string, string>) => void

  // Surface padding token (top/right/bottom/left)
  padding: Record<string, string>
  setPadding: (p: Record<string, string>) => void

  radiusRoles: Record<string, string>
  spacingRoles: Record<string, string>
  sizeRoles: Record<string, string>
  selectorRoles: Record<string, string>
  strokeRoles: Record<string, string>
  breakpointRoles: Record<string, string>
  gridFrame: GridFrameModes
  setRadiusRoles: (r: Record<string, string>) => void
  setSpacingRoles: (r: Record<string, string>) => void
  setSizeRoles: (r: Record<string, string>) => void
  setSelectorRoles: (r: Record<string, string>) => void
  setStrokeRoles: (r: Record<string, string>) => void
  setBreakpointRoles: (r: Record<string, string>) => void
  setGridFrame: (f: GridFrameModes) => void

  // Panel background — Radix-style treatment for raised surfaces (surface-1:
  // cards, panels, sections): solid, translucent, or the page background.
  panelBackground: 'solid' | 'translucent' | 'page'
  statusAction: 'soft' | 'solid'
  setStatusAction: (v: 'soft' | 'solid') => void
  iconWeight: PhosphorWeight
  setIconWeight: (v: PhosphorWeight) => void
  setPanelBackground: (v: 'solid' | 'translucent' | 'page') => void

  // Semantic token architecture — which shape the export projects the flat
  // role catalogue into (Alias/Semantics picker).
  semanticArchitecture: SemanticArchitecture
  setSemanticArchitecture: (v: SemanticArchitecture) => void
  // Edits to a non-flat architecture's projected tokens, stored as primitive
  // refs so they keep resolving through the ramps (see the snapshot field).
  architectureOverrides: Record<string, Record<string, Record<string, string>>>
  setArchitectureOverride: (arch: string, tokenId: string, mode: string, ref: string | null) => void
  resetArchitectureOverrides: (arch: string) => void

  // Gradients — named gradients + per-surface assignment (covers, avatars)
  gradients: GradientDef[]
  gradientAssignments: GradientAssignments
  addGradient: (g: GradientDef) => void
  updateGradient: (id: string, patch: Partial<Omit<GradientDef, 'id'>>) => void
  removeGradient: (id: string) => void
  setGradientAssignment: (target: keyof GradientAssignments, id: string | null) => void

  // Custom color picker — user's saved swatch library
  savedColors: string[]
  addSavedColor: (hex: string) => void
  removeSavedColor: (hex: string) => void

  // Components — every component ships selected by default (toggle = remove)
  selectedComponents: string[]
  toggleComponent: (key: string) => void
  setSelectedComponents: (keys: string[]) => void

  // Foundations progress (gamification) — which foundation steps the user has
  // completed. Persisted so the progress bar survives reloads.
  completedFoundations: string[]
  markFoundationComplete: (key: string) => void
  resetFoundationsProgress: () => void

  // Icon Library — Untitled UI is the bundled set. `iconAiSource` is the
  // GitHub repo written into Skill / README for generated UI.
  iconLibrary: string
  setIconLibrary: (key: string) => void
  iconAiSource: IconAiSourceKey
  setIconAiSource: (key: IconAiSourceKey) => void

  // Custom icons — user-uploaded SVGs (sanitized before they reach the store)
  customIcons: { name: string; svg: string }[]
  addCustomIcon: (name: string, svg: string) => void
  removeCustomIcon: (name: string) => void

  // Multi design system — local registry backed by GitHub repos. An entry is
  // only created/updated by a successful push (GitHubConnectView).
  savedSystems: SavedSystem[]
  upsertSavedSystem: (entry: SavedSystem) => void
  removeSavedSystem: (id: string) => void // local-only; the repository is untouched
  loadSystem: (id: string) => void
  // Renames a SAVED entry in place — name + snapshot.projectName only, never
  // the live editor state (the active system renames through its own editable
  // field, e.g. FigmaSyncView's hero input). A 'local:' id is derived from the
  // name (see buildSavedSystemEntry), so renaming one changes its id too;
  // rejects rather than clobbers if that collides with a different entry. A
  // 'github'-sourced id stays pinned to its repo regardless of the new name.
  renameSavedSystem: (id: string, name: string) => { ok: boolean; error?: string }
  // Renames the ACTIVE system: sets `projectName` AND carries its saved
  // registry entry along. Both halves matter — `setProjectName` alone moves
  // the live state only, so the entry keeps its old `local:<slug>` id and
  // shows up as a SECOND, orphaned system named the old name (and the next
  // save would overwrite its snapshot with unrelated state). Use this rather
  // than `setProjectName` anywhere a rename is a deliberate action.
  renameActiveSystem: (name: string) => { ok: boolean; error?: string }
  startNewSystem: () => void
  // Put every DESIGN foundation back to its default — the purple accent, the
  // plain light/dark theme pair, the semantic roles, and every other foundation
  // `makeDesignDefaults` seeds — while leaving this system's IDENTITY and its
  // connections alone.
  //
  // Deliberately narrower than `startNewSystem`, which also renames the
  // project back to 'Escala' and drops githubRepo/figmaLastPublishAt. The
  // Figma sync URL is DERIVED FROM THE PROJECT NAME (figmaSync's
  // `syncProjectId` slugifies it), so a reset that renamed would silently
  // repoint the endpoint and leave every installed plugin polling the old
  // URL — a reset of the colours would read as a broken sync.
  //
  // Saved kits survive either way: `savedSystems` isn't part of
  // `makeDesignDefaults()`, so spreading it can't clear the registry. Same
  // for `autoSyncFigma` and `projectCreated`, which live outside the factory.
  resetToDefaults: () => void
  // Save the current token state into the local registry without a GitHub push.
  // Reuses the connected repo's id when present, else a slug of the project name.
  saveCurrentSystem: () => void
  // Same save, scoped to ONE theme (see `scopeSnapshotToTheme`) — the "just
  // this theme" half of the Kits save-scope choice, for systems carrying more
  // than one theme.
  //
  // `name` overrides the entry's name AND its local id slug. The Kits popover
  // omits it (the scoped save updates the project's own kit, matching its
  // "reusing a name updates that kit" copy). The Export wizard, opened for a
  // specific theme, passes the THEME's name so the snapshot registers as that
  // theme's kit (`local:apollo`) rather than overwriting the whole-project one —
  // "the snapshot name must match the theme name". A connected GitHub repo still
  // pins the id (`buildSavedSystemEntry`), so `name` only moves the local slug.
  saveCurrentSystemAsTheme: (themeKey: string, name?: string) => void
  // Adopt an imported snapshot as the active system AND register it in the
  // local registry with 'imported' provenance (Import your design system flow).
  applyImportedSystem: (snapshot: DesignSnapshot) => void
}

export const useDesignStore = create<DesignStore>()(
  persist(
    // `get` is used by `ensurePublishId` — it must read the CURRENT id before
    // deciding to mint, and a stale closure over the initial state would mint
    // a second identity on every call.
    (set, get) => ({
      // All design data comes from the single defaults factory — the same
      // source startNewSystem() resets to.
      ...makeDesignDefaults(),

      setProjectName: (name) => set({ projectName: name }),
      ensurePublishId: () => {
        const current = get().publishId
        if (isPublishId(current)) return current
        const minted = generatePublishId()
        set({ publishId: minted })
        return minted
      },
      regeneratePublishId: () => {
        const minted = generatePublishId()
        set({ publishId: minted })
        return minted
      },
      setProjectDescription: (d) => set({ projectDescription: d }),
      // The system always exists with defaults — the workspace opens on Color, no
      // name-first onboarding gate. (Kept in the store for the multi-system flow.)
      projectCreated: true,
      setProjectCreated: (v) => set({ projectCreated: v }),

      // A successful publish is the moment the user has declared "keep Figma in
      // sync" — turning auto-sync on here (rather than leaving it behind a
      // buried toggle) is what makes the FIRST publish also the LAST manual one.
      // Never turns it back off: only setAutoSyncFigma does that.
      setFigmaLastPublishAt: (iso) => set((s) => ({
        figmaLastPublishAt: iso,
        autoSyncFigma: iso ? true : s.autoSyncFigma,
      })),
      setGithubRepo: (repo) => set({ githubRepo: repo }),
      setGithubLastPushAt: (iso) => set({ githubLastPushAt: iso }),
      autoSyncFigma: false,
      setAutoSyncFigma: (v) => set({ autoSyncFigma: v }),
      pluginBuildSeen: null,
      setPluginBuildSeen: (build) => set({ pluginBuildSeen: build }),

      // Color scale generation
      setColorAlgorithm: (a) => set({ colorAlgorithm: a }),
      setContrastShift: (n) => set({ contrastShift: n }),
      setColorNaming: (n) => set({ colorNaming: n }),
      setNeutralTint: (t) => set({ neutralTint: t }),
      setLinkNeutralToAccent: (v) => set({ linkNeutralToAccent: v }),
      setLinkStatesToAccent: (v) => set({ linkStatesToAccent: v }),
      setPageBackground: (hex) => set({ pageBackground: hex }),
      setDarkBackground: (hex) => set({ darkBackground: hex }),

      // Brand
      setPrimaryColor: (hex) => set({ primaryColor: hex }),
      setPrimaryScale: (scale) => set({ primaryScale: scale }),
      setPrimaryDarkScale: (scale) => set({ primaryDarkScale: scale }),

      // Neutral gray (default: Gray Neutral — closest to Figma's neutral gray)
      setGrayBaseColor: (hex) => set({ grayBaseColor: hex }),
      setGrayLightScale: (scale) => set({ grayLightScale: scale }),
      setGrayDarkScale: (scale) => set({ grayDarkScale: scale }),

      // Semantic state scales (defaults from the Figma DS)
      setErrorColor: (hex) => set({ errorColor: hex }),
      setErrorScale: (scale) => set({ errorScale: scale }),
      setErrorDarkScale: (scale) => set({ errorDarkScale: scale }),
      setWarningColor: (hex) => set({ warningColor: hex }),
      setWarningScale: (scale) => set({ warningScale: scale }),
      setWarningDarkScale: (scale) => set({ warningDarkScale: scale }),
      setSuccessColor: (hex) => set({ successColor: hex }),
      setSuccessScale: (scale) => set({ successScale: scale }),
      setSuccessDarkScale: (scale) => set({ successDarkScale: scale }),
      setInfoColor: (hex) => set({ infoColor: hex }),
      setInfoScale: (scale) => set({ infoScale: scale }),
      setInfoDarkScale: (scale) => set({ infoDarkScale: scale }),

      addCustomColor: (c) =>
        set((state) =>
          state.customColors.some((x) => x.key === c.key)
            ? state
            : { customColors: [...state.customColors, c] }
        ),
      updateCustomColor: (key, updates) =>
        set((state) => ({
          customColors: state.customColors.map((c) =>
            c.key === key ? { ...c, ...updates } : c
          ),
        })),
      // Refuses while a theme still references the family: a theme resolves
      // THROUGH its families, so deleting one out from under it would leave a
      // dangling reference. Callers surface the blocked state (see the family
      // nav's "in use by N themes").
      removeCustomColor: (key) =>
        set((state) => {
          const used = Object.values(state.themeSources).some((refs) =>
            (['brand', 'gray', 'error', 'warning', 'success', 'info'] as const).some((s) => refs[s] === key),
          )
          if (used) return state
          return { customColors: state.customColors.filter((c) => c.key !== key) }
        }),

      setThemeToken: (theme, key, value) =>
        set((state) => {
          const appearance = state.themeKinds[theme] ?? 'light'
          const currentModes = state.themeSemantics[theme] ?? {
            light: appearance === 'light' ? (state.themes[theme] ?? {}) : {},
            dark: appearance === 'dark' ? (state.themes[theme] ?? {}) : {},
          }
          const next = { ...currentModes[appearance], [key]: value }
          return {
            themes: { ...state.themes, [theme]: next },
            themeSemantics: {
              ...state.themeSemantics,
              [theme]: { ...currentModes, [appearance]: next },
            },
          }
        }),
      mergeThemeTokens: (theme, partial) =>
        set((state) => {
          const appearance = state.themeKinds[theme] ?? 'light'
          const currentModes = state.themeSemantics[theme] ?? {
            light: appearance === 'light' ? (state.themes[theme] ?? {}) : {},
            dark: appearance === 'dark' ? (state.themes[theme] ?? {}) : {},
          }
          const next = { ...currentModes[appearance], ...partial }
          return {
            themes: { ...state.themes, [theme]: next },
            themeSemantics: {
              ...state.themeSemantics,
              [theme]: { ...currentModes, [appearance]: next },
            },
          }
        }),
      setThemeModeToken: (theme, appearance, key, value) =>
        set((state) => {
          const preferred = state.themeKinds[theme] ?? 'light'
          const currentModes = state.themeSemantics[theme] ?? {
            light: preferred === 'light' ? (state.themes[theme] ?? {}) : {},
            dark: preferred === 'dark' ? (state.themes[theme] ?? {}) : {},
          }
          const next = { ...currentModes[appearance], [key]: value }
          return {
            themeSemantics: {
              ...state.themeSemantics,
              [theme]: { ...currentModes, [appearance]: next },
            },
            ...(appearance === preferred
              ? { themes: { ...state.themes, [theme]: next } }
              : {}),
          }
        }),
      mergeThemeModeTokens: (theme, appearance, partial) =>
        set((state) => {
          const preferred = state.themeKinds[theme] ?? 'light'
          const currentModes = state.themeSemantics[theme] ?? {
            light: preferred === 'light' ? (state.themes[theme] ?? {}) : {},
            dark: preferred === 'dark' ? (state.themes[theme] ?? {}) : {},
          }
          const next = { ...currentModes[appearance], ...partial }
          return {
            themeSemantics: {
              ...state.themeSemantics,
              [theme]: { ...currentModes, [appearance]: next },
            },
            ...(appearance === preferred
              ? { themes: { ...state.themes, [theme]: next } }
              : {}),
          }
        }),
      // Add a custom "style theme" with its own primitive palette. The token
      // map starts empty ({}) — Step3's auto-populate effect seeds every role
      // from the palette's recommended tones on the next render.
      addTheme: (key, kind, sources) =>
        set((state) => {
          if (state.themes[key]) return state
          return {
            themes: { ...state.themes, [key]: { ...EMPTY_SEMANTIC } },
            themeSemantics: {
              ...state.themeSemantics,
              [key]: { light: { ...EMPTY_SEMANTIC }, dark: { ...EMPTY_SEMANTIC } },
            },
            themeOrder: [...state.themeOrder, key],
            themeKinds: { ...state.themeKinds, [key]: kind },
            themeLabels: { ...state.themeLabels, [key]: key.replace(/-/g, ' ') },
            themeSources: { ...state.themeSources, [key]: sources },
          }
        }),
      mergeThemeSources: (key, partial) =>
        set((state) => {
          if (!state.themeSources[key]) return state
          return { themeSources: { ...state.themeSources, [key]: { ...state.themeSources[key], ...partial } } }
        }),
      setThemeOrigin: (key, presetId) =>
        set((state) => {
          const { [key]: _, ...rest } = state.themeOrigin ?? {}
          return { themeOrigin: presetId ? { ...rest, [key]: presetId } : rest }
        }),
      setThemeFoundations: (key, foundations) =>
        set((state) => {
          if (!state.themes[key]) return state
          const { [key]: _, ...rest } = state.themeFoundations
          return { themeFoundations: foundations ? { ...rest, [key]: foundations } : rest }
        }),
      patchThemeFoundations: (key, partial) =>
        set((state) => {
          if (!state.themes[key]) return state
          return {
            themeFoundations: {
              ...state.themeFoundations,
              [key]: { ...state.themeFoundations[key], ...partial },
            },
          }
        }),
      removeTheme: (key) =>
        set((state) => {
          if (!state.themes[key]) return state
          // Empty My themes is allowed — the library falls back to System
          // styles / "Create your theme". Guarding the last theme hid the
          // trash and made a one-theme system undeletable.
          const { [key]: _, ...themes } = state.themes
          const { [key]: __, ...themeSemantics } = state.themeSemantics
          const { [key]: ___, ...themeKinds } = state.themeKinds
          const { [key]: ____, ...themeLabels } = state.themeLabels
          const { [key]: _____, ...themeSources } = state.themeSources
          const { [key]: ______, ...themeFoundations } = state.themeFoundations
          const { [key]: _______, ...themeOrigin } = state.themeOrigin ?? {}
          // Sweep the families THIS theme minted for itself (Add-to-system /
          // "+Theme" both mint one per slot it doesn't share with a global —
          // see familySlotFor) once nothing references them any more. Deleting
          // the theme used to only "free" them into the Custom folder
          // (removeCustomColor's own in-use lock would then let a person
          // delete them by hand) — reported as primitive clutter piling up
          // across repeated style try-ons ("Blue-marin", "Core--minimalist", …)
          // that nobody was ever going to click through six delete
          // confirmations for. A family a person is still actually using
          // elsewhere is untouched: `stillUsed` re-checks the SAME "any theme's
          // themeSources references it" condition `removeCustomColor` already
          // enforces, against the POST-removal `themeSources` — a family two
          // themes shared survives losing one of them.
          const deletedSlots = new Set(Object.values(state.themeSources[key] ?? {}).filter(Boolean))
          const stillUsed = (famKey: string) =>
            Object.values(themeSources).some((refs) =>
              (['brand', 'gray', 'error', 'warning', 'success', 'info'] as const).some((s) => refs[s] === famKey),
            )
          const customColors = deletedSlots.size
            ? state.customColors.filter((c) => !deletedSlots.has(c.key) || stillUsed(c.key))
            : state.customColors
          // `architectureOverrides` is keyed `arch → token → THEME KEY` (a
          // PLAIN theme key — verified against `scopeSnapshotToTheme` right
          // above in this file, which the "saving a kit scoped to one theme"
          // flow already exercises and which this comment used to describe
          // incorrectly). So a deleted theme leaves a `"gone"`-keyed entry
          // behind — ref data pointing at a theme that no longer exists. This
          // used to filter for `themeModeKey(key, 'light'|'dark')` — a
          // `"gone::light"`-shaped key that `setArchitectureOverride` never
          // actually writes — so the filter below matched nothing and this
          // pruning was silently a no-op since it was added: every Style
          // try-on adopted and then deleted left its overrides in storage
          // forever (`applyArchTokenOverrides`'s own `hasOwnProperty` guard,
          // added alongside this fix, keeps a stale entry like this out of
          // the EXPORT regardless — but it should not go on accumulating in
          // the store either). It matters more now that a System Style
          // writes overrides on adopt, so trying styles on and deleting them
          // used to accumulate orphans forever.
          const architectureOverrides = Object.fromEntries(
            Object.entries(state.architectureOverrides).map(([arch, tokens]) => [
              arch,
              Object.fromEntries(
                Object.entries(tokens)
                  .map(([token, modes]) => [
                    token,
                    Object.fromEntries(Object.entries(modes).filter(([mode]) => mode !== key)),
                  ] as const)
                  .filter(([, modes]) => Object.keys(modes).length > 0),
              ),
            ]),
          )
          return {
            themes,
            themeSemantics,
            themeKinds,
            themeLabels,
            themeSources,
            themeFoundations,
            themeOrigin,
            architectureOverrides,
            themeOrder: state.themeOrder.filter((t) => t !== key),
            customColors,
          }
        }),
      setThemeOrder: (order) =>
        set((state) => ({
          // Only reorder known themes; append any stragglers so nothing is lost.
          themeOrder: [
            ...order.filter((t) => state.themes[t]),
            ...state.themeOrder.filter((t) => state.themes[t] && !order.includes(t)),
          ],
        })),
      renameTheme: (oldKey, newKey) =>
        set((state) => {
          if (oldKey === 'light' || oldKey === 'dark') return state
          if (!state.themes[oldKey]) return state
          if (oldKey === newKey || !newKey) return state
          if (state.themes[newKey]) return state // collision — keep as-is
          const { [oldKey]: tokens, ...restThemes } = state.themes
          const { [oldKey]: modes, ...restModeThemes } = state.themeSemantics
          const { [oldKey]: kind, ...restKinds } = state.themeKinds
          const { [oldKey]: label, ...restLabels } = state.themeLabels
          const { [oldKey]: sources, ...restSources } = state.themeSources
          const { [oldKey]: foundations, ...restFoundations } = state.themeFoundations
          const { [oldKey]: origin, ...restOrigin } = state.themeOrigin ?? {}
          return {
            themes: { ...restThemes, [newKey]: tokens },
            themeSemantics: modes ? { ...restModeThemes, [newKey]: modes } : restModeThemes,
            themeKinds: { ...restKinds, [newKey]: kind },
            themeLabels: label ? { ...restLabels, [newKey]: label } : restLabels,
            themeSources: sources
              ? { ...restSources, [newKey]: sources }
              : restSources,
            themeFoundations: foundations
              ? { ...restFoundations, [newKey]: foundations }
              : restFoundations,
            themeOrigin: origin ? { ...restOrigin, [newKey]: origin } : restOrigin,
            themeOrder: state.themeOrder.map((t) => (t === oldKey ? newKey : t)),
          }
        }),
      setThemeLabel: (key, label) =>
        set((state) => {
          if (!state.themes[key]) return state
          const next = label.trim()
          if (!next) return state
          return { themeLabels: { ...state.themeLabels, [key]: next } }
        }),
      updateTheme: (key, kind, sources) =>
        set((state) => {
          if (!state.themes[key]) return state
          const modes = state.themeSemantics[key]
          const nextSources = { ...state.themeSources, [key]: sources }
          // Drop custom families this theme just abandoned — the same sweep
          // removeTheme already does. Without it, every Accent fork / style
          // retint left the previous primitive in the registry forever
          // ("creating new primitives instead of discarding").
          const prevFam = new Set(Object.values(state.themeSources[key] ?? {}).filter(Boolean))
          const nextFam = new Set(Object.values(sources).filter(Boolean))
          const dropped = [...prevFam].filter((fam) => !nextFam.has(fam))
          const stillUsed = (famKey: string) =>
            Object.values(nextSources).some((refs) =>
              (['brand', 'gray', 'error', 'warning', 'success', 'info'] as const).some((s) => refs[s] === famKey),
            )
          const customColors = dropped.length
            ? state.customColors.filter((c) => !dropped.includes(c.key) || stillUsed(c.key))
            : state.customColors
          return {
            themeKinds: { ...state.themeKinds, [key]: kind },
            themeSources: nextSources,
            customColors,
            ...(modes ? { themes: { ...state.themes, [key]: modes[kind] } } : {}),
          }
        }),

      setTypography: (t) => set({ typography: { ...t, roles: mergeTypeRoles(t.roles) } }),

      setSpacing: (s) => set({ spacing: s }),
      setRadius: (r) => set({ radius: r }),

      setOpacity: (o) => set({ opacity: o }),
      setShadows: (s) => set({ shadows: s }),
      setPadding: (p) => set({ padding: p }),
      setGrid: (g) => set({ grid: g }),
      setSizes: (s) => set({ sizes: s }),
      setSelector: (s) => set({ selector: s }),
      setStroke: (s) => set({ stroke: s }),
      setRadiusRoles: (r) => set({ radiusRoles: mergeLayoutRoles('radius', r) }),
      setSpacingRoles: (r) => set({ spacingRoles: mergeLayoutRoles('spacing', r) }),
      setSizeRoles: (r) => set({ sizeRoles: mergeLayoutRoles('size', r) }),
      setSelectorRoles: (r) => set({ selectorRoles: mergeLayoutRoles('selector', r) }),
      setStrokeRoles: (r) => set({ strokeRoles: mergeLayoutRoles('stroke', r) }),
      setBreakpointRoles: (r) => set({ breakpointRoles: mergeLayoutRoles('breakpoint', r) }),
      setGridFrame: (f) => set((state) => {
        const frame = mergeGridFrame(f)
        return {
          gridFrame: frame,
          grid: applyDesktopFrameToGrid(state.grid, frame, state.spacing),
        }
      }),

      setPanelBackground: (v) => set({ panelBackground: v }),
      setStatusAction: (v) => set({ statusAction: v }),
      setIconWeight: (v) => set({ iconWeight: v }),
      setSemanticArchitecture: (v) => set({ semanticArchitecture: v }),
      // `ref === null` clears the edit, so the token falls back to the
      // projection's own value — the schema stays the source of truth.
      setArchitectureOverride: (arch, tokenId, mode, ref) =>
        set((state) => {
          const forArch = { ...(state.architectureOverrides[arch] ?? {}) }
          const entry = { ...(forArch[tokenId] ?? {}) }
          if (ref === null) delete entry[mode]
          else entry[mode] = ref
          if (Object.keys(entry).length) forArch[tokenId] = entry
          else delete forArch[tokenId]
          return { architectureOverrides: { ...state.architectureOverrides, [arch]: forArch } }
        }),
      resetArchitectureOverrides: (arch) =>
        set((state) => {
          const { [arch]: _drop, ...rest } = state.architectureOverrides
          return { architectureOverrides: rest }
        }),

      // Gradients — CRUD + per-surface assignment. Removing a gradient also
      // clears any assignment pointing at it, so covers/avatars never dangle.
      addGradient: (g) => set((state) => ({ gradients: [...state.gradients, g] })),
      updateGradient: (id, patch) =>
        set((state) => ({
          gradients: state.gradients.map((g) => (g.id === id ? { ...g, ...patch } : g)),
        })),
      removeGradient: (id) =>
        set((state) => ({
          gradients: state.gradients.filter((g) => g.id !== id),
          gradientAssignments: {
            cover: state.gradientAssignments.cover === id ? null : state.gradientAssignments.cover,
            avatar: state.gradientAssignments.avatar === id ? null : state.gradientAssignments.avatar,
          },
        })),
      setGradientAssignment: (target, id) =>
        set((state) => ({ gradientAssignments: { ...state.gradientAssignments, [target]: id } })),

      addSavedColor: (hex) =>
        set((state) =>
          state.savedColors.some((c) => c.toLowerCase() === hex.toLowerCase())
            ? state
            : { savedColors: [...state.savedColors, hex] }
        ),
      removeSavedColor: (hex) =>
        set((state) => ({ savedColors: state.savedColors.filter((c) => c.toLowerCase() !== hex.toLowerCase()) })),

      // Every component is included by default — the user removes what they don't want.
      toggleComponent: (key) =>
        set((state) => ({
          selectedComponents: state.selectedComponents.includes(key)
            ? state.selectedComponents.filter((k) => k !== key)
            : [...state.selectedComponents, key],
        })),
      setSelectedComponents: (keys) => set({ selectedComponents: keys }),

      // Foundations progress — idempotent add; reset clears it.
      markFoundationComplete: (key) =>
        set((state) =>
          state.completedFoundations.includes(key)
            ? state
            : { completedFoundations: [...state.completedFoundations, key] }
        ),
      resetFoundationsProgress: () => set({ completedFoundations: [] }),

      // Icon Library — Untitled UI is the only bundled set.
      setIconLibrary: (_key) => set({ iconLibrary: 'phosphor' }),
      setIconAiSource: (key) => set({ iconAiSource: key }),

      addCustomIcon: (name, svg) =>
        set((state) =>
          state.customIcons.some((i) => i.name === name)
            ? { customIcons: state.customIcons.map((i) => (i.name === name ? { name, svg } : i)) }
            : { customIcons: [...state.customIcons, { name, svg }] }
        ),
      removeCustomIcon: (name) =>
        set((state) => ({ customIcons: state.customIcons.filter((i) => i.name !== name) })),

      // ── Multi design system registry ──
      savedSystems: [],
      upsertSavedSystem: (entry) =>
        set((state) => ({
          savedSystems: state.savedSystems.some((s) => s.id === entry.id)
            ? state.savedSystems.map((s) => (s.id === entry.id ? entry : s))
            : [...state.savedSystems, entry],
        })),
      removeSavedSystem: (id) =>
        set((state) => ({ savedSystems: state.savedSystems.filter((s) => s.id !== id) })),
      loadSystem: (id) =>
        set((state) => {
          const sys = state.savedSystems.find((s) => s.id === id)
          if (!sys) return state
          // Clone so editing the loaded system never mutates the saved entry.
          return { ...deepClone(sys.snapshot), projectCreated: true }
        }),
      // Renames a SAVED entry only — see the DesignStore interface comment for
      // why this never touches live editor state. `set`'s updater form is the
      // only way to both read current state and compute a result here (this
      // store is created with `(set) => ({…})`, no `get`), so the result is
      // captured via closure and returned after `set` resolves.
      renameSavedSystem: (id, name) => {
        let result: { ok: boolean; error?: string } = { ok: false, error: 'System not found' }
        set((state) => {
          const sys = state.savedSystems.find((s) => s.id === id)
          if (!sys) return state
          const trimmed = name.trim()
          if (!trimmed) {
            result = { ok: false, error: 'Name cannot be empty' }
            return state
          }
          const rename = (entry: SavedSystem, newId: string): SavedSystem => ({
            ...entry,
            id: newId,
            name: trimmed,
            snapshot: { ...entry.snapshot, projectName: trimmed },
          })
          // GitHub-sourced ids are pinned to the repo (buildSavedSystemEntry's
          // rule) — only the display name/slug changes, never `id`/`repo`.
          if (sys.source === 'github') {
            result = { ok: true }
            return { savedSystems: state.savedSystems.map((s) => (s.id === id ? rename(s, id) : s)) }
          }
          // 'local:' ids are DERIVED from the name, so a rename changes it —
          // reject rather than silently merge into a different existing entry.
          const newId = `local:${slugify(trimmed) || 'design-system'}`
          if (newId !== id) {
            if (state.savedSystems.some((s) => s.id === newId)) {
              result = { ok: false, error: `A system named "${trimmed}" already exists` }
              return state
            }
            // The LIVE system owns an id too, whether or not it's been saved
            // yet (same expression buildSavedSystemEntry/SaveSidePanel use).
            // Checking only savedSystems missed exactly that case: renaming an
            // entry to the name of an UNSAVED active system produced a second
            // record on the active id — it vanished from every "other systems"
            // list (filtered out as active) while still sitting in storage,
            // and the next "Save changes" would overwrite its snapshot with
            // the unrelated live state. Verified reproducible before this guard.
            const activeId = state.githubRepo ?? `local:${slugify(state.projectName) || 'design-system'}`
            if (newId === activeId) {
              result = { ok: false, error: `"${trimmed}" is your active design system` }
              return state
            }
          }
          result = { ok: true }
          return { savedSystems: state.savedSystems.map((s) => (s.id === id ? rename(s, newId) : s)) }
        })
        return result
      },
      // See the interface comment. Same `set`-with-closure shape
      // `renameSavedSystem` uses (this store has no `get`).
      renameActiveSystem: (name) => {
        let result: { ok: boolean; error?: string } = { ok: false, error: 'Could not rename' }
        set((state) => {
          const trimmed = name.trim()
          if (!trimmed) {
            result = { ok: false, error: 'Name cannot be empty' }
            return state
          }
          if (trimmed === state.projectName) {
            result = { ok: true }
            return state
          }
          // Same id rule as buildSavedSystemEntry — a GitHub-connected system's
          // id is pinned to the repo, so only the display name moves there.
          const localId = (n: string) => `local:${slugify(n) || 'design-system'}`
          const prevId = state.githubRepo ?? localId(state.projectName)
          const nextId = state.githubRepo ?? localId(trimmed)
          if (nextId !== prevId && state.savedSystems.some((s) => s.id === nextId)) {
            result = { ok: false, error: `A system named "${trimmed}" already exists` }
            return state
          }
          result = { ok: true }
          return {
            projectName: trimmed,
            // No-op when the active system was never saved — there's simply no
            // entry matching prevId, which is the common case.
            savedSystems: state.savedSystems.map((s) =>
              s.id === prevId
                ? { ...s, id: nextId, name: trimmed, snapshot: { ...s.snapshot, projectName: trimmed } }
                : s,
            ),
          }
        })
        return result
      },
      startNewSystem: () => set({ ...makeDesignDefaults(), projectCreated: true }),
      // See the interface comment for why identity/connection fields are
      // carried over instead of reset.
      resetToDefaults: () =>
        set((state) => ({
          ...makeDesignDefaults(),
          projectName: state.projectName,
          projectDescription: state.projectDescription,
          githubRepo: state.githubRepo,
          githubLastPushAt: state.githubLastPushAt,
          figmaLastPublishAt: state.figmaLastPublishAt,
        })),
      saveCurrentSystem: () =>
        set((state) => {
          const snapshot = captureSnapshot(state as unknown as DesignSnapshot)
          const entry = buildSavedSystemEntry(state, snapshot)
          return {
            savedSystems: state.savedSystems.some((s) => s.id === entry.id)
              ? state.savedSystems.map((s) => (s.id === entry.id ? entry : s))
              : [...state.savedSystems, entry],
          }
        }),
      saveCurrentSystemAsTheme: (themeKey, name) =>
        set((state) => {
          const full = captureSnapshot(state as unknown as DesignSnapshot)
          const snapshot = scopeSnapshotToTheme(full, themeKey)
          const entry = buildSavedSystemEntry(state, snapshot, name)
          return {
            savedSystems: state.savedSystems.some((s) => s.id === entry.id)
              ? state.savedSystems.map((s) => (s.id === entry.id ? entry : s))
              : [...state.savedSystems, entry],
          }
        }),
      applyImportedSystem: (snapshot) =>
        set((state) => {
          const id = `imported:${slugify(snapshot.projectName) || 'imported-system'}`
          const entry: SavedSystem = {
            id,
            name: snapshot.projectName,
            description: snapshot.projectDescription,
            repo: '',
            savedAt: new Date().toISOString(),
            snapshot: deepClone(snapshot),
            source: 'imported',
          }
          // Clone again for the live state so edits never mutate the registry entry.
          return {
            ...deepClone(snapshot),
            projectCreated: true,
            savedSystems: state.savedSystems.some((s) => s.id === id)
              ? state.savedSystems.map((s) => (s.id === id ? entry : s))
              : [...state.savedSystems, entry],
          }
        }),
    }),
    {
      name: 'scalable-designs-store',
      version: 72,
      migrate: (persisted: any, version: number) => {
        if (persisted) {
          // v1→v2: remove styleDirection, rename selectedAtoms → selectedComponents
          delete persisted.styleDirection
          if (persisted.selectedAtoms && !persisted.selectedComponents) {
            persisted.selectedComponents = persisted.selectedAtoms
            delete persisted.selectedAtoms
          }
          // v2→v3: hub model — nav state is no longer persisted; the system now
          // ships with every component included by default.
          delete persisted.currentStep
          if (!persisted.projectName) persisted.projectName = 'DS.by.MD'
          // Only seed when the field is genuinely ABSENT (pre-v3 state, or a
          // corrupted blob). An explicitly EMPTY array is a real choice —
          // "ship no components" — and refilling it here silently republished
          // all 58 as `atoms`, so the Figma plugin generated a page per
          // component the user had deliberately removed.
          if (!Array.isArray(persisted.selectedComponents)) {
            persisted.selectedComponents = [...COMPONENT_KEYS]
          }
          // v3→v4: semantic tokens gained an independent dark-mode map. Seed it
          // empty; Step3 re-derives values from the scales on mount.
          if (!persisted.darkSemanticTokens) {
            persisted.darkSemanticTokens = { ...EMPTY_SEMANTIC }
          }
          // v4→v5: typography adopts the full Figma standard (11 sizes /
          // 11 line-heights / 4 weights). The old 6-size keys (base, 2xl…) don't
          // map cleanly, so reset the scale to the standard but keep font choices.
          if (persisted.typography) {
            const t = persisted.typography
            t.sizes = { ...FONT_SIZE_STANDARD }
            t.lineHeights = { ...LINE_HEIGHT_STANDARD }
            t.weights = { ...FONT_WEIGHT_STANDARD }
            if (!t.headingFontFamily) t.headingFontFamily = t.fontFamily ?? 'Inter'
          }
          // v5→v6: Foundations became a gamified stepper; seed the progress tracker.
          if (!persisted.completedFoundations) {
            persisted.completedFoundations = []
          }
          // v6→v7: Icon Library foundation added; seed the default set.
          if (!persisted.iconLibrary) {
            persisted.iconLibrary = 'untitled'
          }
          // v7→v8: rename default project name from "Apollo" to "DS.by.MD".
          if (persisted.projectName === 'Apollo') {
            persisted.projectName = 'DS.by.MD'
          }
          // v9→v10: Opacity / Shadow / Grid / Sizes foundations added; seed defaults.
          if (!persisted.opacity) persisted.opacity = { ...OPACITY_DEFAULT }
          if (!persisted.shadows) persisted.shadows = { ...SHADOW_DEFAULT }
          if (!persisted.grid) persisted.grid = { ...GRID_DEFAULT }
          if (!persisted.sizes) persisted.sizes = { ...SIZES_DEFAULT }
          // v10→v11: custom color families added; seed empty.
          if (!persisted.customColors) persisted.customColors = []
          // v11→v13: semanticTokens/darkSemanticTokens unified into the
          // multi-theme map. Legacy fields take precedence whenever they are
          // still present, so a partially-migrated state self-repairs.
          if (persisted.semanticTokens || persisted.darkSemanticTokens || !persisted.themes) {
            persisted.themes = {
              ...(persisted.themes ?? {}),
              light: persisted.semanticTokens ?? persisted.themes?.light ?? { ...EMPTY_SEMANTIC },
              dark: persisted.darkSemanticTokens ?? persisted.themes?.dark ?? { ...EMPTY_SEMANTIC },
            }
            delete persisted.semanticTokens
            delete persisted.darkSemanticTokens
          }
          if (!persisted.themeOrder) persisted.themeOrder = ['light', 'dark']
          if (!persisted.themeKinds) persisted.themeKinds = { light: 'light', dark: 'dark' }
          // v13→v14: Home/onboarding — description + connection status fields.
          if (persisted.projectDescription === undefined) persisted.projectDescription = ''
          if (persisted.figmaLastPublishAt === undefined) persisted.figmaLastPublishAt = null
          if (persisted.githubRepo === undefined) persisted.githubRepo = null
          if (persisted.githubLastPushAt === undefined) persisted.githubLastPushAt = null
          // v14→v15: custom uploaded icons; seed empty.
          if (!persisted.customIcons) persisted.customIcons = []
          // v15→v16: Home onboarding gained an explicit "project created" flag.
          // Grandfather existing users who clearly already worked on a system,
          // so they land on the dashboard instead of the onboarding card.
          if (persisted.projectCreated === undefined) {
            persisted.projectCreated =
              (!!persisted.projectName && persisted.projectName !== 'DS.by.MD') ||
              !!persisted.projectDescription ||
              !!persisted.figmaLastPublishAt ||
              !!persisted.githubRepo ||
              (persisted.completedFoundations?.length ?? 0) > 0
          }
          // v16→v17: multi design system registry. Grandfather: if the current
          // session was already pushed to a repo, seed the registry so "start
          // new" can't silently lose it. Merge over fresh defaults so the
          // snapshot shape is always complete even from old persisted shapes.
          if (!persisted.savedSystems) {
            persisted.savedSystems = []
            if (persisted.githubRepo && persisted.githubLastPushAt) {
              const defaults = makeDesignDefaults() as unknown as Record<string, unknown>
              const snapshot = Object.fromEntries(
                Object.keys(defaults).map((k) => [k, persisted[k] !== undefined ? persisted[k] : defaults[k]])
              )
              persisted.savedSystems = [{
                id: persisted.githubRepo,
                name: persisted.projectName ?? 'DS.by.MD',
                description: persisted.projectDescription ?? '',
                repo: persisted.githubRepo,
                savedAt: persisted.githubLastPushAt,
                snapshot,
              }]
            }
          }
          // v17→v18: per-theme primitive palettes for custom "style themes".
          // Built-in light/dark have no entry and use the global scales.
          if (!persisted.themePalettes) persisted.themePalettes = {}
          // v18→v19: color-scale algorithm + contrast shift. Default keeps the
          // legacy ramp so existing scales render identically until changed.
          if (!persisted.colorAlgorithm) persisted.colorAlgorithm = 'default'
          if (persisted.contrastShift === undefined) persisted.contrastShift = 0
          // v19→v20: token naming scheme for the export. Default numeric (1–12)
          // preserves existing token names.
          if (!persisted.colorNaming) persisted.colorNaming = 'numeric'
          // v20→v21: onboarding now opens straight on Color — the name-first gate
          // is gone, so every system is "created". Supersedes the v15→v16 heuristic.
          persisted.projectCreated = true
          // v21→v22: auto-publish to /api/tokens preference. Off by default so
          // existing sessions keep publishing only via the explicit Sync action.
          if (persisted.autoSyncFigma === undefined) persisted.autoSyncFigma = false
          // v22→v23: primitive families renamed brand→accent / gray→neutral.
          // Primitive scales persist by numeric tone (no prefix) so they need no
          // change; only the semantic token KEYS carry "brand"
          // (e.g. bg-brand-solid → bg-accent-solid). Rename those keys in place.
          const renameBrandKeys = (map: Record<string, string> | undefined) => {
            if (!map || typeof map !== 'object') return map
            const out: Record<string, string> = {}
            for (const [k, v] of Object.entries(map)) out[k.replace(/brand/g, 'accent')] = v as string
            return out
          }
          if (persisted.themes && typeof persisted.themes === 'object') {
            for (const t of Object.keys(persisted.themes)) {
              persisted.themes[t] = renameBrandKeys(persisted.themes[t])
            }
          }
          if (persisted.semanticTokens) persisted.semanticTokens = renameBrandKeys(persisted.semanticTokens)
          if (persisted.darkSemanticTokens) persisted.darkSemanticTokens = renameBrandKeys(persisted.darkSemanticTokens)
          // v23→v24: readable semantic taxonomy — rename every semantic-token KEY
          // (bg-primary → surface-0, bg-accent-solid → action-primary, fg-* → icon-*,
          //  text-*_on-accent → text-on-brand-*, …). Values are preserved, so user
          //  customisations survive. Also rewrite keys inside every saved-system
          //  snapshot so loading an older system doesn't reset to defaults.
          if (persisted.themes && typeof persisted.themes === 'object') {
            for (const t of Object.keys(persisted.themes)) {
              persisted.themes[t] = renameSemanticKeys(persisted.themes[t])
            }
          }
          if (Array.isArray(persisted.savedSystems)) {
            for (const sys of persisted.savedSystems) {
              const snap = sys?.snapshot
              if (snap?.themes && typeof snap.themes === 'object') {
                for (const t of Object.keys(snap.themes)) {
                  snap.themes[t] = renameSemanticKeys(snap.themes[t])
                }
              }
            }
          }
          // v24→v25: Radix-style panel background (solid/translucent) for raised
          // surfaces. Default 'solid' preserves the current look for every
          // existing session until they opt into translucent.
          if (!persisted.panelBackground) persisted.panelBackground = 'solid'
          if (!persisted.statusAction) persisted.statusAction = 'solid'
          // v67→v68: Phosphor icon weight per system. Absent → `regular`, the
          // weight every specimen rendered before this field existed.
          if (!persisted.iconWeight) persisted.iconWeight = 'regular'
          // v25→v26: page background primitive (Radix custom-palette input) —
          // anchors tone 1 of every ramp + derives the alpha ramps. White is
          // the previous implicit background, so existing output is unchanged.
          if (!persisted.pageBackground) persisted.pageBackground = '#ffffff'
          // v26→v27: the catalogue grew from 16 to 58 components. New keys ship
          // included by default (same as a fresh system), so union them into the
          // existing selection — anything the user removed stays removed.
          // Gated on the PERSISTED version: this union is a one-time catch-up
          // for state that predates the 58-key catalogue. Left ungated it re-ran
          // on every later version bump and re-added the 42 non-legacy keys, so
          // a curated selection healed back to "everything" behind the user's
          // back — the comment below only ever held for the 16 legacy keys.
          if (version < 27 && Array.isArray(persisted.selectedComponents)) {
            const have = new Set(persisted.selectedComponents)
            // Only append keys that post-date the old 16-key catalogue.
            const legacy = new Set([
              'Button', 'Input', 'Select', 'Checkbox', 'Toggle', 'Badge', 'Progress', 'Spinner',
              'Avatar', 'Card', 'Divider', 'Modal', 'Tooltip', 'Toast', 'Tabs', 'Breadcrumb',
            ])
            for (const key of COMPONENT_KEYS) {
              if (!legacy.has(key) && !have.has(key)) persisted.selectedComponents.push(key)
            }
          }
          // v27→v28: per-side surface padding token; 20px matches the previous
          // hardcoded tile inset, so existing previews render identically.
          if (!persisted.padding) persisted.padding = { ...PADDING_DEFAULT }
          // v28→v29: dark-mode colored TEXT tokens now mirror onto the light
          // half of their ramp (recDarkTone: 12→6 · 11→7 · 10→8) — the old
          // seeds (tone−1) were dark-on-light tones, unreadable on dark
          // surfaces. Reseed values still on the old recommendation (or empty);
          // user-customised hexes are left untouched.
          const DARK_TEXT_RESEED: { key: string; scale: string; old: number; next: number }[] = [
            { key: 'text-brand',                 scale: 'brand',   old: 11, next: 6 },
            { key: 'text-brand-secondary',       scale: 'brand',   old: 10, next: 7 },
            { key: 'text-brand-secondary-hover', scale: 'brand',   old: 11, next: 6 },
            { key: 'text-brand-tertiary',        scale: 'brand',   old: 9,  next: 8 },
            { key: 'text-brand-tertiary-alt',    scale: 'brand',   old: 9,  next: 8 },
            { key: 'text-error',                 scale: 'error',   old: 10, next: 7 },
            { key: 'text-warning',               scale: 'warning', old: 10, next: 7 },
            { key: 'text-success',               scale: 'success', old: 10, next: 7 },
            { key: 'text-info',                  scale: 'info',    old: 10, next: 7 },
          ]
          const reseedDarkText = (state: any) => {
            if (!state?.themes || typeof state.themes !== 'object') return
            for (const t of Object.keys(state.themes)) {
              if ((state.themeKinds?.[t] ?? 'light') !== 'dark') continue
              const tokens = state.themes[t]
              if (!tokens || typeof tokens !== 'object') continue
              const pal = state.themePalettes?.[t]
              for (const e of DARK_TEXT_RESEED) {
                const ramp = pal?.[e.scale] ?? (e.scale === 'brand' ? state.primaryScale : state[`${e.scale}Scale`])
                const nextHex = ramp?.[e.next]
                if (!nextHex) continue
                const cur = tokens[e.key]
                const oldHex = ramp?.[e.old]
                if (!cur || (oldHex && cur.toLowerCase() === oldHex.toLowerCase())) tokens[e.key] = nextHex
              }
            }
          }
          reseedDarkText(persisted)
          if (Array.isArray(persisted.savedSystems)) {
            for (const sys of persisted.savedSystems) reseedDarkText(sys?.snapshot)
          }
          // v29→v30: brand-mapped tokens were re-derived on every accent change
          // using the LIGHT tone for ALL themes (brandTokenUpdates ignored the
          // theme kind), so dark themes got dark-on-light brand text/icons/
          // borders — unreadable on dark surfaces. Reseed every dark theme's
          // brand token that still sits on its light-only tone (lt) onto the
          // recDarkTone tone (dt). Values matching neither are user choices.
          const DARK_BRAND_RESEED: { key: string; lt: number; dt: number }[] = [
            { key: 'surface-brand-subtle',       lt: 2,  dt: 11 },
            { key: 'surface-brand-subtle-alt',   lt: 2,  dt: 11 },
            { key: 'surface-brand-muted',        lt: 3,  dt: 12 },
            { key: 'text-brand',                 lt: 12, dt: 6 },
            { key: 'text-brand-secondary',       lt: 11, dt: 7 },
            { key: 'text-brand-secondary-hover', lt: 12, dt: 6 },
            { key: 'text-brand-tertiary',        lt: 10, dt: 8 },
            { key: 'text-brand-tertiary-alt',    lt: 10, dt: 8 },
            { key: 'icon-brand',                 lt: 9,  dt: 8 },
            { key: 'icon-brand-alt',             lt: 9,  dt: 8 },
            { key: 'icon-brand-secondary',       lt: 8,  dt: 7 },
            { key: 'icon-brand-secondary-alt',   lt: 8,  dt: 7 },
            { key: 'border-brand',               lt: 8,  dt: 7 },
            { key: 'border-brand-alt',           lt: 9,  dt: 8 },
          ]
          const reseedDarkBrand = (state: any) => {
            if (!state?.themes || typeof state.themes !== 'object') return
            for (const t of Object.keys(state.themes)) {
              if ((state.themeKinds?.[t] ?? 'light') !== 'dark') continue
              const tokens = state.themes[t]
              if (!tokens || typeof tokens !== 'object') continue
              const ramp = state.themePalettes?.[t]?.brand ?? state.primaryScale
              if (!ramp) continue
              for (const e of DARK_BRAND_RESEED) {
                const cur = tokens[e.key]
                const ltHex = ramp[e.lt]
                const dtHex = ramp[e.dt]
                if (!dtHex) continue
                if (!cur || (ltHex && cur.toLowerCase() === ltHex.toLowerCase())) tokens[e.key] = dtHex
              }
              // Solid brand fill: deepen to the accessible tone (like light mode)
              // so a bright accent's button label passes WCAG. Only touch values
              // still on the base tone 9/10 (or empty) — user picks are kept.
              const solid = accessibleSolidTone(ramp)
              const seedAction = (key: string, baseTone: number, tone: number) => {
                const hex = ramp[tone]
                const baseHex = ramp[baseTone]
                if (!hex) return
                const cur = tokens[key]
                if (!cur || (baseHex && cur.toLowerCase() === baseHex.toLowerCase())) tokens[key] = hex
              }
              seedAction('action-primary', 9, solid)
              seedAction('action-primary-hover', 10, Math.min(solid + 1, 12))
            }
          }
          reseedDarkBrand(persisted)
          if (Array.isArray(persisted.savedSystems)) {
            for (const sys of persisted.savedSystems) reseedDarkBrand(sys?.snapshot)
          }
          // v30→v31: Gradients foundation. Seed the default gradient set +
          // assignments and an empty saved-colors library on any state (and every
          // saved snapshot) that predates the feature.
          const seedGradients = (state: any) => {
            if (!state || typeof state !== 'object') return
            if (!Array.isArray(state.gradients)) state.gradients = makeDefaultGradients(DEFAULT_ACCENT, DEFAULT_ACCENT_SCALE, DEFAULT_ACCENT_DARK_SCALE)
            if (!state.gradientAssignments) state.gradientAssignments = makeDefaultGradientAssignments()
            if (!Array.isArray(state.savedColors)) state.savedColors = []
          }
          seedGradients(persisted)
          if (Array.isArray(persisted.savedSystems)) {
            for (const sys of persisted.savedSystems) seedGradients(sys?.snapshot)
          }
          // v31→v32: dark themes gained their own page background + generated
          // neutral ramp (they used to read the fixed GRAY_DARK_SCALE constant).
          // Seed both with the legacy values so existing systems keep the exact
          // dark they already had; picking a dark background regenerates them.
          const seedDarkBackground = (state: any) => {
            if (!state || typeof state !== 'object') return
            if (!state.darkBackground) state.darkBackground = '#0c0e12'
            if (!state.grayDarkScale || typeof state.grayDarkScale !== 'object') {
              state.grayDarkScale = { ...GRAY_DARK_SCALE }
            }
          }
          seedDarkBackground(persisted)
          if (Array.isArray(persisted.savedSystems)) {
            for (const sys of persisted.savedSystems) seedDarkBackground(sys?.snapshot)
          }
          // v32→v33: the Brand Cover / Aurora seed gradients now derive from the
          // accent so they match the chosen brand instead of the old hardcoded
          // violet→magenta. Only retint the untouched seeds — a hand-edited stop
          // set won't match the legacy signature and is left exactly as-is.
          const OLD_BRAND_COVER = [{ color: '#7f56d9', pos: 0 }, { color: '#432e73', pos: 100 }]
          const OLD_AURORA = [{ color: '#7f56d9', pos: 0 }, { color: '#d444f1', pos: 50 }, { color: '#f63d68', pos: 100 }]
          const retintBrandGradients = (state: any) => {
            if (!state || !Array.isArray(state.gradients)) return
            const accent = typeof state.primaryColor === 'string' && state.primaryColor ? state.primaryColor : '#7f56d9'
            state.gradients = state.gradients.map((g: any) => {
              if (g?.id === 'brand-cover' && Array.isArray(g.stops) && stopsMatch(g.stops, OLD_BRAND_COVER)) {
                return { ...g, stops: brandCoverStops(accent) }
              }
              if (g?.id === 'aurora' && Array.isArray(g.stops) && stopsMatch(g.stops, OLD_AURORA)) {
                return { ...g, stops: brandAvatarStops(accent) }
              }
              return g
            })
          }
          retintBrandGradients(persisted)
          if (Array.isArray(persisted.savedSystems)) {
            for (const sys of persisted.savedSystems) retintBrandGradients(sys?.snapshot)
          }
          // v33→v34: rebrand — the app + default design-system name became
          // "Escala". Rename anyone still on the old "DS.by.MD" default (and any
          // saved system that kept it) so exports don't carry the stale brand.
          // A hand-picked project name never matched the default, so it's left
          // untouched.
          if (persisted.projectName === 'DS.by.MD') persisted.projectName = 'Escala'
          if (Array.isArray(persisted.savedSystems)) {
            for (const sys of persisted.savedSystems) {
              if (sys?.name === 'DS.by.MD') sys.name = 'Escala'
              if (sys?.snapshot?.projectName === 'DS.by.MD') sys.snapshot.projectName = 'Escala'
            }
          }
          // v34→v35: SavedSystem gained provenance ('github' | 'local' |
          // 'imported'). Backfill existing entries from whether they carry a repo.
          if (Array.isArray(persisted.savedSystems)) {
            for (const sys of persisted.savedSystems) {
              if (sys && sys.source === undefined) sys.source = sys.repo ? 'github' : 'local'
            }
          }
          // v35→v36: the accent link on the brand gradients became an explicit
          // per-gradient lock (`linked`). Backfill it from the old implicit rule:
          // stops that still match the accent-derived signature were linked,
          // hand-edited ones were not.
          const backfillGradientLinks = (state: any) => {
            if (!state || !Array.isArray(state.gradients)) return
            const accent = typeof state.primaryColor === 'string' && state.primaryColor ? state.primaryColor : '#7f56d9'
            state.gradients = state.gradients.map((g: any) => {
              if (!g || g.linked !== undefined) return g
              const derived = derivedStopsFor(g.id, accent)
              if (!derived) return g
              return { ...g, linked: Array.isArray(g.stops) && stopsMatch(g.stops, derived) }
            })
          }
          backfillGradientLinks(persisted)
          if (Array.isArray(persisted.savedSystems)) {
            for (const sys of persisted.savedSystems) backfillGradientLinks(sys?.snapshot)
          }
          // v36→v37: semantic architecture picker (Alias/Semantics). 'flat' is
          // the shape every existing system already exports, so nothing changes
          // until the user picks a projection.
          if (!persisted.semanticArchitecture) persisted.semanticArchitecture = 'flat'
          if (Array.isArray(persisted.savedSystems)) {
            for (const sys of persisted.savedSystems) {
              if (sys?.snapshot && !sys.snapshot.semanticArchitecture) sys.snapshot.semanticArchitecture = 'flat'
            }
          }
          // v37→v38: the flat semantic layer was replaced by the Untitled-UI
          // canonical Content/Background/Border catalogue (surface-*/action-*/
          // text-*/icon-* → content-*/background-*/border-*). The old keys don't
          // map cleanly, so clear every theme's role map — Step3's auto-seed
          // repopulates the new roles from each theme's ramps on next render, and
          // the export fills any still-empty role with its recommended tone.
          const clearSemantics = (state: any) => {
            if (!state?.themes || typeof state.themes !== 'object') return
            for (const t of Object.keys(state.themes)) state.themes[t] = {}
          }
          clearSemantics(persisted)
          if (Array.isArray(persisted.savedSystems)) {
            for (const sys of persisted.savedSystems) clearSemantics(sys?.snapshot)
          }
          // v37→v38 USED to force 'numeric' → 'hundreds' here, back when the
          // semantic references were written against the 50–950 labels. That
          // was reversed in v42 (below): Radix numeric 1–12 is the system's
          // naming now, and this line was actively converting people off it on
          // every upgrade — the exact opposite of the default. Left as a no-op
          // rather than deleted so the migration chain stays append-only and
          // the reversal is legible to whoever reads this next.
        }
        if (version < 39) {
          // v38→v39: a theme no longer OWNS ramps, it REFERENCES primitive
          // families (`themePalettes` scales → `themeSources` keys). Every ramp
          // a theme was hiding becomes a real family in Primitives, so the
          // connection the model now guarantees is visible where colour is
          // edited. Slots matching a global ramp reference it instead of
          // duplicating it.
          const toSources = (state: any) => {
            if (!state) return
            const palettes = state.themePalettes ?? {}
            const sources: Record<string, any> = {}
            state.customColors = Array.isArray(state.customColors) ? state.customColors : []
            const globals: Record<string, any> = {
              brand: state.primaryScale, gray: state.grayLightScale, error: state.errorScale,
              warning: state.warningScale, success: state.successScale, info: state.infoScale,
            }
            const globalKey: Record<string, string> = {
              brand: 'accent', gray: 'neutral', error: 'error',
              warning: 'warning', success: 'success', info: 'info',
            }
            const same = (a: any, b: any) =>
              a && b && (a[9] ?? '').toLowerCase() === (b[9] ?? '').toLowerCase()
            for (const [theme, pal] of Object.entries<any>(palettes)) {
              const refs: Record<string, string> = { ...DEFAULT_THEME_SOURCES }
              for (const slot of ['brand', 'gray', 'error', 'warning', 'success', 'info']) {
                const scale = pal?.[slot]
                if (!scale) continue
                if (same(scale, globals[slot])) { refs[slot] = globalKey[slot]; continue }
                // Reuse a family that already carries this ramp, else mint one.
                const base = scale[9] ?? scale[1]
                const hit = state.customColors.find((c: any) => (c.base ?? '').toLowerCase() === (base ?? '').toLowerCase())
                if (hit) { refs[slot] = hit.key; continue }
                const key = slot === 'brand' ? theme : `${theme}-${slot}`
                if (!RESERVED_COLOR_KEYS.includes(key) && !state.customColors.some((c: any) => c.key === key)) {
                  state.customColors.push({
                    key,
                    label: key.replace(/-/g, ' ').replace(/\b\w/g, (m: string) => m.toUpperCase()),
                    base,
                    scale,
                  })
                  refs[slot] = key
                }
              }
              sources[theme] = refs
            }
            state.themeSources = sources
            delete state.themePalettes
          }
          toSources(persisted)
          if (Array.isArray(persisted.savedSystems)) {
            for (const sys of persisted.savedSystems) toSources(sys?.snapshot)
          }
        }
        if (version < 41) {
          // v40→v41: non-flat architectures became editable — projected tokens
          // can be re-pointed at another primitive, stored as refs.
          if (!persisted.architectureOverrides) persisted.architectureOverrides = {}
          if (Array.isArray(persisted.savedSystems)) {
            for (const sys of persisted.savedSystems) {
              if (sys?.snapshot && !sys.snapshot.architectureOverrides) sys.snapshot.architectureOverrides = {}
            }
          }
        }
        if (version < 40) {
          // v39→v40: every COLOURED family gains its own dark ramp (Radix ships
          // each colour as two scales). Until now only the neutral had one, so a
          // dark theme resolved brand/status tints from the LIGHT ramp — tones
          // eased toward a white page and then read on a dark one.
          //
          // Dark semantic values were authored against that approximation, so
          // they no longer correspond: clear the dark themes' role maps and let
          // Step3's auto-seed repopulate them from the new ramps (same approach
          // the v37→v38 catalogue swap took).
          const addDarkRamps = (state: any) => {
            if (!state) return
            const algo = state.colorAlgorithm ?? 'default'
            const shift = state.contrastShift ?? 0
            const darkBg = state.darkBackground
            const gen = (hex?: string) => {
              if (!hex) return {}
              try { return generateFamilyDarkScale(hex, algo, shift, darkBg) } catch { return {} }
            }
            state.primaryDarkScale = gen(state.primaryColor)
            state.errorDarkScale = gen(state.errorColor)
            state.warningDarkScale = gen(state.warningColor)
            state.successDarkScale = gen(state.successColor)
            state.infoDarkScale = gen(state.infoColor)
            if (Array.isArray(state.customColors)) {
              for (const c of state.customColors) c.darkScale = gen(c.base)
            }
            if (state.themes && typeof state.themes === 'object') {
              for (const t of Object.keys(state.themes)) {
                if ((state.themeKinds?.[t] ?? 'light') === 'dark') state.themes[t] = {}
              }
            }
          }
          addDarkRamps(persisted)
          if (Array.isArray(persisted.savedSystems)) {
            for (const sys of persisted.savedSystems) addDarkRamps(sys?.snapshot)
          }
        }
        if (version < 42) {
          // v41→v42: Radix numeric 1–12 becomes THE naming, not just the default
          // for fresh systems. Every ramp was already stored 1–12 internally, so
          // this only relabels — but it relabels the EXPORT too (`colorNaming`
          // drives the swatch strip, the families table AND tokenGenerator /
          // exporters / sectionExport through `toneLabel`), which is the point:
          // the 12 steps are role positions in the Radix model, and 25–950
          // implied a Tailwind lightness ramp the scales no longer are.
          //
          // This IS a rename for anyone still on 'hundreds' — `accent-700`
          // becomes `accent-9` in tokens.json / variables.css. A Figma or JSON
          // integration pinned to the old names has to re-sync. That's accepted
          // deliberately: v38 had been force-converting people onto 'hundreds'
          // on every upgrade, so leaving both behaviours in place meant the
          // naming a system exported depended on which version it upgraded from.
          const toNumeric = (state: any) => {
            if (state) state.colorNaming = 'numeric'
          }
          toNumeric(persisted)
          if (Array.isArray(persisted.savedSystems)) {
            for (const sys of persisted.savedSystems) toNumeric(sys?.snapshot)
          }
        }
        if (version < 43) {
          // v42→v43: ~30 of the 39 semantic roles carried a hardcoded `darkTone`
          // left over from a pre-Radix inversion scheme (25↔950-style mirroring)
          // that was never removed once per-appearance dark ramps + tone IDENTITY
          // became the real model (lib/semanticRoles.ts). Worst offender:
          // background-primary — the PAGE background — pinned to gray tone 12
          // (the ramp's lightest, near-white step) instead of identity tone 1
          // (the ramp's darkest step, which IS `darkBackground`). Any dark theme
          // ever opened in Alias/Semantics had this baked into its stored role
          // map, and auto-populate only overwrites a value that's no longer ANY
          // tone of the current ramp — tone 12 still is one, just the wrong
          // recommendation now, so it silently survives every future resync.
          //
          // Same fix as v38/v40: clear the DARK-kind themes' role maps so
          // Step3's auto-populate (and resolvePreviewTokens' same fallback)
          // re-seed them from the now-correct identity tones. Light-kind themes
          // are untouched — their roles were never wrong.
          const clearDarkSemantics = (state: any) => {
            if (!state?.themes || typeof state.themes !== 'object') return
            for (const t of Object.keys(state.themes)) {
              if ((state.themeKinds?.[t] ?? 'light') === 'dark') state.themes[t] = {}
            }
          }
          clearDarkSemantics(persisted)
          if (Array.isArray(persisted.savedSystems)) {
            for (const sys of persisted.savedSystems) clearDarkSemantics(sys?.snapshot)
          }
        }
        if (version < 44) {
          // v43→v44: "Astryx" replaces Flat Semantic as the default/visible
          // architecture in the picker — same additive-projection mechanism as
          // Categorical/Vibrancy/Tonal (lib/semanticArchitectures.ts), just with
          // the Astryx color-token naming (accent/background/text/icon/status/
          // border). The flat 39-role catalogue underneath is UNCHANGED —
          // colors.semantic/semanticDark/themes still ship exactly as before;
          // picking Astryx only adds a colors.architecture block, same as
          // picking Categorical always did. 'flat' was the only value that
          // existed before this architecture did, so every system on it moves
          // to 'astryx' — otherwise the picker would show a retired card as
          // "selected" for anyone who never touched this setting.
          const toAstryx = (state: any) => {
            if (state?.semanticArchitecture === 'flat') state.semanticArchitecture = 'astryx'
          }
          toAstryx(persisted)
          if (Array.isArray(persisted.savedSystems)) {
            for (const sys of persisted.savedSystems) toAstryx(sys?.snapshot)
          }
        }
        if (version < 45) {
          // v44→v45: an accent-LINKED gradient now references tones of the
          // accent ramp (`GradientStop.tone`) instead of colours invented by
          // ad-hoc HSL math off the raw accent hex. The old derivation produced
          // values that existed nowhere in the primitives, so a gradient that
          // claimed to be "linked to accent" shipped loose hex the plugin and
          // the CSS could never alias back to a token — and the editor could
          // only show that hex, with no primitive to name.
          //
          // Only LINKED gradients convert: an unlocked one is the user's own
          // hand-picked colour and stays exactly as it is. Positions come from
          // the tone signature, since the old stops had no tones to preserve.
          const toToneStops = (state: any) => {
            if (!state || !Array.isArray(state.gradients)) return
            const scale = state.primaryScale && typeof state.primaryScale === 'object'
              ? state.primaryScale
              : undefined
            state.gradients = state.gradients.map((g: any) => {
              if (!g?.linked) return g
              const stops = linkedStopsFor(g.id, scale, Array.isArray(g.stops) ? g.stops : undefined)
              return stops ? { ...g, stops } : g
            })
          }
          toToneStops(persisted)
          if (Array.isArray(persisted.savedSystems)) {
            for (const sys of persisted.savedSystems) toToneStops(sys?.snapshot)
          }
        }
        if (version < 46) {
          // v45→v46: `neutralTint` — how much of the Neutral's colour survives
          // into the page (NEUTRAL_TINTS). Pure backfill: 'subtle' holds the
          // exact constants `backgroundFromBase` used to hardcode, so every
          // upgraded system keeps the page and the ramps it already had. A
          // system that never sets it renders identically forever.
          const seedTint = (state: any) => {
            if (state && !state.neutralTint) state.neutralTint = DEFAULT_NEUTRAL_TINT
          }
          seedTint(persisted)
          if (Array.isArray(persisted.savedSystems)) {
            for (const sys of persisted.savedSystems) seedTint(sys?.snapshot)
          }
        }
        if (version < 47) {
          // v46→v47: `linkNeutralToAccent`. Every entry point to the
          // accent↔neutral link had been retired with Picker Color and the
          // Workbench (`QuickFoundationsPanel`'s default export ended up
          // imported by nobody), and Primitives — the only live editing
          // surface — hardcoded `applyAccentColor(hex, false, …)`. So the
          // neutral silently stopped tracking the accent for everyone.
          //
          // Backfilled by DETECTION rather than a flat default, because the two
          // wrong answers are both bad: defaulting ON would re-derive (i.e.
          // overwrite) a neutral the user hand-picked the next time they touch
          // the accent, and defaulting OFF would leave every already-harmonized
          // system unlinked for no reason. If the stored neutral is what
          // `neutralFromBrand` would produce for the stored accent + tint, it
          // was link-derived → relink; anything else was chosen deliberately →
          // leave it alone. Same rule the live toggle enforces, applied
          // retroactively.
          const seedLink = (state: any) => {
            if (!state || typeof state.linkNeutralToAccent === 'boolean') return
            try {
              const derived = neutralFromBrand(state.primaryColor, state.neutralTint ?? DEFAULT_NEUTRAL_TINT)
              state.linkNeutralToAccent =
                typeof state.grayBaseColor === 'string' &&
                state.grayBaseColor.toLowerCase() === derived.toLowerCase()
            } catch {
              state.linkNeutralToAccent = false
            }
          }
          seedLink(persisted)
          if (Array.isArray(persisted.savedSystems)) {
            for (const sys of persisted.savedSystems) seedLink(sys?.snapshot)
          }
        }
        if (version < 48) {
          // v47→v48: gradients gain a DARK appearance. A linked stop is a
          // `tone` REFERENCE, so its dark value is derivable — resolve the same
          // tone against the system's own `primaryDarkScale` and cache it as
          // `darkColor`. Nothing is invented and nothing is overwritten: only
          // stops that carry a tone are touched, and their light `color` is
          // left exactly as it was.
          //
          // UNLINKED stops are deliberately left with no `darkColor`. A
          // hand-picked hex has no second ramp to resolve against, and guessing
          // one (darkening it, say) would silently restyle a colour the user
          // chose. Absent `darkColor` renders the light colour in both — the
          // pre-v48 behaviour — until they pick a dark value themselves.
          const seedGradientDark = (state: any) => {
            const ramp = state?.primaryDarkScale
            if (!Array.isArray(state?.gradients) || !ramp) return
            state.gradients = state.gradients.map((g: any) => ({
              ...g,
              stops: Array.isArray(g?.stops)
                ? g.stops.map((st: any) =>
                    typeof st?.tone === 'number' && ramp[st.tone] && !st.darkColor
                      ? { ...st, darkColor: ramp[st.tone] }
                      : st)
                : g?.stops,
            }))
          }
          seedGradientDark(persisted)
          if (Array.isArray(persisted.savedSystems)) {
            for (const sys of persisted.savedSystems) seedGradientDark(sys?.snapshot)
          }
        }
        if (version < 49) {
          // v48→v49: `linkStatesToAccent` — the same accent-follows contract
          // `linkNeutralToAccent` already has (v47), extended to the four status
          // primitives. Error/Warning/Success/Info used to harmonize with the
          // accent only through a manual one-shot "match states" button; now
          // it's a persisted link, re-derived on every accent edit like the
          // neutral is.
          //
          // Backfilled by DETECTION, same reasoning as v47: a flat default in
          // either direction is wrong (ON would overwrite hand-picked states on
          // the next accent edit; OFF would unlink every already-harmonized
          // system for no reason). If all four stored states equal what
          // `recommendStateColors(accent)` would produce, they were link-derived
          // (or the one-shot button was used right before upgrading) → relink;
          // anything else was chosen deliberately → leave unlinked.
          const seedStatesLink = (state: any) => {
            if (!state || typeof state.linkStatesToAccent === 'boolean') return
            try {
              const rec = recommendStateColors(state.primaryColor)
              const eq = (a: unknown, b: string) => typeof a === 'string' && a.toLowerCase() === b.toLowerCase()
              state.linkStatesToAccent =
                eq(state.errorColor, rec.error) &&
                eq(state.warningColor, rec.warning) &&
                eq(state.successColor, rec.success) &&
                eq(state.infoColor, rec.info)
            } catch {
              state.linkStatesToAccent = false
            }
          }
          seedStatesLink(persisted)
          if (Array.isArray(persisted.savedSystems)) {
            for (const sys of persisted.savedSystems) seedStatesLink(sys?.snapshot)
          }
        }
        if (version < 50) {
          // v49→v50: Categorical is the only visible semantic architecture.
          // Content · Action · Surface · Status · Border stay as the editing
          // groups; Astryx/shadcn/Vibrancy/Carbon/Tonal projections are retired
          // from the picker (code kept for tests). Every stored choice moves to
          // 'categorical' so the UI never shows a hidden architecture as selected.
          const toCategorical = (state: any) => {
            if (!state) return
            if (state.semanticArchitecture !== 'categorical') state.semanticArchitecture = 'categorical'
          }
          toCategorical(persisted)
          if (Array.isArray(persisted.savedSystems)) {
            for (const sys of persisted.savedSystems) toCategorical(sys?.snapshot)
          }
        }
        if (version < 51) {
          // v50→v51: nested Categorical contract — flat role ids become dotted paths
          // (content.link.default, status.critical.surface, border.focus, …).
          // Remap architectureOverrides so Token Detail edits survive the rename.
          const RENAME: Record<string, string> = {
            'content.link-default': 'content.link.default',
            'content.link-hover': 'content.link.hover',
            'action.primary': 'action.primary.default',
            'action.primary-hover': 'action.primary.hover',
            'action.primary-pressed': 'action.primary.pressed',
            'action.neutral': 'action.secondary.default',
            'action.secondary': 'action.secondary.accent',
            'status.critical-bg': 'status.critical.surface',
            'status.critical-fg': 'status.critical.content',
            'status.critical-surface-solid': 'status.critical.surface-solid',
            'status.critical-on-solid': 'status.critical.on-solid',
            'status.warning-bg': 'status.warning.surface',
            'status.warning-fg': 'status.warning.content',
            'status.success-bg': 'status.success.surface',
            'status.success-fg': 'status.success.content',
            'border.active': 'border.focus',
          }
          const remapCategoricalOverrides = (state: any) => {
            const cat = state?.architectureOverrides?.categorical
            if (!cat || typeof cat !== 'object') return
            const next: Record<string, unknown> = {}
            for (const [id, modes] of Object.entries(cat)) {
              next[RENAME[id] ?? id] = modes
            }
            state.architectureOverrides.categorical = next
          }
          remapCategoricalOverrides(persisted)
          if (Array.isArray(persisted.savedSystems)) {
            for (const sys of persisted.savedSystems) remapCategoricalOverrides(sys?.snapshot)
          }
        }
        if (version < 52) {
          // v51→v52: idempotent override rename — legacy ids still in storage
          // after v51 must map onto nested contract paths at rest, not only
          // at read time in buildArchitectureView.
          const RENAME: Record<string, string> = {
            'content.link-default': 'content.link.default',
            'content.link-hover': 'content.link.hover',
            'action.primary': 'action.primary.default',
            'action.primary-hover': 'action.primary.hover',
            'action.primary-pressed': 'action.primary.pressed',
            'action.neutral': 'action.secondary.default',
            'action.secondary': 'action.secondary.accent',
            'status.critical-bg': 'status.critical.surface',
            'status.critical-fg': 'status.critical.content',
            'status.critical-surface-solid': 'status.critical.surface-solid',
            'status.critical-on-solid': 'status.critical.on-solid',
            'status.warning-bg': 'status.warning.surface',
            'status.warning-fg': 'status.warning.content',
            'status.success-bg': 'status.success.surface',
            'status.success-fg': 'status.success.content',
            'border.active': 'border.focus',
          }
          const fixOverrides = (state: any) => {
            const cat = state?.architectureOverrides?.categorical
            if (!cat || typeof cat !== 'object') return
            const next: Record<string, unknown> = { ...cat }
            for (const [oldId, newId] of Object.entries(RENAME)) {
              if (next[oldId]) {
                if (!next[newId]) next[newId] = next[oldId]
                delete next[oldId]
              }
            }
            state.architectureOverrides.categorical = next
          }
          fixOverrides(persisted)
          if (Array.isArray(persisted.savedSystems)) {
            for (const sys of persisted.savedSystems) fixOverrides(sys?.snapshot)
          }
        }
        if (version < 53) {
          // v52→v53: Untitled UI is the only bundled icon set. Iconify libraries
          // become an AI-context recommendation (`iconAiSource`). Heroicons
          // selections are preserved as that recommendation.
          const migrateIcons = (state: any) => {
            if (!state || typeof state !== 'object') return
            if (!state.iconAiSource) {
              state.iconAiSource = aiSourceFromLegacyLibrary(state.iconLibrary)
            }
            state.iconLibrary = 'untitled'
          }
          migrateIcons(persisted)
          if (Array.isArray(persisted.savedSystems)) {
            for (const sys of persisted.savedSystems) migrateIcons(sys?.snapshot)
          }
        }
        if (version < 54) {
          // v53→v54: Typography gains semantic text roles (label, placeholder,
          // heading, …) that alias the primitive scale, with Desktop / Mobile
          // mappings — Color's primitives/semantics split applied to type.
          const seedRoles = (state: any) => {
            if (!state?.typography || typeof state.typography !== 'object') return
            state.typography.roles = mergeTypeRoles(state.typography.roles)
          }
          seedRoles(persisted)
          if (Array.isArray(persisted.savedSystems)) {
            for (const sys of persisted.savedSystems) seedRoles(sys?.snapshot)
          }
        }
        if (version < 55) {
          // v54→v55: layout primitives densify (radius xs/xl, spacing 0+5,
          // stroke weight ramp) and gain intent aliases — Color/Type's
          // primitives→semantics split applied to radius/spacing/size/stroke.
          const migrateLayout = (state: any) => {
            if (!state || typeof state !== 'object') return
            const base = parseFloat(state.spacing?.['1']) || 4
            const spacing = { ...(state.spacing ?? {}) }
            for (const step of SPACING_STEPS) {
              if (!spacing[step]) spacing[step] = `${Number(step) * base}px`
            }
            state.spacing = spacing

            const radius = { ...(state.radius ?? {}) }
            const lg = parseFloat(radius.lg) || 24
            const graded = scaleRadiusFromLg(lg, radius)
            if (!radius.xs) radius.xs = graded.xs
            if (!radius.xl) radius.xl = graded.xl
            if (!radius.none) radius.none = '0px'
            if (!radius.full) radius.full = '9999px'
            state.radius = radius

            if (!state.stroke || typeof state.stroke !== 'object') {
              state.stroke = { ...STROKE_STANDARD }
            } else {
              state.stroke = { ...STROKE_STANDARD, ...state.stroke }
            }

            state.radiusRoles = mergeLayoutRoles('radius', state.radiusRoles)
            state.spacingRoles = mergeLayoutRoles('spacing', state.spacingRoles)
            state.sizeRoles = mergeLayoutRoles('size', state.sizeRoles)
            state.strokeRoles = mergeLayoutRoles('stroke', state.strokeRoles)

            if (!state.padding) {
              state.padding = { ...PADDING_STANDARD }
            } else {
              const step = nearestSpacingStep(spacing, 20) ?? '5'
              for (const side of ['top', 'right', 'bottom', 'left'] as const) {
                if (!state.padding[side]) state.padding[side] = spacing[step] ?? PADDING_STANDARD[side]
              }
            }
          }
          migrateLayout(persisted)
          if (Array.isArray(persisted.savedSystems)) {
            for (const sys of persisted.savedSystems) migrateLayout(sys?.snapshot)
          }
        }
        if (version < 56) {
          // v55→v56: Grid gains the same primitives→semantics split. Breakpoint
          // scale stays the Tailwind mins; desktop/mobile are aliases (mobile
          // = calc(md − 1px)). Layout frame gets a 4-col mobile recipe.
          const migrateGrid = (state: any) => {
            if (!state || typeof state !== 'object') return
            const grid = { ...(state.grid ?? {}) }
            for (const step of BREAKPOINT_STEPS) {
              const key = breakpointKey(step)
              if (!grid[key]) grid[key] = GRID_STANDARD[key]
            }
            state.grid = grid
            state.breakpointRoles = mergeLayoutRoles('breakpoint', state.breakpointRoles)
            state.gridFrame = mergeGridFrame(state.gridFrame)
          }
          migrateGrid(persisted)
          if (Array.isArray(persisted.savedSystems)) {
            for (const sys of persisted.savedSystems) migrateGrid(sys?.snapshot)
          }
        }
        if (version < 57) {
          // v56→v57: the retired architectures are DELETED, not just hidden.
          // v50 already moved every stored `semanticArchitecture` to
          // 'categorical', so no system points at one — but their
          // `architectureOverrides` buckets survived that migration and are
          // now references to code that no longer exists. Dropping every key
          // but 'categorical' (and 'flat', which is still a valid value even
          // though it has no projection) so the persisted shape matches the
          // shipped `SemanticArchitecture` union.
          //
          // Token Detail edits made under Categorical are untouched — this
          // only removes buckets that could never be read again.
          const KEEP = new Set(['categorical', 'flat'])
          const pruneArchOverrides = (state: any) => {
            const all = state?.architectureOverrides
            if (!all || typeof all !== 'object') return
            for (const arch of Object.keys(all)) {
              if (!KEEP.has(arch)) delete all[arch]
            }
            // Same reason: a stored choice pointing at a deleted architecture
            // would render an empty table with no way back.
            if (state.semanticArchitecture && !KEEP.has(state.semanticArchitecture)) {
              state.semanticArchitecture = 'categorical'
            }
          }
          pruneArchOverrides(persisted)
          if (Array.isArray(persisted.savedSystems)) {
            for (const sys of persisted.savedSystems) pruneArchOverrides(sys?.snapshot)
          }
          // v57→v58: track which plugin build the user last downloaded, so the
          // Sync hub can flag a newer one. Null for existing sessions — we can't
          // know what they already have, and guessing would suppress a real
          // update hint; it self-populates on their next download.
          if (persisted.pluginBuildSeen === undefined) persisted.pluginBuildSeen = null
        }
        // v58→v59: Theme names are now user-editable display labels. Keep
        // engine keys stable and seed an empty label map for existing systems.
        const seedThemeLabels = (state: any) => {
          if (!state || typeof state !== 'object') return
          if (!state.themeLabels || typeof state.themeLabels !== 'object') state.themeLabels = {}
        }
        seedThemeLabels(persisted)
        if (Array.isArray(persisted.savedSystems)) {
          for (const sys of persisted.savedSystems) seedThemeLabels(sys?.snapshot)
        }
        // v59→v60: one library theme owns a Light and a Dark semantic map.
        // Preserve the old map in its preferred appearance; the opposite map
        // starts empty and is deterministically populated from the same ramps
        // when Semantics opens or the preview/export resolver reads it.
        const seedThemeSemantics = (state: any) => {
          if (!state || typeof state !== 'object') return
          if (!state.themeSemantics || typeof state.themeSemantics !== 'object') state.themeSemantics = {}
          for (const key of state.themeOrder ?? Object.keys(state.themes ?? {})) {
            if (state.themeSemantics[key]?.light && state.themeSemantics[key]?.dark) continue
            const preferred: ThemeAppearance = state.themeKinds?.[key] === 'dark' ? 'dark' : 'light'
            const legacy = state.themes?.[key] ?? {}
            state.themeSemantics[key] = {
              light: preferred === 'light' ? { ...legacy } : {},
              dark: preferred === 'dark' ? { ...legacy } : {},
            }
          }
        }
        seedThemeSemantics(persisted)
        if (Array.isArray(persisted.savedSystems)) {
          for (const sys of persisted.savedSystems) seedThemeSemantics(sys?.snapshot)
        }
        // v60→v61: architecture overrides now identify both the library theme
        // and its appearance. Older Categorical overrides used one bare theme
        // key per column; retain each edit under that theme's preferred mode.
        const scopeArchitectureOverrides = (state: any) => {
          if (!state?.architectureOverrides || typeof state.architectureOverrides !== 'object') return
          for (const tokens of Object.values<any>(state.architectureOverrides)) {
            if (!tokens || typeof tokens !== 'object') continue
            for (const [token, modes] of Object.entries<any>(tokens)) {
              if (!modes || typeof modes !== 'object') continue
              const scoped: Record<string, string> = {}
              for (const [mode, value] of Object.entries<string>(modes)) {
                if (mode.includes('::')) {
                  scoped[mode] = value
                  continue
                }
                const appearance: ThemeAppearance = state.themeKinds?.[mode] === 'dark' ? 'dark' : 'light'
                scoped[themeModeKey(mode, appearance)] = value
              }
              tokens[token] = scoped
            }
          }
        }
        scopeArchitectureOverrides(persisted)
        if (Array.isArray(persisted.savedSystems)) {
          for (const sys of persisted.savedSystems) scopeArchitectureOverrides(sys?.snapshot)
        }
        // v61→v62: selector primitives (checkbox / radio / switch / badge dot)
        // became a real collection. They were hardcoded 15/18 in the specimens
        // before, which is exactly what SELECTOR_STANDARD's base of 3 produces —
        // so seeding it is a visual no-op for every existing system. Keeps any
        // step the user already has, the same shape as v55's stroke backfill.
        const seedSelector = (state: any) => {
          if (!state) return
          state.selector = { ...SELECTOR_STANDARD, ...(state.selector ?? {}) }
          state.selectorRoles = mergeLayoutRoles('selector', state.selectorRoles)
        }
        seedSelector(persisted)
        if (Array.isArray(persisted.savedSystems)) {
          for (const sys of persisted.savedSystems) seedSelector(sys?.snapshot)
        }
        // v62→v63: style themes may override the existing foundation
        // collections. Empty means byte-identical global fallback for every
        // system created before this feature.
        const seedThemeFoundations = (state: any) => {
          if (!state || typeof state !== 'object') return
          if (!state.themeFoundations || typeof state.themeFoundations !== 'object') {
            state.themeFoundations = {}
          }
        }
        seedThemeFoundations(persisted)
        if (Array.isArray(persisted.savedSystems)) {
          for (const sys of persisted.savedSystems) seedThemeFoundations(sys?.snapshot)
        }
        // v63→v64: which System Style a theme was adopted from, so Reset
        // knows what to reset TO. Empty for every pre-existing theme, which is
        // the honest answer — they were made by hand and reset to the system
        // defaults, exactly as they would have before this field existed.
        const seedThemeOrigin = (state: any) => {
          if (!state || typeof state !== 'object') return
          if (!state.themeOrigin || typeof state.themeOrigin !== 'object') state.themeOrigin = {}
        }
        seedThemeOrigin(persisted)
        if (Array.isArray(persisted.savedSystems)) {
          for (const sys of persisted.savedSystems) seedThemeOrigin(sys?.snapshot)
        }
        // v64→v66: radius gains Tailwind/HeroUI 2xl/3xl/4xl. Existing xs–xl
        // values stay (a Rounded system keeps 16/24/32 on md/lg/xl); only
        // missing or 0px working steps are filled from the current lg so the
        // new keys exist without restyling saved systems. Bumped to 66 so
        // stores that already wrote v65 before this fill existed re-run it.
        const completeRadius = (state: any) => {
          if (!state || typeof state !== 'object') return
          if (state.radius && typeof state.radius === 'object') {
            state.radius = completeRadiusScale(state.radius)
          }
          const foundations = state.themeFoundations
          if (foundations && typeof foundations === 'object') {
            for (const key of Object.keys(foundations)) {
              const entry = foundations[key]
              if (entry?.radius && typeof entry.radius === 'object') {
                entry.radius = completeRadiusScale(entry.radius)
              }
            }
          }
        }
        completeRadius(persisted)
        if (Array.isArray(persisted.savedSystems)) {
          for (const sys of persisted.savedSystems) completeRadius(sys?.snapshot)
        }
        // v66→v67: the radius ROLES moved off the compensation rungs
        // (sm/2xl/3xl/4xl) onto their natural ones (xs/lg/xl/2xl) — see the note
        // on `RADIUS_ROLES`. Nothing here may change how an existing system
        // LOOKS, so each ramp takes one of two paths:
        //
        //  · A GRADED ramp (anything `scaleRadiusFromLg` produced — the presets,
        //    the roundness slider, the seeded default) is re-graded `lg → 2×lg`.
        //    That is provably value-identical for all four roles at every
        //    preset, because the new rungs are exactly half the old ones
        //    (xs 0.25 vs sm 0.5, lg 1 vs 2xl 2, xl 1.5 vs 3xl 3, 2xl 2 vs 4xl 4).
        //    `radiusRolesAreLegacyDefault` verifies the roles are still the ones
        //    the old ladder shipped before touching anything — a hand-picked
        //    role stays picked, the same detect-don't-assume rule v47/v49 use.
        //
        //  · A HAND-EDITED ramp has no `lg` to re-grade from without reflowing
        //    values someone typed, so it keeps its ramp and gets the OLD rungs
        //    pinned explicitly instead. Same pixels, now stated rather than
        //    inherited from a default that has moved.
        const relevelRadius = (state: any) => {
          if (!state || typeof state !== 'object') return
          const fix = (host: any) => {
            if (!host?.radius || typeof host.radius !== 'object') return
            if (!radiusRolesAreLegacyDefault(host.radiusRoles)) return
            const lg = parseFloat(host.radius.lg)
            if (isGradedRadiusRamp(host.radius)) {
              host.radius = scaleRadiusFromLg(lg * LEGACY_RADIUS_LG_FACTOR, host.radius)
              delete host.radiusRoles
            } else {
              host.radiusRoles = { ...(host.radiusRoles ?? {}), ...LEGACY_RADIUS_ROLE_RUNGS }
            }
          }
          fix(state)
          const foundations = state.themeFoundations
          if (foundations && typeof foundations === 'object') {
            for (const key of Object.keys(foundations)) fix(foundations[key])
          }
        }
        relevelRadius(persisted)
        if (Array.isArray(persisted.savedSystems)) {
          for (const sys of persisted.savedSystems) relevelRadius(sys?.snapshot)
        }
        // v68→v69: auto-sync now turns itself on the moment a system publishes
        // (see setFigmaLastPublishAt) — it used to sit behind a buried toggle
        // that most connected users never found, so every later edit (a color,
        // a font) silently never reached the Figma plugin. Anyone who has
        // ALREADY connected gets the same treatment retroactively: if they've
        // published before but haven't touched the toggle since, turn it on
        // rather than waiting for their next publish to do it.
        if (persisted.figmaLastPublishAt && persisted.autoSyncFigma === false) {
          persisted.autoSyncFigma = true
        }
        // v69→v70: System Style presets no longer bake a scaled type ramp
        // (`comfortable` → 13·15·17·19·21, `compact` → 11·12·14·16·18). An
        // adopted theme opened on a scale that didn't match Variables' base and
        // read as "why are these odd sizes here". Normalize a theme's
        // `typography.sizes`/`lineHeights` back to the STANDARD ramp ONLY when
        // it EXACTLY equals a `buildTypeScale(factor)` output for a non-default
        // factor — i.e. it was preset-baked, not hand-tuned. A hand-edited
        // scale matches no factor and is left untouched (detect-don't-assume,
        // same rule as v47/v49/v67). Density stays a choice on the Text scale
        // slider afterward.
        const bakedScaleFactor = (sizes: any): number | null => {
          if (!sizes || typeof sizes !== 'object') return null
          for (const mode of TYPE_SCALE_MODES) {
            if (mode.factor === 1) continue
            const built = buildTypeScale(mode.factor).sizes
            if (TYPE_SCALE_KEYS.every((k) => (sizes[k] ?? '') === built[k])) return mode.factor
          }
          return null
        }
        const destatScaleTypography = (host: any) => {
          const typo = host?.typography
          if (!typo || typeof typo !== 'object') return
          if (bakedScaleFactor(typo.sizes) === null) return
          typo.sizes = { ...FONT_SIZE_STANDARD }
          typo.lineHeights = { ...LINE_HEIGHT_STANDARD }
        }
        const normalizeThemeTypeScales = (state: any) => {
          if (!state || typeof state !== 'object') return
          const foundations = state.themeFoundations
          if (foundations && typeof foundations === 'object') {
            for (const key of Object.keys(foundations)) destatScaleTypography(foundations[key])
          }
        }
        normalizeThemeTypeScales(persisted)
        if (Array.isArray(persisted.savedSystems)) {
          for (const sys of persisted.savedSystems) normalizeThemeTypeScales(sys?.snapshot)
        }
        // v70→v71: Moss Glow was a decorative lime (`#66c61c` → `#16653a`) that
        // never tracked the accent — the one built-in gradient that stayed on a
        // previous theme's green after every other token had moved. Convert the
        // untouched seed into the same tone-backed link Brand Cover / Aurora
        // already use. A hand-edited Moss Glow won't match the lime signature
        // and is left alone (detect-don't-assume, same rule as v33's brand
        // retint and v47/v49).
        const linkMossGlow = (state: any) => {
          if (!state || !Array.isArray(state.gradients)) return
          const scale = state.primaryScale && typeof state.primaryScale === 'object'
            ? state.primaryScale
            : undefined
          const darkScale = state.primaryDarkScale && typeof state.primaryDarkScale === 'object'
            ? state.primaryDarkScale
            : undefined
          state.gradients = state.gradients.map((g: any) => {
            if (g?.id !== 'moss-glow') return g
            if (Array.isArray(g.stops) && g.stops.some((s: any) => typeof s.tone === 'number')) return g
            if (!Array.isArray(g.stops) || !stopsMatch(g.stops, LEGACY_MOSS_GLOW_STOPS)) return g
            const stops = linkedStopsFor('moss-glow', scale, undefined, darkScale)
            return stops ? { ...g, linked: true, stops } : g
          })
        }
        linkMossGlow(persisted)
        if (Array.isArray(persisted.savedSystems)) {
          for (const sys of persisted.savedSystems) linkMossGlow(sys?.snapshot)
        }
        // v71->v72: `publishId` — the system's stable `/api/tokens` key, see
        // `lib/publishId.ts`. Seeded EMPTY, not minted here, and that is the
        // whole decision: minting during a migration would move every existing
        // system's publish target on the next sync, in the background, with no
        // one having asked — and every Figma file already connected to the old
        // name-derived slug would quietly stop receiving updates. Empty means
        // "still on the legacy key"; the id is minted on the next publish, and
        // `publishTokens` keeps writing the legacy key alongside it for as long
        // as this browser holds that slug's claim, so nothing goes stale.
        //
        // Seeded on saved snapshots too: `loadSystem` spreads a snapshot over
        // state, and a missing key there would set `publishId` to `undefined`,
        // which `isPublishId` rejects but every `?? ''` fallback would not.
        const seedPublishId = (state: any) => {
          if (!state || typeof state !== 'object') return
          if (typeof state.publishId !== 'string') state.publishId = ''
        }
        seedPublishId(persisted)
        if (Array.isArray(persisted.savedSystems)) {
          for (const sys of persisted.savedSystems) seedPublishId(sys?.snapshot)
        }
        return persisted
      },
    }
  )
)
