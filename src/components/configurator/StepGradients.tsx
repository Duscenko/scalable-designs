// Gradients foundation — create named gradients (linear/radial, angle, stops),
import { tableRowClass } from './tableChrome'
// assign them to preview surfaces (card covers, avatars), and ship them in the
// export. Store-driven: every edit writes straight to `gradients` /
// `gradientAssignments`, so the live previews + tokens.json track instantly.
//
// Layout mirrors ColorPrimitives / Step3_SemanticTokens exactly — the three
// tabs of the Color hub must not reshuffle the page when you switch between
// them. Row 1 = a 198px labelled control cell + a wide "what it produces"
// cell; row 2 = the nav's header sharing a line with the tab bar + search;
// row 3 = the 198px nav against a flush, full-bleed table. The per-tab
// mapping of row 1 is: Primitives → family hex + its ramp · Semantics →
// architecture + its contrast chips · Gradients → gradient type + the live bar.

import { useEffect, useRef, useState } from 'react'
import { useDesignStore } from '../../store/useDesignStore'
import { gradientToCss, gradientSlug, makeGradient, isLinkable, linkedStopsFor, stopColorOn, type GradientDef, type GradientStop, type GradientType, type GradientAppearance } from '../../lib/gradients'
import { usePopoverPlacement, ScaleRow } from './colorControls'
import { NAMING_SCHEMES, BASE_TONE } from '../../lib/colorUtils'
import { themeBrandRamp } from '../../lib/themeSources'
import ColorField from '../ui/ColorField'
import RailSelect from '../ui/RailSelect'
import { SlidersIcon } from '../ui/icons'
import VariableCollectionRail from './VariableCollectionRail'

/** The same glyph pair ColorPrimitives' light/dark column headers use — the
 *  eye is already the app's "this is the appearance being previewed" mark, so
 *  gradients don't invent a second one. */
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

const TYPE_OPTIONS: { key: GradientType; label: string }[] = [
  { key: 'linear', label: 'Linear' },
  { key: 'radial', label: 'Radial' },
]

function AssignSelect({ label, value, onChange, gradients, appearance, ramp }: {
  label: string
  value: string | null
  onChange: (id: string | null) => void
  gradients: GradientDef[]
  appearance: GradientAppearance
  ramp?: Record<number, string>
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-xs text-fg-muted w-24 flex-shrink-0">{label}</span>
      <div className="relative flex-1">
        <span
          className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded ring-1 ring-black/10 pointer-events-none"
          style={{ background: value ? gradientToCss(gradients.find((g) => g.id === value) ?? gradients[0], appearance, ramp) : 'transparent' }}
          aria-hidden
        />
        <select
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-line bg-surface text-ui text-fg outline-none focus:border-line-strong appearance-none cursor-pointer"
        >
          <option value="">None</option>
          {gradients.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </div>
    </label>
  )
}

export default function StepGradients({
  previewTheme = 'light', onPreviewThemeChange,
}: {
  previewTheme?: string
  onPreviewThemeChange?: (theme: string) => void
  /** Returns to the System colors family collection without leaving Color. */
  onBackToSystemColors?: () => void
} = {}) {
  const store = useDesignStore()
  const {
    gradients, gradientAssignments, primaryColor, primaryScale, primaryDarkScale,
    colorNaming, themeKinds, themeSources,
    addGradient, updateGradient, removeGradient, setGradientAssignment,
  } = store

  // A gradient has exactly TWO appearances, but `previewTheme` is a THEME key
  // (which may be a custom theme), so it's mapped through `themeKinds` the same
  // way every other appearance-aware surface does it.
  const appearance: GradientAppearance = (themeKinds[previewTheme] ?? 'light') === 'dark' ? 'dark' : 'light'
  const isDark = appearance === 'dark'
  /** Both appearances of the previewed THEME's brand family. A linked stop is a
   *  tone reference; the stored `color`/`darkColor` caches are the GLOBAL accent
   *  and go stale the moment you preview a theme whose brand isn't that family.
   *  Painting always resolves through these ramps (`stopColorOn` / `gradientToCss`)
   *  so the table, rail chips and type-select preview match the theme on screen.
   *  Step N means the same ROLE in both appearances — a linked stop keeps its
   *  tone and swaps ramps, it never inverts. */
  const lightRamp = themeBrandRamp(previewTheme, themeSources, themeKinds, store, 'light')
    ?? primaryScale
  const darkRamp = themeBrandRamp(previewTheme, themeSources, themeKinds, store, 'dark')
    ?? primaryDarkScale
  const ramp = isDark ? darkRamp : lightRamp
  const cssOf = (g: GradientDef, ap: GradientAppearance = appearance) =>
    gradientToCss(g, ap, ap === 'dark' ? darkRamp : lightRamp)
  const hexOf = (s: GradientStop, ap: GradientAppearance = appearance) =>
    stopColorOn(s, ap, ap === 'dark' ? darkRamp : lightRamp)
  /** The token PREFIX a linked stop's tone names in this theme. A stop reads
   *  "tone 9 of the accent", but which family that is depends on the theme, so
   *  the row must say `sky-9` under Sky and `accent-9` under Theme 1 — the same
   *  exported-name rule the Primitives table follows. */
  const rampPrefix = themeSources[previewTheme]?.brand ?? 'accent'

  const [selectedId, setSelectedId] = useState<string | null>(gradients[0]?.id ?? null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)
  const settingsPlace = usePopoverPlacement(settingsRef, settingsOpen, { prefer: 360, max: 520 })
  const selected = gradients.find((g) => g.id === selectedId) ?? gradients[0] ?? null

  useEffect(() => {
    if (!settingsOpen) return
    function onDown(e: MouseEvent) { if (!settingsRef.current?.contains(e.target as Node)) setSettingsOpen(false) }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setSettingsOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [settingsOpen])

  function create() {
    const g = makeGradient()
    addGradient(g)
    setSelectedId(g.id)
  }

  function patch(updates: Partial<Omit<GradientDef, 'id'>>) {
    if (selected) updateGradient(selected.id, updates)
  }

  function updateStop(i: number, key: 'color' | 'pos', v: string | number) {
    if (!selected) return
    // Editing the COLOUR while the dark appearance is previewed writes
    // `darkColor`, not `color` — otherwise judging a gradient on the dark page
    // and nudging a stop would silently repaint the light one too.
    const field = key === 'color' && isDark ? 'darkColor' : key
    const stops = selected.stops.map((s, idx) => (idx === i ? { ...s, [field]: v } : s))
    patch({ stops })
  }

  /** Drop a stop's dark override, so it renders its light colour in both again.
   *  Only meaningful for an unlinked stop — a linked one's dark value is
   *  derived from its tone and is not the user's to clear. */
  function clearStopDark(i: number) {
    if (!selected) return
    const stops = selected.stops.map((s, idx) => {
      if (idx !== i) return s
      const rest = { ...s }
      delete rest.darkColor
      return rest
    })
    patch({ stops })
  }

  // Adding a stop works while LINKED too — it used to be disabled there, which
  // read as "a linked gradient is frozen." Linking only says where a stop's
  // COLOUR comes from (a tone of the accent ramp); how many stops there are and
  // where they sit is still the user's call. A linked gradient therefore grows
  // a tone-backed stop, and `linkedStopsFor` preserves it on the next retint.
  function addStop() {
    if (!selected) return
    const last = selected.stops[selected.stops.length - 1]
    const pos = Math.min(100, Math.max(0, Math.round(((last?.pos ?? 0) + 100) / 2)))
    const tone = last?.tone ?? BASE_TONE
    const stop = locked
      ? {
          tone,
          color: primaryScale[tone] ?? primaryColor,
          darkColor: primaryDarkScale?.[tone] ?? primaryScale[tone] ?? primaryColor,
          pos,
        }
      // An unlinked stop copies whatever the previous one shows in BOTH
      // appearances, so adding a stop while previewing dark doesn't create one
      // that's invisible the moment you switch back.
      : { color: last?.color ?? primaryColor, ...(last?.darkColor ? { darkColor: last.darkColor } : null), pos }
    patch({ stops: [...selected.stops, stop] })
  }

  /** Re-point a linked stop at another tone of the accent ramp. */
  function setStopTone(i: number, tone: number) {
    if (!selected) return
    // One reference, two resolutions — the point of a linked stop.
    const stops = selected.stops.map((s, idx) =>
      idx === i
        ? {
            ...s,
            tone,
            color: primaryScale[tone] ?? s.color,
            darkColor: primaryDarkScale?.[tone] ?? s.darkColor ?? primaryScale[tone] ?? s.color,
          }
        : s)
    patch({ stops })
  }

  function removeStop(i: number) {
    if (!selected || selected.stops.length <= 2) return
    patch({ stops: selected.stops.filter((_, idx) => idx !== i) })
  }

  const linkable = selected ? isLinkable(selected.id) : false
  const locked = !!selected && linkable && selected.linked === true
  const toneNames = (NAMING_SCHEMES.find((s) => s.key === colorNaming) ?? NAMING_SCHEMES[0]).labels
  /** The exported primitive a linked stop references, e.g. `accent-9` — or
   *  `sky-9` while a theme whose brand slot is the Sky family is previewed. */
  const tokenNameFor = (tone: number, ap: GradientAppearance = 'light') =>
    `${rampPrefix}${ap === 'dark' ? '-dark' : ''}-${toneNames[tone - 1] ?? tone}`
  // Three tracks: position · color · row actions. Column mins shrink inside a
  // narrow Color column (@container on the panel below) so the STOPS header
  // doesn't collide with "Add gradient stop".
  const GRID_CLASS =
    'grid grid-cols-[minmax(5.5rem,auto)_minmax(0,1fr)_2.75rem] @min-[32rem]:grid-cols-[minmax(7rem,1fr)_minmax(10rem,1.6fr)_minmax(8rem,1fr)] @min-[40rem]:grid-cols-[minmax(9rem,1fr)_minmax(12rem,1.6fr)_minmax(10rem,1fr)]'

  return (
    <div className="relative h-full flex items-stretch">
      <VariableCollectionRail ariaLabel="Color collections and gradient groups">
        <div role="navigation" aria-label="Gradient groups" className="space-y-0.5">
          {gradients.map((g) => {
            const active = g.id === selectedId
            return (
              <div key={g.id} className="group relative flex items-center">
                <button
                  type="button"
                  onClick={() => setSelectedId(g.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex-1 min-w-0 flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
                    active ? 'bg-elevated text-accent-ui shadow-sm' : 'text-fg-muted hover:bg-elevated/50 hover:text-fg'
                  }`}
                >
                  <span className="w-4 h-4 rounded flex-shrink-0 ring-1 ring-black/10" style={{ background: cssOf(g) }} aria-hidden />
                  <span className="flex-1 min-w-0 truncate text-ui font-medium">{g.name}</span>
                </button>
                {gradients.length > 1 && (
                  <button
                    type="button"
                    onClick={() => { if (selectedId === g.id) setSelectedId(gradients.find((x) => x.id !== g.id)?.id ?? null); removeGradient(g.id) }}
                    aria-label={`Delete ${g.name}`}
                    title={`Delete ${g.name}`}
                    className="absolute right-1.5 w-5 h-5 flex items-center justify-center rounded text-fg-faint hover:text-status-danger opacity-0 group-hover:opacity-100 transition-opacity bg-elevated"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M18 6 6 18M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
            )
          })}
        </div>
        <button type="button" onClick={create} className="mt-2 flex items-center gap-2 rounded-lg border border-dashed border-line-strong px-3 py-2 text-ui text-fg-faint hover:border-fg-faint hover:text-fg transition-colors">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden><path d="M6 2v8M2 6h8" /></svg>
          New gradient
        </button>
      </VariableCollectionRail>

      <div className="@container flex-1 min-w-0 flex flex-col bg-app">
      {/* ── Gradient type + the live bar it produces. Groups | icon-rail is
          FoundationWorkbench. `border-line` since this sits between Groups
          above and the nav + table below. ── */}
      <div className="flex flex-col flex-shrink-0 border-b border-line">
        {/* No per-table title bar: ColorHub's collection already names this
            tab, and Primitives / Semantics ship without a "Color / X"
            breadcrumb. Type selector + live bar sit flush as row 1. */}
        <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-4 gap-y-3 pl-6 lg:pl-8 pr-3 py-5">
          {selected ? (
            <>
              <div className="w-[180px] max-w-full flex-shrink-0 rounded-2xl bg-elevated px-3 py-2.5 @max-[36rem]:w-full @max-[36rem]:max-w-[11rem]">
                <RailSelect
                  value={selected.type}
                  options={TYPE_OPTIONS.map((o) => ({ value: o.key, label: o.label }))}
                  onChange={(t) => patch({ type: t })}
                  ariaLabel="Gradient type"
                  icon={
                    <span
                      className="block w-4 h-4 rounded-full ring-1 ring-black/10"
                      style={{ background: cssOf(selected) }}
                      aria-hidden
                    />
                  }
                />
              </div>
              {/* The bar IS the preview — same role the ramp plays on
                  Primitives: row 1's right cell always shows the thing the
                  left cell's control defines. */}
              {/* Both appearances, side by side. A gradient is judged against
                  the page it ships on, and one bar with a toggle would make
                  comparing them a click apart — the same reason the Primitives
                  table shows its light and dark columns together rather than
                  swapping one. Each half sits on ITS OWN page (`light`/`dark`
                  classes, both defined in index.css) so neither is judged on
                  the wrong backdrop, and clicking a half previews it. */}
              <div className="flex-1 min-w-[9rem] basis-[9rem] flex items-stretch gap-2 @max-[36rem]:w-full @max-[36rem]:min-w-0 @max-[36rem]:basis-full">
                {(['light', 'dark'] as const).map((ap) => (
                  <button
                    key={ap}
                    type="button"
                    onClick={() => onPreviewThemeChange?.(ap)}
                    aria-pressed={appearance === ap}
                    title={appearance === ap ? `${ap} — shown in preview` : `Show ${ap} in the preview`}
                    className={`${ap} flex-1 min-w-0 rounded-[10px] p-1.5 bg-app transition-shadow ring-1 ${
                      appearance === ap ? 'ring-accent-ui' : 'ring-line hover:ring-line-strong'
                    }`}
                  >
                    <span
                      className="block h-9 rounded-[7px] ring-1 ring-black/10"
                      style={{ background: cssOf(selected, ap) }}
                    />
                  </button>
                ))}
              </div>
              {selected.type === 'linear' && (
                <label className="flex items-center gap-2 flex-shrink-0 @max-[36rem]:w-full @max-[36rem]:justify-between">
                  <span className="text-caption text-fg-faint @max-[28rem]:sr-only">Angle</span>
                  <input
                    type="range"
                    min={0}
                    max={360}
                    value={selected.angle}
                    onChange={(e) => patch({ angle: Number(e.target.value) })}
                    className="w-28 max-w-full accent-fg @max-[36rem]:flex-1 @max-[36rem]:min-w-0 @max-[28rem]:w-24"
                    aria-label="Gradient angle"
                  />
                  <span className="text-body font-mono tabular-nums text-fg w-9 text-right flex-shrink-0">{selected.angle}°</span>
                </label>
              )}
              {/* Gear — the name, CSS var and surface assignments. Mirrors
                  Primitives' scale-settings gear in the same spot: the
                  "everything else about this thing" affordance. */}
              <div ref={settingsRef} className="relative flex-shrink-0 @max-[36rem]:ml-auto">
                <button
                  type="button"
                  onClick={() => setSettingsOpen((o) => !o)}
                  aria-haspopup="dialog"
                  aria-expanded={settingsOpen}
                  aria-label="Gradient settings — name and surface assignments"
                  title="Gradient settings"
                  className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg ${
                    settingsOpen ? 'bg-elevated border-line-strong text-fg' : 'border-line-strong bg-surface text-fg-muted hover:text-fg hover:border-fg-faint'
                  }`}
                >
                  <SlidersIcon />
                </button>
                {settingsOpen && (
                  <div
                    role="dialog"
                    aria-label="Gradient settings"
                    style={{ maxHeight: settingsPlace.max }}
                    className={`absolute right-0 z-30 w-80 rounded-2xl border border-line bg-app shadow-xl overflow-y-auto p-4 flex flex-col gap-4 ${
                      settingsPlace.up ? 'bottom-full mb-2' : 'top-full mt-2'
                    }`}
                  >
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-fg-muted">Name</span>
                      <input
                        value={selected.name}
                        onChange={(e) => patch({ name: e.target.value })}
                        className="px-3 py-2 rounded-lg border border-line bg-surface text-ui text-fg outline-none focus:border-line-strong"
                      />
                      <span className="text-mini font-mono text-fg-faint">--gradient-{gradientSlug(selected)}</span>
                    </label>
                    <div className="flex flex-col gap-2 border-t border-line pt-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-semibold text-fg">Assignments</span>
                        <span className="text-caption text-fg-faint">Which gradient renders on each surface in the live previews.</span>
                      </div>
                      <AssignSelect label="Card cover" value={gradientAssignments.cover} gradients={gradients} appearance={appearance} ramp={ramp} onChange={(id) => setGradientAssignment('cover', id)} />
                      <AssignSelect label="Avatars" value={gradientAssignments.avatar} gradients={gradients} appearance={appearance} ramp={ramp} onChange={(id) => setGradientAssignment('avatar', id)} />
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <span className="text-sm text-fg-faint">No gradients yet — create one to get started.</span>
          )}
        </div>
      </div>

      {/* ── Gradient stops table ── */}
      <div className="flex-1 min-h-0 flex items-stretch">
        <div className="flex-1 min-w-0 overflow-auto bg-app">
          {selected ? (
            <div className="min-w-0 w-full">
              <div
                className={`${GRID_CLASS} items-stretch min-h-[52px] border-b border-line bg-app text-mini font-semibold uppercase tracking-widest text-fg-faint sticky top-0 z-10`}
              >
                <span className="flex items-center pl-3 @min-[32rem]:pl-4 border-r border-line min-w-0 truncate">Transparency</span>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 border-r border-line px-3 @min-[32rem]:px-4 min-w-0">
                  <span className="flex-shrink-0">Stops</span>
                  {/* Which appearance the colour cells below EDIT. Same eye
                      affordance and the same `previewTheme` state as the
                      Primitives table's column headers, so "which one am I
                      looking at" is one concept app-wide. */}
                  <span className="flex items-center gap-0.5 normal-case tracking-normal flex-shrink-0">
                    {(['light', 'dark'] as const).map((ap) => (
                      <button
                        key={ap}
                        type="button"
                        onClick={() => onPreviewThemeChange?.(ap)}
                        aria-pressed={appearance === ap}
                        title={appearance === ap ? `Editing the ${ap} appearance` : `Edit the ${ap} appearance`}
                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-mini font-medium transition-colors ${
                          appearance === ap ? 'text-accent-ui bg-accent-ui/[0.08]' : 'text-fg-faint hover:text-fg-muted'
                        }`}
                      >
                        <EyeIcon active={appearance === ap} />
                        {ap}
                      </button>
                    ))}
                  </span>
                  {/* Link-to-accent lives in the STOPS header because it's a
                      statement about where every stop's COLOR comes from, not
                      about one row. Only the three built-ins can derive. */}
                  {linkable && (
                    <button
                      type="button"
                      onClick={() => {
                        if (locked) patch({ linked: false })
                        else patch({ linked: true, stops: linkedStopsFor(selected.id, primaryScale, selected.stops, primaryDarkScale) ?? selected.stops })
                      }}
                      aria-pressed={locked}
                      title={locked
                        ? 'Colors follow the accent. Unlock to edit the stops by hand.'
                        : 'Relink to the accent — replaces the stops with accent-derived colors.'}
                      className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-mini font-medium normal-case tracking-normal transition-colors max-w-full ${
                        locked ? 'bg-elevated text-fg ring-1 ring-line' : 'text-fg-faint hover:text-fg'
                      }`}
                    >
                      {locked ? (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                      ) : (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" /></svg>
                      )}
                      <span className="truncate @max-[34rem]:sr-only">
                        {locked ? 'Linked to accent' : 'Link to accent'}
                      </span>
                    </button>
                  )}
                </span>
                <span className="flex items-center justify-end gap-2 px-2 @min-[32rem]:px-4 py-1.5 min-w-0">
                  <span className="truncate @max-[30rem]:sr-only">Add gradient stop</span>
                  <button
                    type="button"
                    onClick={addStop}
                    aria-label="Add gradient stop"
                    title={locked ? 'Add a stop — it reads an accent tone too' : 'Add a gradient stop'}
                    className="flex items-center justify-center w-7 h-7 rounded-lg border border-line text-fg-faint hover:text-fg hover:border-line-strong hover:bg-elevated transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-fg-faint disabled:hover:border-line"
                  >
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M6 2v8M2 6h8" /></svg>
                  </button>
                </span>
              </div>

              {locked && (
                <p className="px-4 py-2 text-caption text-fg-faint border-b border-line">
                  Each stop reads a <strong className="font-semibold text-fg-muted">tone of your accent ramp</strong>, so the gradient
                  re-resolves through the primitives whenever the accent changes — and the same tone resolves against the accent's
                  dark twin, so the dark appearance comes for free. Pick a different tone below, or unlock to use a free colour instead.
                </p>
              )}

              {selected.stops.map((s, i) => (
                <div
                  key={i}
                  className={`${GRID_CLASS} ${tableRowClass(i, 'grid')}`}
                >
                  <div className="pl-3 @min-[32rem]:pl-4 pr-2 @min-[32rem]:pr-3 py-2.5 border-r border-line">
                    <div className="flex items-center w-full max-w-24 px-2 py-1.5 rounded-lg border border-line bg-surface">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={s.pos}
                        onChange={(e) => updateStop(i, 'pos', Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                        aria-label={`Stop ${i + 1} position`}
                        className="w-full bg-transparent text-body font-mono tabular-nums text-fg outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-mini text-fg-faint">%</span>
                    </div>
                  </div>

                  {/* Linked → the stop IS a primitive, so it names the token
                      and offers the ramp to re-point at. Unlinked → a free
                      colour, so it keeps the raw picker + hex. Showing bare hex
                      for a linked stop was the bug: it named a value that lived
                      nowhere in the system. */}
                  <div className="flex items-center gap-2.5 px-3 @min-[32rem]:px-4 py-2.5 border-r border-line min-w-0">
                    {locked && typeof s.tone === 'number' ? (
                      <>
                        <span
                          className="w-[22px] h-[22px] rounded-md flex-shrink-0 ring-1 ring-black/10"
                          style={{ background: hexOf(s) }}
                          aria-hidden
                        />
                        <div className="flex-1 min-w-0 flex flex-col gap-1">
                          {/* The token NAME carries the appearance, matching the
                              exported prefixes (`accent-9` / `accent-dark-9`) —
                              same tone, other ramp, no inversion. */}
                          <span className="text-body font-mono text-fg-muted truncate" title={`${tokenNameFor(s.tone, appearance)} — ${hexOf(s).toUpperCase()}`}>
                            {tokenNameFor(s.tone, appearance)}
                          </span>
                          <ScaleRow
                            scale={ramp}
                            labels={toneNames}
                            selectedIndex={s.tone}
                            onSelect={(tone) => setStopTone(i, tone)}
                            ariaLabel={`Stop ${i + 1} accent tone`}
                            showNumbers={false}
                            size="thin"
                            joined
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        {/* An unlinked stop has no ramp to resolve against, so
                            its dark value is the user's own pick. Until they
                            make one it inherits the light colour (that IS the
                            pre-dark behaviour) and says so, with a way back. */}
                        <ColorField
                          value={hexOf(s)}
                          onChange={(hex) => updateStop(i, 'color', hex)}
                          ariaLabel={`Stop ${i + 1} ${appearance} color`}
                          size={22}
                        />
                        <span className="flex-1 min-w-0 flex items-center gap-2 text-body font-mono text-fg-muted truncate">
                          {hexOf(s).toUpperCase()}
                          {isDark && !s.darkColor && (
                            <span className="text-mini font-sans text-fg-faint whitespace-nowrap">same as light</span>
                          )}
                          {isDark && s.darkColor && (
                            <button
                              type="button"
                              onClick={() => clearStopDark(i)}
                              title="Drop the dark override — render the light colour in both"
                              className="text-mini font-sans text-fg-faint hover:text-fg transition-colors whitespace-nowrap"
                            >
                              reset
                            </button>
                          )}
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center justify-center px-2 @min-[32rem]:px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => removeStop(i)}
                      disabled={selected.stops.length <= 2}
                      aria-label={`Remove stop ${i + 1}`}
                      title={selected.stops.length <= 2 ? 'A gradient needs at least two stops' : `Remove stop ${i + 1}`}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-fg-faint hover:text-status-danger hover:bg-status-danger/10 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-fg-faint"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-12 text-center text-sm text-fg-faint">
              No gradients yet — create one to get started.
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  )
}
