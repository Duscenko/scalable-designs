import { useDesignStore, DEFAULT_GRAY_DARK_SCALE, type DesignSnapshot } from '../store/useDesignStore'
import { getIconAiSource, PHOSPHOR_LIBRARY } from './iconLibraries'
import { toneLabel, generateAlphaScale, darkShadowMap, BLACK_ALPHA_SCALE, WHITE_ALPHA_SCALE, type ColorNaming } from './colorUtils'
import { resolveFamilyPages } from './colorActions'
import { resolveThemePalette, themeBrandRamp, themeDisplayName, FAMILY_SLOTS, GLOBAL_FAMILY } from './themeSources'
import { myThemeKeys } from './themeLibrary'
import { ALL_ROLES, sourceScaleFor, normalizeThemeValue, type GlobalScales } from './semanticRoles'
import { projectArchitecture, projectCategorical, type ArchOverrides } from './semanticArchitectures'
import { mergeTypeRoles } from './typeRoles'
import { mergeLayoutRoles, mergeGridFrame } from './layoutTokens'
import { gradientToCss, gradientSlug } from './gradients'
import { semanticModesFor, type ThemeAppearance } from './themeModes'
import { resolveThemeFoundations } from './themeFoundations'
import { buildVariableDescriptions } from './tokenDescriptions'
import {
  clampFigmaSyncModes,
  figmaSyncModeId,
  figmaSyncModeLabel,
  uniqueThemesFromModes,
  type FigmaSyncMode,
} from './figmaSyncModes'

// Version of the tokens.json contract shared with the Figma plugin. The plugin
// declares the schema it supports and logs a warning when this is newer.
// v2: primitive color families renamed brand→accent, gray→neutral.
// v3: semantic token KEYS renamed to a readable taxonomy (bg-primary → surface-0,
//     bg-accent-solid → action-primary, fg-* → icon-*, text-*_on-accent → text-on-brand-*).
// v5: `opacity` REMOVED — a standalone 0–100% transparency scale duplicated
//     what `colors.primitiveAlpha` (accent-a-1…12, composited per family
//     against the real page) already covers, and shipping both read as two
//     conflicting answers to "what's the transparency token." The plugin's
//     `tokens.opacity` import is already guarded (`if (tokens.opacity)`), so
//     an older configurator's payload (still carrying the field) keeps
//     importing fine — this bump is for anything that treats an ABSENT field
//     as a real gap rather than "not part of this system."
// v7: SEMANTIC COLOURS CAN NOW BE TRANSLUCENT. `colors.architecture.tokens`
//     ships 8-digit hex (`#rrggbbaa`) for the 16 roles backed by an alpha
//     primitive — ghost-button washes, status tints, the selected row, focus
//     halos, the scrim, the dark-mode elevation rim (see
//     design-plans/alpha-primitives.md). The SHAPE is unchanged, which is
//     exactly why this needs a version signal rather than riding in silently
//     like `shadowsDark`/`gradientsDark` did: those added ignorable KEYS,
//     while this changes the value domain of keys that already existed. A
//     consumer parsing with a 6-digit assumption keeps "working" and silently
//     drops the alpha, painting an opaque scrim over the page it was meant to
//     dim. `colors.primitive` and `colors.themes` (the flat catalogue) stay
//     fully opaque — only the architecture projection carries alpha.
export const TOKEN_SCHEMA_VERSION = 7

// Theme Preview's `previewTheme` is local Configurator state — not a
// DesignSnapshot field — so a theme switch never mutated the store and
// `generateTokenJSON()` kept shipping the same families. Overview then
// preferred leftover `accent-*` keys and the ramp never moved. This hint
// is the previewed key for THIS publish only (no persist / no schema bump).
let activeThemeHint: string | null = null

export function setActiveThemeHint(theme: string | null) {
  const next = theme?.trim()
  activeThemeHint = next ? next : null
}

export function resolveActiveTheme(themeNames: string[], hint = activeThemeHint): string {
  if (hint && themeNames.includes(hint)) return hint
  const own = themeNames.filter((t) => t !== 'light' && t !== 'dark')
  return own[own.length - 1] ?? themeNames[0] ?? 'light'
}

// Flatten a numeric color scale into prefixed string keys, e.g. accent-1 … accent-12
// (or accent-50 … accent-1000 under the "hundreds" naming scheme).
export function flattenScale(
  name: string,
  scale: Record<number, string>,
  naming: ColorNaming,
): Record<string, string> {
  const result: Record<string, string> = {}
  Object.entries(scale).forEach(([k, v]) => {
    if (v) result[`${name}-${toneLabel(naming, Number(k))}`] = v
  })
  return result
}

/**
 * Everything `projectArchitecture()` (and the "Categorical Semantic
 * (AI-Guided)" export builder, `buildCategoricalSymbolicTokens` below) needs
 * to resolve semantic values against the current primitives. Shared so
 * `generateTokenJSON()` and that export builder can never compute two
 * different answers for the same theme/scale — "everything derives from one
 * source" applies to this resolution step too, not just the final JSON call.
 */
export type GenerateTokenOptions = {
  /** Ship this library theme only. Figma sync uses it so leftover
   *  scaffolding (Dark Brand, unused styles) cannot ride along. An
   *  unknown key is ignored — the listed My-themes set still ships. */
  theme?: string | null
  /** Ship these library themes (families + themeModes). Figma columns
   *  come from `modes` when that is also set. */
  themes?: string[] | null
  /** Figma Color Semantics columns — theme × Light/Dark, max 3. Flattens
   *  `themeOrder` / `themes` / `themeLabels` to `theme::appearance` so the
   *  plugin creates one mode per selected appearance. `themeModes` stays
   *  keyed by the real library theme. */
  modes?: FigmaSyncMode[] | null
  /** Plugin file display name (`tokens.project`). Does not change the
   *  `/api/tokens?project=` slug, which still comes from `projectName`. */
  project?: string | null
  /** Workspace section id (`src/lib/workspaceLink.ts`). Emitted as
   *  additive `editor.section` so the plugin can open the page this
   *  publish came from. Omit to leave the payload unchanged. */
  section?: string | null
}

function buildThemeContext(
  store: ReturnType<typeof useDesignStore.getState>,
  scopeTheme?: string | null,
  scopeThemes?: string[] | null,
) {
  // Dark-appearance ramps — EVERY family ships both scales (the Radix model),
  // because dark-theme semantics resolve from the dark twin (see
  // sourceScaleFor). Without them the plugin has nothing to alias a dark brand
  // tint to and would fall back to a loose hex.
  const grayDarkScale = store.grayDarkScale ?? DEFAULT_GRAY_DARK_SCALE
  const hasDarkTheme = store.themeOrder.some((theme) => Boolean(store.themes[theme]))

  // Themes in the user's column order (themeOrder), with any stragglers appended.
  // The plugin maps each theme to one variable-collection mode (column), so this
  // ordering is the Figma column order.
  const allThemeNames = [
    ...store.themeOrder.filter((t) => store.themes[t]),
    ...Object.keys(store.themes).filter((t) => !store.themeOrder.includes(t)),
  ]

  // Sync / export is My themes only. The built-in `light`/`dark` pair is
  // scaffolding (the default violet / near-black reading) — the moment the
  // library has a theme of its own, those seeds must not become Figma modes
  // or leftover Accent/States ramps. `isTouched` used to keep them if anyone
  // had ever written themeSources / foundations / an override on them, which
  // is how a "default dark blue" column survived next to Glass / Neo.
  // A system that genuinely only has light/dark still exports them.
  const ownThemeNames = myThemeKeys(allThemeNames, store.themes)
  const listedNames = ownThemeNames.length ? ownThemeNames : allThemeNames
  const scopedList = (scopeThemes ?? []).filter((key) => listedNames.includes(key))
  const themeNames = scopedList.length
    ? scopedList
    : scopeTheme && listedNames.includes(scopeTheme)
      ? [scopeTheme]
      : listedNames

  // Which primitive FAMILIES land in `colors.primitive`. A brand-new system's
  // `accent` / `neutral` / `error` … globals (the default violet ramps) were
  // flattened unconditionally, so a user who adopted a System Style saw the
  // plugin create an inherited violet "Accent" / "Neutral" / "State" set beside
  // their theme's own `core--minimalist-*` families — and every OTHER style they
  // tried on rode along too.
  //
  //  · `shippedFamilies` — referenced by a theme that's actually being exported
  //    (`themeSources` names one family per slot; a sourceless built-in falls
  //    back to the globals). These always ship.
  //  · A family referenced by SOME theme but NOT a shipped one is another
  //    style's — dropped.
  //  · A `customColors` family referenced by NO theme is a free-standing
  //    palette the user made by hand (a discarded style's families are swept on
  //    delete, so this can't be leftover style noise) — it ships.
  // `black-a` / `white-a` are universal and always ship. `<key>-dark` / `<key>-a`
  // twins gate on the same rule as their base.
  const familiesOf = (names: string[]) => {
    const set = new Set<string>()
    for (const name of names) {
      const src = store.themeSources[name]
      const named = src
        ? FAMILY_SLOTS.map((slot) => src[slot]).filter((key): key is string => Boolean(key))
        : []
      if (named.length) {
        for (const key of named) set.add(key)
      } else if (!ownThemeNames.includes(name)) {
        // Scaffolding light/dark with no slot map still read the globals.
        // A My theme with an empty map must not inherit accent/error — that
        // is the leftover "default dark blue" ramp.
        for (const slot of FAMILY_SLOTS) set.add(GLOBAL_FAMILY[slot])
      }
    }
    return set
  }
  const shippedFamilies = familiesOf(themeNames)
  const anyThemeFamilies = familiesOf(Object.keys(store.themeSources))
  const customKeys = new Set(store.customColors.map((c) => c.key))
  const shipsFamily = (key: string) => {
    const base = key.replace(/-dark$/, '').replace(/-a$/, '')
    if (shippedFamilies.has(base)) return true
    // With My themes, only those themes' families ship. Orphan customs used
    // to ride along — `Dark Brand` minted by editing scaffolding `dark`
    // while Swiss-copy was the real library theme.
    if (ownThemeNames.length) return false
    return customKeys.has(base) && !anyThemeFamilies.has(base)
  }

  // Normalize every semantic value onto its role's CURRENT source ramp: values
  // that are a tone of the ramp pass through; empty or stale ones (left over
  // after a scale was regenerated) snap to the recommended tone. This keeps the
  // export in lockstep with the primitives so the Figma plugin can alias every
  // semantic to a primitive variable instead of holding loose hex values.
  const globalScales: GlobalScales = {
    gray:     store.grayLightScale,
    grayDark: grayDarkScale,
    // Dark twins — a dark theme resolves every family from these.
    dark: {
      gray:    grayDarkScale,
      brand:   store.primaryDarkScale,
      error:   store.errorDarkScale,
      warning: store.warningDarkScale,
      success: store.successDarkScale,
      info:    store.infoDarkScale,
    },
    brand:    store.primaryScale,
    error:    store.errorScale,
    warning:  store.warningScale,
    success:  store.successScale,
    info:     store.infoScale,
  }
  const resolvedPalettes: Record<string, NonNullable<ReturnType<typeof resolveThemePalette>>> = {}
  for (const name of themeNames) {
    const p = resolveThemePalette(store.themeSources[name], store.themeKinds[name] ?? 'light', store)
    if (p) resolvedPalettes[name] = p
  }
  const orderedThemes: Record<string, Record<string, string>> = {}
  const orderedThemeModes: Record<string, Record<ThemeAppearance, Record<string, string>>> = {}
  for (const name of themeNames) {
    const preferred = store.themeKinds[name] ?? 'light'
    const storedModes = semanticModesFor(store.themeSemantics, store.themes, name, preferred)
    // Build from scratch (not a spread of the stored map) so only current
    // catalogue roles ship — stale keys from a prior architecture never leak.
    // The stored map is still READ, per role, as `normalizeThemeValue`'s
    // `current`: that's what preserves a hand-edited token.
    //
    // This used to pass `normalized[role.key]` — the map being built, which is
    // empty on the very line that fills it, so `current` was ALWAYS undefined
    // and normalizeThemeValue always fell through to `recHexFor` (the
    // recommended default). Every manual edit in the Semantics table was
    // silently discarded at export: the configurator showed the edited colour,
    // tokens.json (and therefore Figma) carried the default. Reported as
    // "cambié los tokens en la capa semantic y no se exportó tal cual".
    //
    // Reading the stored value does NOT reintroduce the stale-key leak the
    // comment above guards: only ALL_ROLES keys are ever iterated, and
    // normalizeThemeValue keeps `current` only when it's a real tone of THIS
    // theme's resolved scale — a value left over from another palette fails
    // that check and falls back to the recommendation.
    const normalizedModes = { light: {}, dark: {} } as Record<ThemeAppearance, Record<string, string>>
    for (const appearance of ['light', 'dark'] as const) {
      const palette = resolveThemePalette(store.themeSources[name], appearance, store)
      const normalized: Record<string, string> = {}
      for (const role of ALL_ROLES) {
        const scale = sourceScaleFor(role, appearance, globalScales, palette)
        if (!scale || Object.keys(scale).length === 0) continue
        const hex = normalizeThemeValue(role, appearance, scale, storedModes[appearance]?.[role.key])
        if (hex) normalized[role.key] = hex
      }
      normalizedModes[appearance] = normalized
    }
    orderedThemeModes[name] = normalizedModes
    orderedThemes[name] = normalizedModes[preferred]
  }

  return { grayDarkScale, hasDarkTheme, themeNames, shipsFamily, globalScales, resolvedPalettes, orderedThemes, orderedThemeModes }
}

/** Shared theme/scale resolution for exports, docs and the preview overlay. */
export function themeContextFromStore(store: ReturnType<typeof useDesignStore.getState>) {
  return buildThemeContext(store)
}

/**
 * The Categorical architecture's SYMBOLIC ref tree — group → key → theme →
 * `"{family.tone}"` — i.e. `projectCategorical()`'s raw output, before
 * `resolveCuratedForExport` turns it into hex. Powers the "Categorical
 * Semantic (AI-Guided)" export format (see `exportWizard.ts`), which needs
 * real aliases (`"$value": "{neutral.12}"`), not resolved colour. Shares
 * `buildThemeContext` with `generateTokenJSON()`, so this can never disagree
 * with the hex `colors.architecture` ships when Categorical is the active
 * architecture.
 */
export function buildCategoricalSymbolicTokens(): {
  themeOrder: string[]
  tokens: Record<string, Record<string, Record<string, string>>>
} {
  const store = useDesignStore.getState()
  const { themeNames, globalScales, resolvedPalettes } = buildThemeContext(store)
  const tokens = projectCategorical(
    { themes: {}, themeKinds: store.themeKinds, themePalettes: resolvedPalettes, scales: globalScales, accent: store.primaryColor },
    themeNames,
  )
  return { themeOrder: themeNames, tokens }
}

function flattenThemesForSyncModes<TFoundation>(
  store: ReturnType<typeof useDesignStore.getState>,
  modes: FigmaSyncMode[],
  orderedThemeModes: Record<string, Record<ThemeAppearance, Record<string, string>>>,
  foundationsByTheme: Record<string, TFoundation>,
): {
  themeOrder: string[]
  themes: Record<string, Record<string, string>>
  themeKinds: Record<string, ThemeAppearance>
  themePalettes: Record<string, NonNullable<ReturnType<typeof resolveThemePalette>>>
  themeLabels: Record<string, string>
  themeSources: Record<string, (typeof store.themeSources)[string]>
  foundationsByTheme: Record<string, TFoundation>
  gradientsByTheme: Record<string, Record<string, string>>
} {
  const themeOrder: string[] = []
  const themes: Record<string, Record<string, string>> = {}
  const themeKinds: Record<string, ThemeAppearance> = {}
  const themePalettes: Record<string, NonNullable<ReturnType<typeof resolveThemePalette>>> = {}
  const themeLabels: Record<string, string> = {}
  const themeSources: Record<string, (typeof store.themeSources)[string]> = {}
  const nextFoundations: Record<string, TFoundation> = {}
  const gradientsByTheme: Record<string, Record<string, string>> = {}

  for (const mode of clampFigmaSyncModes(modes)) {
    const values = orderedThemeModes[mode.theme]?.[mode.appearance]
    if (!values) continue
    const id = figmaSyncModeId(mode)
    const name = themeDisplayName(mode.theme, store.themeLabels)
    themeOrder.push(id)
    themes[id] = values
    themeKinds[id] = mode.appearance
    const palette = resolveThemePalette(store.themeSources[mode.theme], mode.appearance, store)
    if (palette) themePalettes[id] = palette
    themeLabels[id] = figmaSyncModeLabel(name, mode.appearance)
    if (store.themeSources[mode.theme]) themeSources[id] = store.themeSources[mode.theme]
    if (foundationsByTheme[mode.theme]) nextFoundations[id] = foundationsByTheme[mode.theme]
    const ramp = themeBrandRamp(mode.theme, store.themeSources, store.themeKinds, store, mode.appearance)
    gradientsByTheme[id] = Object.fromEntries(
      store.gradients.map((g) => [gradientSlug(g), gradientToCss(g, mode.appearance, ramp)]),
    )
  }

  return {
    themeOrder,
    themes,
    themeKinds,
    themePalettes,
    themeLabels,
    themeSources,
    foundationsByTheme: nextFoundations,
    gradientsByTheme,
  }
}

/** Copy a theme-keyed override onto each selected `theme::appearance` so
 *  `applyArchTokenOverrides` can see the slot it already projected. */
function remapOverridesForSyncModes(overrides: ArchOverrides, modes: FigmaSyncMode[]): ArchOverrides {
  const next: ArchOverrides = {}
  for (const [id, byMode] of Object.entries(overrides)) {
    const mapped = { ...byMode }
    for (const mode of modes) {
      const src = byMode[mode.theme] ?? byMode[figmaSyncModeId(mode)]
      if (src) mapped[figmaSyncModeId(mode)] = src
    }
    next[id] = mapped
  }
  return next
}

export function generateTokenJSON(
  source?: DesignSnapshot | ReturnType<typeof useDesignStore.getState>,
  opts?: GenerateTokenOptions,
) {
  const store = (source ?? useDesignStore.getState()) as ReturnType<typeof useDesignStore.getState>
  const { typography, colorNaming } = store
  const syncModes = opts?.modes?.length ? clampFigmaSyncModes(opts.modes) : null
  const scopeThemes = uniqueThemesFromModes(syncModes ?? undefined)
  const { grayDarkScale, hasDarkTheme, themeNames, shipsFamily, globalScales, resolvedPalettes, orderedThemes, orderedThemeModes } = buildThemeContext(
    store,
    opts?.theme,
    scopeThemes.length ? scopeThemes : (opts?.themes ?? null),
  )
  const foundationsByTheme = Object.fromEntries(themeNames.map((theme) => {
    const resolved = resolveThemeFoundations(store, theme)
    return [theme, {
      typography: {
        ...resolved.typography,
        roles: mergeTypeRoles(resolved.typography.roles),
      },
      spacing: resolved.spacing,
      padding: resolved.padding,
      radius: resolved.radius,
      radiusRoles: mergeLayoutRoles('radius', resolved.radiusRoles),
      shadows: resolved.shadows,
      grid: resolved.grid,
      gridFrame: mergeGridFrame(resolved.gridFrame),
      breakpointRoles: mergeLayoutRoles('breakpoint', resolved.breakpointRoles),
      sizes: resolved.sizes,
      sizeRoles: mergeLayoutRoles('size', resolved.sizeRoles),
      selector: resolved.selector,
      selectorRoles: mergeLayoutRoles('selector', resolved.selectorRoles),
      stroke: resolved.stroke,
      strokeRoles: mergeLayoutRoles('stroke', resolved.strokeRoles),
      panelBackground: resolved.panelBackground,
    }]
  }))

  // Merge the referenced color scales into a single primitive map with prefixed
  // keys. `shipsFamily` drops any global family (`accent` / `neutral` / `error`
  // …) the shipped themes don't reference — a system built entirely on custom
  // families no longer carries the pristine violet globals. Secondary scales
  // still only ship when populated.
  const addFamily = (name: string, scale?: Record<number, string>) => {
    if (!scale || !Object.keys(scale).length || !shipsFamily(name)) return
    Object.assign(primitive, flattenScale(name, scale, colorNaming))
  }
  const primitive: Record<string, string> = {}
  addFamily('accent', store.primaryScale)
  addFamily('neutral', store.grayLightScale)
  addFamily('error', store.errorScale)
  addFamily('warning', store.warningScale)
  addFamily('success', store.successScale)
  addFamily('info', store.infoScale)

  if (hasDarkTheme) {
    addFamily('neutral-dark', grayDarkScale)
    addFamily('accent-dark', store.primaryDarkScale)
    addFamily('error-dark', store.errorDarkScale)
    addFamily('warning-dark', store.warningDarkScale)
    addFamily('success-dark', store.successDarkScale)
    addFamily('info-dark', store.infoDarkScale)
  }

  // Custom color families adopt the same prefixed structure (teal-1 … teal-12),
  // dark twin included — but only the ones a shipped theme references, so an
  // adopted System Style's family set doesn't drag along every OTHER style the
  // user tried on.
  store.customColors.forEach((c) => {
    if (!shipsFamily(c.key)) return
    Object.assign(primitive, flattenScale(c.key, c.scale, colorNaming))
    if (hasDarkTheme && c.darkScale && Object.keys(c.darkScale).length) {
      Object.assign(primitive, flattenScale(`${c.key}-dark`, c.darkScale, colorNaming))
    }
  })

  // Alpha twins (Radix custom-palette architecture): the overlay colour that
  // reproduces each solid step when composited over its page — solved from
  // `solid = α·overlay + (1−α)·page` and verified to rebuild the solid exactly.
  // Background-dependent by construction, and therefore per appearance: a light
  // ramp layers black over the light page, a dark ramp layers white over the
  // dark one. Hence both `*-a*` and `*-dark-a*`.
  const primitiveAlpha: Record<string, string> = {}
  const alphaOf = (name: string, scale: Record<number, string>, page = store.pageBackground) => {
    if (!Object.keys(scale).length || !shipsFamily(name)) return
    Object.assign(primitiveAlpha, flattenScale(name, generateAlphaScale(scale, page, 'light'), colorNaming))
  }
  const alphaDarkOf = (name: string, scale?: Record<number, string>, page = store.darkBackground) => {
    if (!hasDarkTheme || !scale || !Object.keys(scale).length || !shipsFamily(name)) return
    Object.assign(primitiveAlpha, flattenScale(`${name}-dark`, generateAlphaScale(scale, page, 'dark'), colorNaming))
  }
  alphaOf('accent', store.primaryScale);   alphaDarkOf('accent', store.primaryDarkScale)
  alphaOf('neutral', store.grayLightScale); alphaDarkOf('neutral', grayDarkScale)
  alphaOf('error', store.errorScale);      alphaDarkOf('error', store.errorDarkScale)
  alphaOf('warning', store.warningScale);  alphaDarkOf('warning', store.warningDarkScale)
  alphaOf('success', store.successScale);  alphaDarkOf('success', store.successDarkScale)
  alphaOf('info', store.infoScale);        alphaDarkOf('info', store.infoDarkScale)
  // Custom families grow against their theme's paper — same page the solid
  // ramp used. Solving against the open system's globals made tone 1 of a
  // Glass accent-alpha land near-opaque (`#f0fdffe3`) instead of transparent.
  store.customColors.forEach((c) => {
    const pages = resolveFamilyPages(store, c.key)
    alphaOf(c.key, c.scale, pages.light)
    alphaDarkOf(c.key, c.darkScale, pages.dark)
  })

  // Neutral alpha primitives — a fixed opacity ladder (Radix blackA/whiteA),
  // not derived from any family's solid. Unlike the twins above, these don't
  // vary per system: no page/appearance argument, one appearance each. See
  // design-plans/alpha-primitives.md for why this is a second, separate
  // contract rather than a 7th call to alphaOf.
  Object.assign(primitiveAlpha, flattenScale('black-a', BLACK_ALPHA_SCALE, colorNaming))
  Object.assign(primitiveAlpha, flattenScale('white-a', WHITE_ALPHA_SCALE, colorNaming))

  // No per-theme namespaced ramps any more: a theme REFERENCES a family, and
  // every family already shipped above under its own key. The theme's semantics
  // therefore alias the same primitive variables the families export.
  // (themeNames/globalScales/resolvedPalettes/orderedThemes are all resolved
  // above, by the shared `buildThemeContext` call.)

  const syncFlat = syncModes
    ? flattenThemesForSyncModes(store, syncModes, orderedThemeModes, foundationsByTheme)
    : null
  const exportOrder = syncFlat?.themeOrder.length ? syncFlat.themeOrder : themeNames
  const exportThemes = syncFlat?.themeOrder.length ? syncFlat.themes : orderedThemes
  const exportKinds = syncFlat?.themeOrder.length ? syncFlat.themeKinds : store.themeKinds
  const exportPalettes = syncFlat?.themeOrder.length ? syncFlat.themePalettes : resolvedPalettes
  const exportLabels = syncFlat?.themeOrder.length
    ? syncFlat.themeLabels
    : Object.fromEntries(themeNames.map((t) => [t, themeDisplayName(t, store.themeLabels)]))
  const exportSources = syncFlat?.themeOrder.length
    ? syncFlat.themeSources
    : Object.fromEntries(
        themeNames
          .filter((t) => store.themeSources[t])
          .map((t) => [t, store.themeSources[t]]),
      )
  const exportFoundations = syncFlat?.themeOrder.length ? syncFlat.foundationsByTheme : foundationsByTheme
  const exportGradientsByTheme = syncFlat?.themeOrder.length
    ? syncFlat.gradientsByTheme
    : Object.fromEntries(
        themeNames.map((t) => {
          const ramp = themeBrandRamp(t, store.themeSources, store.themeKinds, store)
          const appearance = (store.themeKinds[t] ?? 'light') === 'dark' ? 'dark' : 'light'
          return [
            t,
            Object.fromEntries(
              store.gradients.map((g) => [gradientSlug(g), gradientToCss(g, appearance, ramp)]),
            ),
          ]
        }),
      )

  // Semantic architecture projection (Alias/Semantics picker). Additive: the
  // flat shape above always ships (plugin contract, schemaVersion 3); a
  // non-flat choice ships its projection alongside under colors.architecture.
  const architecture = projectArchitecture(
    store.semanticArchitecture,
    {
      themes: exportThemes,
      themeKinds: exportKinds,
      themePalettes: exportPalettes,
      scales: globalScales,
      accent: store.primaryColor,
      pageBackground: store.pageBackground,
      darkBackground: store.darkBackground,
    },
    store.errorColor,
    // Was missing entirely — table edits (setArchitectureOverride) never
    // reached the actual export, only the live Alias/Semantics preview.
    syncModes
      ? remapOverridesForSyncModes(store.architectureOverrides[store.semanticArchitecture] ?? {}, syncModes)
      : (store.architectureOverrides[store.semanticArchitecture] ?? {}),
    // Sync modes flatten to `theme::appearance` so Categorical columns match
    // the Light/Dark Figma modes. Whole-system export still uses themeNames.
    exportOrder,
  )

  return {
    // Contract version the Figma plugin checks on import. Bump only on a
    // breaking change to the payload shape; the plugin warns on a mismatch.
    schemaVersion: TOKEN_SCHEMA_VERSION,
    project: opts?.project?.trim() || store.projectName,
    colors: {
      // The page background every ramp is generated against and every alpha
      // token composites over (Radix custom-palette "background" input).
      background: store.pageBackground,
      primitive,
      // Alpha twins of the light-appearance primitives, derived vs background.
      primitiveAlpha,
      // 'semantic'/'semanticDark' stay for Figma-plugin compatibility; 'themes'
      // carries the full multi-theme map (incl. user-added themes), and
      // 'themeOrder' is the column order the plugin creates modes in.
      semantic: orderedThemeModes[themeNames[0]]?.light ?? orderedThemes.light ?? store.themes.light ?? {},
      semanticDark: orderedThemeModes[themeNames[0]]?.dark ?? orderedThemes.dark ?? store.themes.dark ?? {},
      themes: exportThemes,
      // Additive canonical shape: a library theme owns both appearances.
      // `themes` above is the Figma column slice (preferred appearance, or
      // `theme::appearance` when Sync picked Light/Dark modes).
      themeModes: orderedThemeModes,
      themeOrder: exportOrder,
      // Which library theme Overview / Cover should read as "the" brand
      // ramp. Additive — an older plugin ignores it and keeps themeOrder[0].
      activeTheme: resolveActiveTheme(themeNames),
      // Which primitive family each shipped theme reads per slot — the plugin
      // groups Color Primitives (Accents / Neutrals / States/<theme>) from this,
      // so a leftover global `error` cannot sit beside `glass-error` unlabeled.
      themeSources: exportSources,
      themeLabels: exportLabels,
      // Radix-style panel treatment for surface-1 (cards, panels, sections).
      panelBackground: store.panelBackground,
      // Which semantic architecture the system standardizes on, plus the
      // projected token structure when it isn't the flat default.
      semanticArchitecture: store.semanticArchitecture,
      ...(architecture ? { architecture } : {}),
    },
    // Complete, resolved foundation collections per library theme. Additive:
    // existing consumers keep reading the global fields below, while clients
    // that understand style themes can switch every foundation with one key.
    foundationsByTheme: exportFoundations,
    typography: {
      fontFamily: typography.fontFamily,
      headingFontFamily: typography.headingFontFamily ?? typography.fontFamily,
      sizes: typography.sizes,
      lineHeights: typography.lineHeights,
      weights: typography.weights,
      roles: mergeTypeRoles(typography.roles),
    },
    spacing: store.spacing,
    spacingRoles: mergeLayoutRoles('spacing', store.spacingRoles),
    // Per-side surface padding for padded surfaces (cards, tiles, panels).
    // Resolved px of `spacing-inset-surface` (step 5 on a fresh system).
    padding: store.padding,
    radius: store.radius,
    radiusRoles: mergeLayoutRoles('radius', store.radiusRoles),
    // Named gradients (slug → CSS) + which one drives each preview surface.
    gradients: Object.fromEntries(store.gradients.map((g) => [gradientSlug(g), gradientToCss(g)])),
    // The dark appearance, ADDITIVE and keyed by the SAME slugs — a consumer
    // that only knows `gradients` reads byte-identical values to before. A
    // gradient with no dark override resolves to its light CSS here, so the map
    // is always complete: a plugin can bind a dark mode without having to check
    // which entries exist.
    gradientsDark: Object.fromEntries(store.gradients.map((g) => [gradientSlug(g), gradientToCss(g, 'dark')])),
    // Per-THEME gradients. A linked stop references a tone of "the accent", and
    // which family that is depends on the theme (`themeSources[t].brand`) — so
    // a system with a teal theme ships a teal gradient for it, not the default
    // accent's. Additive under a new key, exactly like `gradientsDark` and
    // `shadowsDark` before it: `gradients`/`gradientsDark` stay byte-identical
    // (they are still the GLOBAL accent's resolution, which is what the
    // built-in light/dark themes give), so an older consumer is unaffected and
    // no `schemaVersion` bump is needed. The Figma plugin DOES consume
    // gradients — it ships `Gradient/<slug>` + `(Dark)` paint styles, and it
    // reads THIS key first (`previewGradients`), because the root maps go
    // stale the moment a theme is minted from another brand family: measured
    // on a shipped green system, root `gradients` was still the default violet
    // and painted four hexes that exist in no `colors.primitive` entry.
    // Complete for every shipped theme
    // (`themeNames` = My themes, or light/dark when the library is empty).
    gradientsByTheme: exportGradientsByTheme,
    gradientAssignments: (() => {
      const slugOf = (id: string | null) => {
        const g = store.gradients.find((x) => x.id === id)
        return g ? gradientSlug(g) : null
      }
      return { cover: slugOf(store.gradientAssignments.cover), avatar: slugOf(store.gradientAssignments.avatar) }
    })(),
    shadows: store.shadows,
    // Dark twin of the elevation ramp — ADDITIVE, exactly like `gradientsDark`
    // beside `gradients`: `shadows` is unchanged, this is a complete parallel
    // map under the SAME keys, so a consumer never has to test which entries
    // exist and an older plugin simply ignores the field (hence no
    // schemaVersion bump). It exists because the ramp's near-black shadow
    // colour IS the dark page: unoverridden, every elevation composites to
    // within 0.36 of one 8-bit level of the background. See `darkShadow`.
    shadowsDark: darkShadowMap(store.shadows),
    grid: store.grid,
    gridFrame: mergeGridFrame(store.gridFrame),
    breakpointRoles: mergeLayoutRoles('breakpoint', store.breakpointRoles),
    sizes: store.sizes,
    sizeRoles: mergeLayoutRoles('size', store.sizeRoles),
    // Additive, so no schemaVersion bump — same call as `shadowsDark` /
    // `gradientsDark`: a plugin that predates this key ignores it.
    selector: store.selector,
    selectorRoles: mergeLayoutRoles('selector', store.selectorRoles),
    stroke: store.stroke,
    strokeRoles: mergeLayoutRoles('stroke', store.strokeRoles),
    // Plugin v5 looked for `borders.width` and skipped the Border collection
    // when it was absent. Same steps as `stroke`, under the name the older
    // plugin already reads — v6 prefers `stroke` and treats this as a copy.
    borders: { width: store.stroke },
    icons: {
      library: PHOSPHOR_LIBRARY.key,
      name: PHOSPHOR_LIBRARY.label,
      package: PHOSPHOR_LIBRARY.npm,
      repo: PHOSPHOR_LIBRARY.repo,
      prefix: PHOSPHOR_LIBRARY.key,
      aiSource: (() => {
        const src = getIconAiSource(store.iconAiSource)
        return { key: src.key, label: src.label, repo: src.repo, npm: src.npm }
      })(),
      custom: store.customIcons,
    },
    style: null,
    // 'atoms' is the canonical field name the Figma plugin expects.
    atoms: store.selectedComponents,
    // Figma Variable.description copy — collection → var name → text.
    // Additive: older plugins ignore. Built from ALL_ROLES, CATEGORICAL_ROLE_COMMENTS,
    // LAYOUT_ROLES, TYPE_ROLES (same catalogues as the Semantics table / Skill).
    descriptions: buildVariableDescriptions(),
    // Additive workspace handshake. Older plugins ignore it. Not a store
    // field — only present when the publisher passed `opts.section`.
    ...(opts?.section?.trim() ? { editor: { section: opts.section.trim() } } : {}),
  }
}

export function downloadTokenJSON() {
  const tokens = generateTokenJSON()
  const blob = new Blob([JSON.stringify(tokens, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${tokens.project || 'scalable-designs'}-tokens.json`
  a.click()
}
