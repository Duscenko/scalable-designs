import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { usePreviewTokens, resolvePreviewTokens } from '../../lib/previewTokens'
import { resolveStylePreviewTokens, stylePreviewStore, type StylePreview } from '../../lib/stylePreviewOverlay'
import { useDesignStore } from '../../store/useDesignStore'
import { readableInk } from '../../lib/colorUtils'
import { themeDisplayName } from '../../lib/themeSources'
import { COMPONENTS, type ComponentDef } from '../../lib/componentCatalogue'
import { SystemCollage } from '../preview/artefacts/SystemCollage'
import { COLLAGE_TILE_COUNT } from '../../lib/randomTheme'
import { InspectorModeProvider, InspectorOverlay } from '../preview/artefacts/TokenInspector'
import { Live, PhosphorWeightProvider, TokenIcon, type AxisValues, type IconConcept, type IconOpts } from './docs/specimens'
import type { PreviewTokens } from '../preview/ButtonPreview'
import { PHOSPHOR_CORE } from '../../lib/iconLibraries'
import ThemeQuickSettingsRail from './ThemeQuickSettingsRail'
import SemanticTokenDrawer from './SemanticTokenGroups'
import GitHubConnectView from './GitHubConnectView'
import FigmaSyncView from './FigmaSyncView'
import IntegrationStatusRail from './IntegrationStatusRail'
import DocsView, { OVERVIEW_KEY } from './DocsView'
import { type DocsRailRow } from './DocsRail'
import { FOUNDATION_DOCS } from './docs/foundationDocs'
import { COLOR_RAIL_COLLAPSED_WIDTH, COLOR_RAIL_WIDTH, PANEL_W, RailToggle, THEME_BAND_H } from './colorControls'
import { CHROME_CONTROL_SHELL, SHELL_CHROME, THEME_LIBRARY_WIDTH, WORKSPACE_CHROME } from './themeWorkspaceLayout'
import type { FigmaPublishState } from '../../lib/figmaSync'
import type { FigmaSyncMode } from '../../lib/figmaSyncModes'
import type { GitHubPushState } from '../../lib/github'
import { appearanceFromModeKey, themeModeKey, type ThemeAppearance } from '../../lib/themeModes'
import { useI18n } from '../../lib/i18n'
import { ThemeHubHeaderActionsProvider } from './themeHubHeaderActions'
import { FigmaGlyph, InspectGlyph } from '../ui/icons'
import { adoptPreset } from '../../lib/adoptPreset'
import { myThemeKeys } from '../../lib/themeLibrary'
import { showToast } from '../ui/Toast'

// No `code` view here: the workspace's own tab strip already carries
// `Code Format` one row up, and two doors to the same screen read as two
// screens. Don't re-add it as a fourth icon — route to the tab instead.
type HubView = 'artefacts' | 'components' | 'documentation'
export type ThemeHubSurface = HubView | 'github' | 'figma'

const HUB_VIEWS: { key: HubView; label: string }[] = [
  { key: 'artefacts', label: 'Artefacts' },
  { key: 'components', label: 'Components' },
  { key: 'documentation', label: 'Documentation' },
]

// The overview row + article used to read "System reference" — worded for the
// top-nav Docs destination, which never actually renders it (`allowReference`
// is false there). This surface is ALWAYS scoped to the previewed theme, so the
// row names it as the theme's own whole-system sheet and the article's title is
// the theme's name (see `overviewTitle` threaded to `DocsView` below).
const DOC_ROWS: DocsRailRow[] = [
  { key: OVERVIEW_KEY, label: 'Theme reference', heading: 'Theme doc' },
  ...FOUNDATION_DOCS.map((doc) => ({ key: doc.key, label: doc.label })),
]

// `themeDisplayName` is shared from `lib/themeSources` — the rail, this hub and
// the Export wizard all name a theme the same way.

const HUB_ICON_SOURCES: Record<HubView, string> = {
  artefacts: '/icons/settings/artefacts.svg',
  components: '/icons/theme-hub-icons/Icon/components.svg',
  documentation: '/icons/theme-hub-icons/Icon/doc.svg',
}

// The glyph is a MASK painted with `currentColor`, not an `<img>` under an
// `invert` filter. The filter approach only works while every source file is
// filled the same near-white — a new icon dropped in with a different fill
// (components.svg ships `fill="white"`) inverts to a different ink than its
// neighbours, and neither state can follow the button's own colour. Masking
// makes active (dark ink on the white pill) and inactive (page ink, dimmed)
// derive from one place, in both chrome themes. Same fix as
// FoundationIconRail's active glyph.
function ViewIcon({ view }: { view: HubView }) {
  const source = `url('${HUB_ICON_SOURCES[view]}') center / contain no-repeat`
  return <span aria-hidden className="h-3.5 w-3.5 bg-current" style={{ WebkitMask: source, mask: source }} />
}

function ThemeViewSwitcher({ view, onChange }: {
  view: HubView
  onChange: (view: HubView) => void
}) {
  const { t } = useI18n()
  return (
    <div role="tablist" aria-label={t('Theme Preview views')} onKeyDown={(event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
        event.preventDefault()
        const current = Math.max(0, HUB_VIEWS.findIndex((item) => item.key === view))
        const next = (current + (event.key === 'ArrowRight' ? 1 : HUB_VIEWS.length - 1)) % HUB_VIEWS.length
        onChange(HUB_VIEWS[next].key)
      }} className="flex h-8 items-center gap-0.5 rounded-lg p-0.5 border border-line bg-tab-bar">
        {HUB_VIEWS.map((item) => {
          const active = item.key === view
          return <button key={item.key} type="button" role="tab" aria-selected={active} tabIndex={active ? 0 : -1} aria-label={t(item.label)} title={t(item.label)} onClick={() => onChange(item.key)} className={`grid h-7 min-w-7 place-items-center rounded-md px-1.5 transition-[color,background-color,transform] duration-150 ease-[var(--ease-out-quint)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ui/50 ${active ? 'bg-inverse-action text-inverse-action-ink shadow-sm' : 'text-fg-faint hover:bg-surface hover:text-fg'}`}><ViewIcon view={item.key} /></button>
        })}
    </div>
  )
}

// Sun / moon assets carry a hardcoded `stroke="white"`, so they're painted as
// CSS masks to follow the button's ink — same technique as ThemeViewSwitcher's
// `ViewIcon` and the Themes Library toggle.
const APPEARANCE_ICON: Record<ThemeAppearance, string> = {
  light: '/icons/settings/light-mode.svg',
  dark: '/icons/settings/dark-mode.svg',
}

/**
 * ONE-icon toggle for the board's appearance: a dark board shows the sun (click
 * to go light), a light board shows the moon — the icon is the action, not the
 * current state. Sized to match `ThemeViewSwitcher` beside it (same `h-8`
 * pill, same `h-7 min-w-7` button). Flips the PREVIEW only, never the workspace
 * chrome.
 */
function PreviewAppearanceButton({ value, onChange }: {
  value: ThemeAppearance
  onChange: (appearance: ThemeAppearance) => void
}) {
  const { t } = useI18n()
  const next: ThemeAppearance = value === 'dark' ? 'light' : 'dark'
  const mask = `url("${APPEARANCE_ICON[next]}") center center / contain no-repeat`
  return (
    <div className="flex h-8 items-center rounded-lg p-0.5 border border-line bg-tab-bar">
      <button
        type="button"
        onClick={() => onChange(next)}
        aria-label={t('Preview in {appearance}', { appearance: t(next) })}
        title={t('Preview in {appearance}', { appearance: t(next) })}
        className="grid h-7 min-w-7 place-items-center rounded-md px-1.5 transition-[color,background-color,transform] duration-150 ease-[var(--ease-out-quint)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ui/50 text-fg-faint hover:bg-surface hover:text-fg"
      >
        <span aria-hidden className="h-3.5 w-3.5 bg-current" style={{ WebkitMask: mask, mask }} />
      </button>
    </div>
  )
}

function IntegrationContextBar({ view, onBack }: { view: 'github' | 'figma'; onBack: () => void }) {
  const { t } = useI18n()
  return (
    <header className={`flex h-[54px] flex-shrink-0 items-center gap-2 border-b border-line ${WORKSPACE_CHROME} px-4`}>
      <HubBreadcrumb section={t(view === 'github' ? 'GitHub' : 'Figma')} onBack={onBack} />
    </header>
  )
}

interface HubRailRow<Key extends string> {
  key: Key
  label: string
  icon?: ReactNode
}

function HubBreadcrumb({ section, onBack }: { section: string; onBack?: () => void }) {
  const { t } = useI18n()
  return (
    <nav aria-label={t('Breadcrumb')} className="min-w-0 flex items-center gap-2 text-mini text-fg-faint">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label={t('Back to Theme preview')}
          className="inline-flex min-w-0 items-center gap-1 rounded px-1 py-1 -ml-1 font-medium text-fg-muted transition-colors hover:bg-elevated hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ui/50"
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M7.5 2.5 4 6l3.5 3.5" />
          </svg>
          <span className="truncate">{t('Theme preview')}</span>
        </button>
      ) : (
        <span className="truncate">{t('Theme preview')}</span>
      )}
      <span aria-hidden>/</span>
      <span className="truncate font-medium text-fg">{section}</span>
    </nav>
  )
}

/**
 * Inspector mode toggle — Figma `41:1544` / `41:1545` (Button - Inspect tokens).
 * Same outline shell as `ThemeResetButton` (`41:1550`, now rendered only by
 * Variables · Semantics): border is the boundary,
 * no `bg-tab-bar` fill. The view switcher beside them keeps the filled track
 * because it is a segmented control, not an outline action.
 *
 * It's a TOGGLE, not a momentary key: reading a role, going to the rail and
 * coming back for the next one is a sequence, and a mode that dropped every
 * time the pointer left the canvas couldn't survive it.
 *
 * Inspect-on fills the inner pill with `--accent-solid` / `--accent-ink` so
 * the mode reads as armed without inventing a second selected-chip language.
 */
function InspectorToggle({ active, onChange }: { active: boolean; onChange: (v: boolean) => void }) {
  const { t } = useI18n()
  const label = t('Inspect tokens')
  return (
    <div className="flex h-8 items-center rounded-lg border border-line p-0.5">
      <button
        type="button"
        onClick={() => onChange(!active)}
        aria-pressed={active}
        aria-label={label}
        title={`${label} — ${t('point at a component or the page to see the roles that paint it')}`}
        className={`flex h-7 items-center gap-1.5 rounded-md px-2 text-caption font-normal tracking-[0.18px] transition-[color,background-color,transform] duration-150 ease-[var(--ease-out-quint)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ui/50 ${
          active
            ? 'bg-accent-solid text-accent-ink'
            : 'text-fg-faint hover:bg-surface hover:text-fg'
        }`}
      >
        <InspectGlyph size={16} />
        {label}
      </button>
    </div>
  )
}

/**
 * Figma sync — a DESTINATION in the canvas header, beside Inspect tokens.
 *
 * The only door to the Figma page was the `SyncTrack` pinned to the bottom of
 * the Themes library rail: the least-looked-at corner of the workspace, for the
 * handoff this product is largely about. Same outline shell as
 * `InspectorToggle`, so it joins the action cluster rather than inventing a
 * second button language beside it.
 *
 * Deliberately NOT a second status readout. The footer track and the Figma page
 * itself both report publish state; a third would be the "two doors to the same
 * facts" duplication this hub already avoids. It says where it goes, nothing
 * more — which is also why it is a plain action, not an `aria-pressed` toggle
 * like Inspect: the surface it opens replaces this header entirely, so there is
 * no state here for it to reflect.
 *
 * The mark renders at 14 against Inspect's 16: `FigmaGlyph` is a 38×57 mark
 * that fills its full height, so matching the square glyph's number would read
 * visibly taller. 14 is the size `SyncTrack` already uses.
 */
function FigmaSyncButton({ onOpen }: { onOpen: () => void }) {
  const { t } = useI18n()
  return (
    <div className="flex h-8 items-center rounded-lg border border-line p-0.5">
      <button
        type="button"
        onClick={onOpen}
        aria-label={t('Sync with Figma')}
        title={t('Sync with Figma')}
        className="flex h-7 items-center gap-1.5 rounded-md px-2 text-caption font-normal tracking-[0.18px] text-fg-faint transition-[color,background-color,transform] duration-150 ease-[var(--ease-out-quint)] hover:bg-surface hover:text-fg active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ui/50"
      >
        <FigmaGlyph size={14} />
        {t('Sync')}
      </button>
    </div>
  )
}

// Hue dragging is a VIEW-ONLY optimistic paint on resolved preview tokens.
function withAccentPreview(tokens: PreviewTokens, accentPreview: string | null): PreviewTokens {
  if (!accentPreview) return tokens
  return {
    ...tokens,
    brandSolid: accentPreview,
    brandText: accentPreview,
    onBrand: readableInk(accentPreview, tokens.neutralText, tokens.surface),
    archTokens: tokens.archTokens ? {
      ...tokens.archTokens,
      'action.primary.default': accentPreview,
      'content.accent': accentPreview,
      'border.focus': accentPreview,
    } : undefined,
  }
}

// The quick-settings rail stays outside the framed canvas so its property
// controls remain fixed while the artefacts themselves scroll.
/** Breathing room between the docked drawer's edge and the first artefact —
 *  without it the board butts straight against the panel. */
const DRAWER_GUTTER = 24

function ArtefactsView({
  previewTheme, previewAppearance, accentPreview, stylePreview, drawerOpen,
  inspecting, tileAppearances, boardAppearance, onPickRole, onOpenRoleInVariables, editingRole,
}: {
  previewTheme: string
  previewAppearance: ThemeAppearance
  accentPreview: string | null
  stylePreview: StylePreview | null
  /** One appearance for every tile — the whole board is light or dark. */
  tileAppearances: ThemeAppearance[]
  /** Uniform board appearance — all tiles share light or dark. */
  boardAppearance: ThemeAppearance
  /** Inspector mode — point at a specimen, get the roles that paint it. Lives
   *  in the hub (the toggle is in the canvas header, a sibling of this view),
   *  never local here. */
  inspecting: boolean
  onPickRole: (roleId: string, css: string, appearance: ThemeAppearance) => void
  /** A role picked here is open in Token Details — the overlay holds its pin
   *  for the duration and drops it when the drawer closes. */
  editingRole: boolean
  /** The badge's own exit to the full Semantics table — the same door Token
   *  Details carries, one step earlier in the flow. */
  onOpenRoleInVariables: (roleId: string) => void
  /** The quick rail's colour fly-out is open. It flies out FROM the canvas's
   *  own left edge, so the width it covers is the width the canvas cedes. */
  drawerOpen: boolean
}) {
  const store = useDesignStore()
  const overlayStore = useMemo(
    () => (stylePreview ? stylePreviewStore(store, stylePreview, previewTheme) : store),
    [stylePreview, store, previewTheme],
  )
  const tokensByAppearance = useMemo(() => ({
    light: withAccentPreview(resolvePreviewTokens(overlayStore, previewTheme, 'light'), accentPreview),
    dark: withAccentPreview(resolvePreviewTokens(overlayStore, previewTheme, 'dark'), accentPreview),
  }), [overlayStore, previewTheme, accentPreview])
  const canvasRef = useRef<HTMLDivElement | null>(null)
  // Token Details docks to the THEMES LIBRARY's edge, not the canvas's — the
  // library column and the foundation icon rail sit between the two, so the
  // canvas already begins well to the right of where the drawer starts.
  // Ceding `PANEL_W` here therefore over-reserves by exactly that offset:
  // measured at a 1385px viewport, the drawer spans 196→556 while the canvas
  // begins at 451, so 360px was reserved to clear 106px and left 245px of dead
  // gutter — more than the 164px a collage column occupies, which is why a
  // column that would have fit didn't appear. Cede the real OVERLAP instead.
  const [dockInset, setDockInset] = useState(0)
  useEffect(() => {
    if (!editingRole) { setDockInset(0); return }
    const measure = () => {
      const el = canvasRef.current
      if (!el) return
      // Measured, not derived from the rail's own widths: the library can be
      // collapsed and the icon rail is its own column, so the canvas's left
      // edge is the only honest input. `paddingLeft` moves the CONTENT box,
      // never this border-box edge, so re-measuring cannot feed back on itself.
      const overlap = THEME_LIBRARY_WIDTH + PANEL_W - el.getBoundingClientRect().left
      setDockInset(overlap > 0 ? Math.round(overlap) + DRAWER_GUTTER : 0)
    }
    measure()
    // A ResizeObserver on the canvas, not a window listener: the canvas also
    // moves when a sibling column changes (the Themes Library collapsing), and
    // that fires no resize event. Observing its own box covers both. It cannot
    // feed back — the value is read from the border-box edge, which the
    // `paddingLeft` this sets never moves.
    const ro = new ResizeObserver(measure)
    if (canvasRef.current) ro.observe(canvasRef.current)
    return () => ro.disconnect()
  }, [editingRole])
  // Both can be open at once; the wider claim wins.
  const padLeft = Math.max(drawerOpen ? PANEL_W : 0, dockInset)
  return (
    <div
      ref={canvasRef}
      className="@container flex-1 min-w-0 min-h-0 overflow-y-auto px-5 py-5 @min-[820px]:px-7 @min-[820px]:py-6 transition-[padding-left] duration-200 ease-out motion-reduce:transition-none"
      style={padLeft ? { paddingLeft: padLeft } : undefined}
    >
      <div className="mx-auto w-full" style={inspecting ? { cursor: 'crosshair' } : undefined}>
        <InspectorModeProvider active={inspecting}>
          <SystemCollage
            tokensByAppearance={tokensByAppearance}
            tileAppearances={tileAppearances}
            projectName={store.projectName}
          />
        </InspectorModeProvider>
      </div>
      <InspectorOverlay
        active={inspecting}
        rootRef={canvasRef}
        tokensByAppearance={tokensByAppearance}
        defaultAppearance={boardAppearance}
        onPick={onPickRole}
        onOpenTable={onOpenRoleInVariables}
        editing={editingRole}
      />
    </div>
  )
}


// ── Component variants — a TASTER, deliberately not the catalogue ───────────
// This replaced a "Variables" view that re-rendered the semantic / type /
// layout role previews the Primitives workspace tab already owns: the same
// tokens, twice, one tab apart. What the hub was actually missing is what
// those tokens BUILD. Rules that keep it a taster instead of a second
// catalogue browser:
//  · **The variants are READ from `COMPONENTS`, never listed here** — the same
//    rule `Live` follows for its State axis, so a plugin change can't leave a
//    row advertising a variant the system doesn't ship.
//  · **Capped at `SHOWCASE_LIMIT` per row, and the row says so** ("+2 more").
//    A row that quietly truncated would misreport the system's size.
//  · **Every row is a link.** The full article — all axes, props, a11y, Figma
//    sets, code — lives on the Components destination, which has the rail,
//    search and width for it. This view's job is to make you want to go there.
const SHOWCASE_LIMIT = 4

type ShowcaseRow = {
  /** Catalogue key — indexes both `SPECIMENS` and the axes read below. */
  key: string
  /** Axis whose values become the row. */
  axis: string
  /** Axis values held fixed across the row, so only `axis` varies. */
  base?: AxisValues
  /** Feed the system's own icon library into the specimen (Button only). */
  icons?: boolean
}

// ONE column, so every row gets the full width: a specimen carries its own
// hardcoded width (Input 260, InlineAlert 320…) and four of those never fit a
// half-column — they stacked into a ~550px tower that dragged the short section
// beside it to the same height, mostly dead space (measured: Button 548px for
// ~120px of content). Order is the reading order of a system: the action, its
// labels, identity, then the messages.
const SHOWCASE: ShowcaseRow[] = [
  { key: 'Button', axis: 'Style', icons: true },
  { key: 'Badge', axis: 'Color', base: { Style: 'Soft' } },
  { key: 'Avatar', axis: 'Size' },
  { key: 'StatusBadge', axis: 'Status' },
  { key: 'Input', axis: 'Type' },
  { key: 'InlineAlert', axis: 'Status' },
  { key: 'Toast', axis: 'Status' },
]

// ── Basic components — the board at the top of the showcase ────────────────
// The per-component rows below answer "what does ONE component look like across
// ONE axis". They can't answer "what does this theme look like", because you
// read them one at a time. This board is the other half: every basic control on
// screen at once, grouped the way a UI kit's cover page groups them — icons,
// actions, form controls, indicators — so a theme is judged as a set rather
// than as seven separate rows.
//
// Same rules as `SHOWCASE`, for the same reasons:
//  · **Every variant is READ from `COMPONENTS`** (`axisValuesOf`), never listed
//    here — a plugin change can't leave this board advertising a variant the
//    system doesn't ship.
//  · **A cell that resolves to nothing renders nothing.** A component dropped
//    from the catalogue leaves a gap, not a broken tile.
//  · It is still a TASTER: no axis dropdowns, no props, no code. The article on
//    the Components destination owns all of that.

/** A component's values for one axis, straight from the catalogue. */
function axisValuesOf(key: string, axis: string): string[] {
  return COMPONENTS.find((c) => c.key === key)?.axes.find((a) => a.name === axis)?.values ?? []
}

/** The icon strip. Concepts, not glyph names — `TokenIcon` resolves each through
 *  the system's own library, so switching Icons repaints the whole row. */
const BASIC_ICONS = Object.keys(PHOSPHOR_CORE) as IconConcept[]

function BoardSection({
  title, note, tokens, children,
}: {
  title: string
  note?: string
  tokens: PreviewTokens
  children: ReactNode
}) {
  return (
    <section className="min-w-0 flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3 px-0.5">
        <h4 className="text-caption font-semibold text-fg">{title}</h4>
        {note && <span className="flex-shrink-0 text-mini uppercase tracking-widest text-fg-faint">{note}</span>}
      </div>
      {/* Painted on the SYSTEM's own surface, not the chrome's — the same rule
          the variant rows follow, so on-surface contrast reads as it ships. */}
      <div
        className="p-4"
        style={{
          background: tokens.surface,
          border: `1px solid ${tokens.borderDefault || tokens.border || '#eaecf0'}`,
          borderRadius: 14,
        }}
      >
        {children}
      </div>
    </section>
  )
}

/** One labelled cell — the specimen over its variant name. */
function BoardCell({ label, tokens, children }: { label?: string; tokens: PreviewTokens; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-1.5">
      {children}
      {label && (
        <span className="text-micro uppercase tracking-wide" style={{ color: tokens.fgMuted }}>{label}</span>
      )}
    </div>
  )
}

function BasicsBoard({ tokens, icons }: { tokens: PreviewTokens; icons: IconOpts }) {
  const buttonStyles = axisValuesOf('Button', 'Style')
  const buttonColors = axisValuesOf('Button', 'Color')
  const badgeColors = axisValuesOf('Badge', 'Color')
  const statuses = axisValuesOf('StatusBadge', 'Status')
  const avatarSizes = axisValuesOf('Avatar', 'Size')
  const alertStatuses = axisValuesOf('InlineAlert', 'Status')

  return (
    <div className="flex flex-col gap-5">
      {BASIC_ICONS.length > 0 && (
        <BoardSection title="Icons" note={`${BASIC_ICONS.length} core`} tokens={tokens}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            {BASIC_ICONS.map((concept) => (
              <TokenIcon key={concept} t={tokens} concept={concept} size={20} color={tokens.neutralText} />
            ))}
          </div>
        </BoardSection>
      )}

      {buttonStyles.length > 0 && (
        // Style × Colour, one row per colour — the matrix the reference kit
        // leads with, and the only place the danger/success intents appear
        // beside the brand one.
        <BoardSection title="Actions" note="Style × Color" tokens={tokens}>
          {/* The matrix is the one block wide enough to overflow a narrow
              column (measured: 4 button columns + the label track need ~452px
              against a 409px panel with both rails open), so it scrolls inside
              its own container — the app's rule for wide content — rather than
              wrapping, which would break the grid the labels describe.
              `min-w-max` keeps the rows from squeezing instead of scrolling. */}
          <div className="overflow-x-auto scrollbar-thin -mx-1 px-1">
            {/* ONE grid for captions + cells, so a column caption can never
                drift off the column it names — which is what a per-row flex
                would allow once the button widths differ by style. */}
            <div
              className="grid items-center gap-x-3 gap-y-3"
              style={{ gridTemplateColumns: `56px repeat(${buttonStyles.length}, minmax(max-content, 1fr))` }}
            >
              <span aria-hidden />
              {buttonStyles.map((style) => (
                <span key={style} className="text-micro uppercase tracking-wide" style={{ color: tokens.fgMuted }}>{style}</span>
              ))}
              {(buttonColors.length ? buttonColors : ['Brand']).map((color) => (
                // The colour leads its own row, so the block reads as a matrix.
                // It trailed the buttons before, which put it after the wrap on
                // a narrow column and read as a caption for the last cell.
                <Fragment key={color}>
                  <span className="text-micro uppercase tracking-wide" style={{ color: tokens.fgMuted }}>{color}</span>
                  {buttonStyles.map((style) => (
                    <span key={style} className="flex">
                      <Live c="Button" t={tokens} v={{ Color: color, Style: style, Size: 'SM' }} icons={icons} />
                    </span>
                  ))}
                </Fragment>
              ))}
            </div>
          </div>
        </BoardSection>
      )}

      <BoardSection title="Form controls" tokens={tokens}>
        <div className="flex flex-wrap items-start gap-x-5 gap-y-4">
          <BoardCell label="Input" tokens={tokens}><Live c="Input" t={tokens} v={{ Type: 'Default' }} /></BoardCell>
          <BoardCell label="Select" tokens={tokens}><Live c="Select" t={tokens} v={{}} /></BoardCell>
          {/* `toggle` makes these actually flip — the axis it names has a
              True/False pair in the catalogue, which `Live` verifies. */}
          <BoardCell label="Checkbox" tokens={tokens}><Live c="Checkbox" t={tokens} v={{ Checked: 'True' }} toggle="Checked" /></BoardCell>
          <BoardCell label="Radio" tokens={tokens}><Live c="Radio" t={tokens} v={{ Checked: 'True' }} toggle="Checked" /></BoardCell>
          <BoardCell label="Switch" tokens={tokens}><Live c="Toggle" t={tokens} v={{ On: 'True' }} toggle="On" /></BoardCell>
          <BoardCell label="Slider" tokens={tokens}><Live c="Slider" t={tokens} v={{}} /></BoardCell>
        </div>
      </BoardSection>

      <BoardSection title="Indicators" tokens={tokens}>
        <div className="flex flex-col gap-4">
          {badgeColors.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
              {badgeColors.map((color) => (
                <Live key={color} c="Badge" t={tokens} v={{ Color: color, Style: 'Soft' }} />
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            {statuses.map((status) => <Live key={status} c="StatusBadge" t={tokens} v={{ Status: status }} />)}
            <Live c="Chip" t={tokens} v={{ Selected: 'True' }} />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
            {avatarSizes.map((size) => <Live key={size} c="Avatar" t={tokens} v={{ Size: size }} />)}
          </div>
          {/* Its own line — Progress is a full-width bar, so wrapping it in
              beside chips left a one-item row of dead space either way. */}
          <Live c="Progress" t={tokens} v={{}} />
        </div>
      </BoardSection>

      {alertStatuses.length > 0 && (
        <BoardSection title="Feedback" note="Status" tokens={tokens}>
          <div className="flex flex-wrap items-start gap-3">
            {alertStatuses.map((status) => (
              <Live key={status} c="InlineAlert" t={tokens} v={{ Status: status }} />
            ))}
          </div>
        </BoardSection>
      )}
    </div>
  )
}

/** Rail row labels come from the catalogue, so a renamed component renames its
 *  own filter — nothing here restates a label. `All` leads: the summary board
 *  plus every variant row, which is what you look at first.
 *
 *  There used to be a `Basics` row above it that rendered the board ALONE, and
 *  `All` was "the same board, plus the rows". The two read as near-duplicates —
 *  clicking Basics after All barely changed the screen — so Basics was dropped.
 *  `All` still shows the board first (it's the summary), then the detail rows. */
function showcaseRailRows(): { key: string; label: string }[] {
  return [
    { key: 'all', label: 'All' },
    ...SHOWCASE.map((row) => ({
      key: row.key,
      label: COMPONENTS.find((component) => component.key === row.key)?.label ?? row.key,
    })),
  ]
}

/** Two-letter mark for the collapsed strip — the same shape `SemanticGroupRail`
 *  falls back to, so a collapsed rail reads the same way across the app. */
function compactMark(label: string): string {
  const words = label.trim().split(/\s+/).filter(Boolean)
  if (words.length > 1) return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase()
  return label.slice(0, 2).toUpperCase()
}

// ONE rail for every list-column in this hub — the component showcase's filter
// AND the System doc's page list. They were two components with two widths
// (240 / 198), two row treatments (all-caps 10.5px / sentence-case 12px) and
// only one of them collapsible, sitting in the same slot one view apart, so the
// column visibly jumped when you switched views. Merged rather than aligned by
// hand, for the same reason `RailGroupNav` and `RailSelect` were: two copies of
// one control drift, and this pair already had.
//
// It sits beside the framed canvas rather than inside it, so switching views
// changes the list and canvas together without nesting one rail inside another.
function HubRail<Key extends string>({
  title, ariaLabel, noun, rows, active, collapsed, onToggleCollapse, onChange, footer,
}: {
  title: string
  ariaLabel: string
  /** What the rail lists, for `RailToggle`'s label ("Collapse the …"). */
  noun: string
  rows: HubRailRow<Key>[]
  active: Key
  collapsed: boolean
  onToggleCollapse: () => void
  onChange: (key: Key) => void
  footer?: ReactNode
}) {
  return (
    <nav
      aria-label={ariaLabel}
      className={`flex-shrink-0 h-full flex flex-col border-r border-line ${WORKSPACE_CHROME} overflow-hidden transition-[width] duration-200`}
      style={{ width: collapsed ? COLOR_RAIL_COLLAPSED_WIDTH : COLOR_RAIL_WIDTH }}
    >
      <div className={`h-[54px] flex-shrink-0 flex items-center border-b border-line ${collapsed ? 'justify-center px-0' : 'justify-between gap-2 pl-4 pr-2'}`}>
        {!collapsed && <span className="min-w-0 truncate text-ui font-semibold text-fg">{title}</span>}
        <RailToggle
          collapsed={collapsed}
          onClick={onToggleCollapse}
          noun={noun}
          expandedHint="Collapse sidebar — give the content more width"
        />
      </div>
      <div className={`flex-1 min-h-0 overflow-y-auto flex flex-col gap-0.5 py-3 ${collapsed ? 'px-2 items-center' : 'px-3'}`}>
        {rows.map((row) => {
          const selected = row.key === active
          return (
            <button
              key={row.key}
              type="button"
              onClick={() => onChange(row.key)}
              aria-current={selected ? 'page' : undefined}
              aria-label={row.label}
              title={collapsed ? row.label : undefined}
              className={`flex items-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ui/50 ${collapsed ? 'w-10 h-8 justify-center' : 'w-full gap-2.5 px-2.5 py-2 text-left'} ${
                selected ? 'text-fg font-semibold bg-elevated/70' : 'text-fg-muted hover:text-fg hover:bg-elevated/40'
              }`}
            >
              {/* The row prints the label VERBATIM — no `uppercase`. These are
                  names (a component, a foundation, a theme), and CSS-shouting a
                  name misreports it: the catalogue says "Status Badge", the rail
                  said "STATUS BADGE". The all-caps device is reserved for the
                  eyebrow CAPTION over a group, which labels a set rather than
                  naming a thing. Collapsed is the one exception — a two-letter
                  MARK is an abbreviation, not the name. */}
              {!collapsed && row.icon ? (
                <span className={`w-4 h-4 flex-shrink-0 grid place-items-center ${selected ? 'opacity-100' : 'opacity-65'}`}>{row.icon}</span>
              ) : null}
              <span className={collapsed ? 'text-micro font-semibold uppercase tracking-[0.06em]' : 'min-w-0 flex-1 truncate text-body'}>
                {collapsed ? compactMark(row.label) : row.label}
              </span>
            </button>
          )
        })}
        {footer && <div className={`${collapsed ? 'pt-2' : 'mt-3 border-t border-line pt-3'}`}>{footer}</div>}
      </div>
    </nav>
  )
}

function ComponentVariantsView({
  previewTheme, previewAppearance, stylePreview, active, onOpenComponent,
}: {
  previewTheme: string
  previewAppearance: ThemeAppearance
  stylePreview: StylePreview | null
  /** Rail selection — `'all'` or a catalogue key. */
  active: string
  onOpenComponent: (component: ComponentDef) => void
}) {
  const store = useDesignStore()
  const liveTokens = usePreviewTokens(previewTheme, previewAppearance)
  const previewTokens = useMemo(
    () => (stylePreview ? resolveStylePreviewTokens(store, stylePreview, previewTheme) : null),
    [stylePreview, store, previewTheme],
  )
  const tokens = previewTokens ?? liveTokens
  // The system's OWN library, so a Button here repaints when Icons changes —
  // the same rule the Color collage and the artefacts follow.
  const icons = { prefix: tokens.iconPrefix ?? 'phosphor', leading: true, trailing: false }
  // `all` shows the summary board AND every variant row under it; a component
  // key shows just that row (no board). There is no board-only mode — see
  // `showcaseRailRows` for why `Basics` was removed.
  const showBoard = active === 'all'
  const rows = SHOWCASE
    .filter((row) => active === 'all' || row.key === active)
    .map((row) => {
      const def = COMPONENTS.find((component) => component.key === row.key)
      const values = def?.axes.find((axis) => axis.name === row.axis)?.values ?? []
      return { ...row, def, values }
    })
    .filter((row) => row.def && row.values.length > 0)

  return (
    <PhosphorWeightProvider weight={tokens.iconWeight}>
    <div className="@container flex-1 min-w-0 min-h-0 overflow-y-auto px-5 py-5 @min-[820px]:px-7 @min-[820px]:py-6">
      <div className="mx-auto max-w-[1120px]">
        <div className="mb-6">
          <div className="min-w-0">
            <h2 className="text-title font-semibold text-fg">Component variants</h2>
            <p className="mt-1 text-body text-fg-muted">
              A sample of what this theme builds. Every variant below is the one the Figma plugin ships.
            </p>
          </div>
        </div>

        {showBoard && (
          <div className="mb-8">
            <BasicsBoard tokens={tokens} icons={icons} />
          </div>
        )}

        <div className="flex flex-col gap-6">
          {rows.map(({ key, axis, base, icons: withIcons, def, values }) => {
            const shown = values.slice(0, SHOWCASE_LIMIT)
            const hidden = values.length - shown.length
            return (
              <section key={key} className="min-w-0 flex flex-col gap-2.5">
                <div className="flex items-baseline justify-between gap-3 px-0.5">
                  <button
                    type="button"
                    onClick={() => def && onOpenComponent(def)}
                    className="min-w-0 truncate text-body font-semibold text-fg hover:text-accent-ui focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ui/50 rounded transition-colors"
                  >
                    {def?.label ?? key}
                  </button>
                  <span className="flex-shrink-0 text-mini uppercase tracking-widest text-fg-faint">
                    {axis}{hidden > 0 ? ` · +${hidden} more` : ''}
                  </span>
                </div>
                {/* Painted on the SYSTEM's own surface, not the chrome's, so
                    brand-on-surface contrast reads the way it ships. */}
                <div
                  className="flex flex-wrap items-center gap-x-3 gap-y-3 p-4"
                  style={{
                    background: tokens.surface,
                    border: `1px solid ${tokens.borderDefault || tokens.border || '#eaecf0'}`,
                    borderRadius: 14,
                  }}
                >
                  {shown.map((value) => (
                    <div key={value} className="flex min-w-0 flex-col items-start gap-1.5">
                      <Live c={key} t={tokens} v={{ ...base, [axis]: value }} icons={withIcons ? icons : undefined} />
                      <span className="text-micro uppercase tracking-wide" style={{ color: tokens.fgMuted }}>{value}</span>
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
    </PhosphorWeightProvider>
  )
}

// The doc list is a SIBLING of the context bar now (see the hub's return), like
// the showcase rail — that's what lands its header band on the view-switcher's
// row instead of one row below it, and what lets both columns share `HubRail`.
function DocumentationView({ onEditFoundation, exits, active, onChange, overviewTitle, previewTheme, stylePreview }: {
  onEditFoundation: (key: string) => void
  exits: Parameters<typeof DocsView>[0]['exits']
  active: string
  onChange: (key: string) => void
  /** The previewed theme's name — the whole-system sheet's title, so it reads
   *  as THIS theme's spec rather than a generic "System reference". */
  overviewTitle: string
  previewTheme: string
  stylePreview: StylePreview | null
}) {
  return (
    <div className="flex-1 min-w-0 min-h-0">
      <DocsView
        activeFoundationKey={active}
        onSelectFoundationKey={onChange}
        onEditFoundation={onEditFoundation}
        exits={exits}
        overviewTitle={overviewTitle}
        hubMode
        docScope={{ themeKey: previewTheme, stylePreview }}
      />
    </div>
  )
}

export default function ThemePreviewHub({
  surface, onSurfaceChange,
  previewTheme, previewAppearance, stylePreview, onAdoptStyle, onSelectTheme, onPreviewAppearanceChange,
  onOpenComponent, onOpenComponents,
  onEditFoundation, onOpenPrimitiveFamily, onOpenInVariables, figmaPublishState, workspaceSection, onRequestFigmaSync, onOpenFigmaDownload,
  figmaFileName, onFigmaFileNameChange, figmaSyncModes, onFigmaSyncModesChange,
  githubPushState, onGithubPushStateChange, docsExits,
}: {
  surface: ThemeHubSurface
  onSurfaceChange: (surface: ThemeHubSurface) => void
  previewTheme: string
  previewAppearance: ThemeAppearance
  /** Ephemeral System Style try-on from the Themes Library; store-free. */
  stylePreview: StylePreview | null
  /** A tried-on style was adopted into the system — re-point the preview at it
   *  and drop the ephemeral try-on. */
  onAdoptStyle: (themeKey: string) => void
  onSelectTheme: (themeKey: string) => void
  onPreviewAppearanceChange: (appearance: ThemeAppearance) => void
  /** Open one component's full article on the Components destination. */
  onOpenComponent: (component: ComponentDef) => void
  /** Open the Components destination itself — the showcase's whole payoff. */
  onOpenComponents: () => void
  onEditFoundation: (key: string) => void
  /** Jump to a family's ramp in Color · Primitives from the Semantics
   *  Token Details drawer (family vocabulary name). */
  onOpenPrimitiveFamily: (family: string) => void
  /** Open a semantic token's row in the full Color · Semantics table. */
  onOpenInVariables: (tokenId: string) => void
  figmaPublishState: FigmaPublishState
  /** This window's workspace section id — Sync card's This page link. */
  workspaceSection?: string
  onRequestFigmaSync: () => void
  onOpenFigmaDownload: () => void
  figmaFileName: string
  onFigmaFileNameChange: (name: string) => void
  figmaSyncModes: FigmaSyncMode[]
  onFigmaSyncModesChange: (modes: FigmaSyncMode[]) => void
  githubPushState: GitHubPushState
  onGithubPushStateChange: (state: GitHubPushState) => void
  docsExits: Parameters<typeof DocsView>[0]['exits']
}) {
  const { t } = useI18n()
  const themeLabels = useDesignStore((s) => s.themeLabels)
  const themeName = themeDisplayName(previewTheme, themeLabels)
  const [accentPreview, setAccentPreview] = useState<string | null>(null)
  // Whether a contained colour picker from the quick rail is open — the canvas
  // cedes `PANEL_W` so artefacts reflow instead of sitting under the fly-out.
  const [quickEditOpen, setQuickEditOpen] = useState(false)
  // Inspector mode. Deliberately NOT persisted and NOT part of `DesignSnapshot`
  // — it's a way of LOOKING at the canvas for a minute, like `previewCollapsed`,
  // not a property of the system being designed.
  const [inspecting, setInspecting] = useState(false)
  const [editingToken, setEditingToken] = useState<string | null>(null)
  const [inspectedCss, setInspectedCss] = useState<string | null>(null)
  /** Whole-board light/dark flip from Random — view-only, not workspace chrome. */
  const [randomBoardAppearance, setRandomBoardAppearance] = useState<ThemeAppearance | null>(null)
  const [inspectedAppearance, setInspectedAppearance] = useState<ThemeAppearance | null>(null)
  // Session picks on a try-on. `resetThemeSemantics` drops live-store
  // overrides so a leftover `surface.layer-1` cannot leak into Nature — which
  // also dropped a Token Details pick on the critical solid. These ride on
  // the overlay AFTER that reset, and die with the preset.
  const [tryOnEdits, setTryOnEdits] = useState<Record<string, Record<string, string>>>({})
  const tryOnPresetId = stylePreview?.preset.id ?? ''
  useEffect(() => { setTryOnEdits({}) }, [tryOnPresetId])
  const paintedPreview = useMemo<StylePreview | null>(() => {
    if (!stylePreview) return null
    if (!Object.keys(tryOnEdits).length) return stylePreview
    return { ...stylePreview, edits: tryOnEdits }
  }, [stylePreview, tryOnEdits])
  const store = useDesignStore()
  // A REAL pick (not a Reset-driven clear) during a try-on is a deliberate
  // edit, not a glance — it can't stay ephemeral the way `tryOnEdits` is,
  // because nothing ephemeral survives leaving the tab. So it adopts the
  // style into My themes on the spot, the same "first edit makes it real"
  // rule `ThemeQuickSettingsRail`'s `resolveWriteTarget` already applies to
  // the quick-edit rail. `mode` here is the PREVIEWED theme's own mode key
  // (`<previewTheme>::light|dark` — see `useArchitectureTokens`), which
  // still points at whatever real theme sits under the try-on; writing
  // straight to it would silently edit that committed theme instead of the
  // style being tried on, so the edit is re-targeted at the freshly minted
  // theme's OWN mode key (same appearance, new theme id) once adoption
  // hands one back.
  const recordTryOnEdit = (tokenId: string, mode: string, ref: string | null) => {
    if (ref && stylePreview) {
      const adopted = adoptPreset(stylePreview.preset, previewAppearance, { asCopy: true, copyWord: t('Copy (duplicated theme suffix)') })
      if ('error' in adopted) {
        showToast(t(adopted.error, { count: myThemeKeys(store.themeOrder, store.themes).length }))
        return
      }
      showToast(t('{name} added to My themes', { name: adopted.name }))
      onAdoptStyle(adopted.key)
      const appearance = appearanceFromModeKey(mode) ?? previewAppearance
      store.setArchitectureOverride(store.semanticArchitecture, tokenId, themeModeKey(adopted.key, appearance), ref)
      return
    }
    setTryOnEdits((prev) => {
      const nextToken = { ...(prev[tokenId] ?? {}) }
      if (ref) nextToken[mode] = ref
      else delete nextToken[mode]
      const next = { ...prev }
      if (Object.keys(nextToken).length) next[tokenId] = nextToken
      else delete next[tokenId]
      return next
    })
  }
  const [showcase, setShowcase] = useState('all')
  const [docPage, setDocPage] = useState<string>(OVERVIEW_KEY)
  // ONE collapse preference for the whole hub, not one per view: it's the same
  // 240px slot in every view, so collapsing it on Components and finding it
  // expanded again on System doc would read as two different columns — the
  // exact confusion merging them into `HubRail` exists to remove.
  const [railCollapsed, setRailCollapsed] = useState(false)
  const [hubDocActions, setHubDocActions] = useState<ReactNode>(null)
  const hubRootRef = useRef<HTMLElement>(null)
  const hubSurface: HubView | null = surface === 'artefacts' || surface === 'components' || surface === 'documentation'
    ? surface
    : null
  const hubViewLabel = HUB_VIEWS.find((v) => v.key === hubSurface)?.label ?? ''
  // Flip the PREVIEW's appearance (the board on the right), not the workspace
  // chrome — same contract the Color-edition card's toggle had before it moved
  // up here. Clearing `accentPreview` mirrors the rail's own wrapper so an
  // optimistic hue paint doesn't linger across the swap.
  const handleAppearanceChange = (appearance: ThemeAppearance) => {
    setAccentPreview(null)
    setRandomBoardAppearance(null)
    onPreviewAppearanceChange(appearance)
  }
  useEffect(() => { setRandomBoardAppearance(null) }, [previewTheme])
  useEffect(() => { if (surface !== 'artefacts') setRandomBoardAppearance(null) }, [surface])
  // A role picked on the canvas opens Token Details in the SAME dock as New
  // theme — flush to the Themes Library — not the Variables table. The table
  // is a second destination the drawer itself already carries a door to.
  const pickRole = (roleId: string, css?: string, appearance?: ThemeAppearance) => {
    setEditingToken(roleId)
    setInspectedCss(css ?? null)
    setInspectedAppearance(appearance ?? null)
  }
  // What the BOARD is showing: a live try-on renders from `stylePreview.appearance`,
  // a committed theme from `previewAppearance`. The header sun/moon reads and
  // writes this, so it works for both.
  const boardAppearance: ThemeAppearance = stylePreview?.appearance ?? previewAppearance
  const effectiveBoardAppearance: ThemeAppearance = randomBoardAppearance ?? boardAppearance
  const effectiveTileAppearances = useMemo(
    () => Array.from({ length: COLLAGE_TILE_COUNT }, () => effectiveBoardAppearance),
    [effectiveBoardAppearance],
  )
  const boardCanvasTokens = useMemo(() => {
    const overlay = paintedPreview
      ? stylePreviewStore(store, paintedPreview, previewTheme)
      : store
    return withAccentPreview(
      resolvePreviewTokens(overlay, previewTheme, effectiveBoardAppearance),
      accentPreview,
    )
  }, [store, previewTheme, effectiveBoardAppearance, paintedPreview, accentPreview])
  // The canvas is the theme's PAGE (`surface.page` / `background-primary`), not
  // workspace chrome (`--app` / `--surface`) — otherwise artefacts float on a
  // fill that isn't the background they ship on.
  const pageCanvasColor = boardCanvasTokens.archTokens?.['surface.page']
    ?? boardCanvasTokens.pageBackground
    ?? boardCanvasTokens.surface
  // Every left column is a sibling of the framed canvas, so its own scrolling
  // and collapse state cannot disturb the preview surface.
  return <section ref={hubRootRef} className="relative h-full min-h-0 flex flex-col bg-app" aria-label={t('Theme preview')}>
    <div className="flex-1 min-h-0 flex">
      {surface === 'components' && (
        <HubRail
          title={t('Components')}
          ariaLabel={t('Component showcase')}
          noun="component list"
          rows={showcaseRailRows()}
          active={showcase}
          collapsed={railCollapsed}
          onToggleCollapse={() => setRailCollapsed((collapsed) => !collapsed)}
          onChange={setShowcase}
          footer={
            <button
              type="button"
              onClick={onOpenComponents}
              aria-label={`Open all ${COMPONENTS.length} components`}
              title={railCollapsed ? `Open all ${COMPONENTS.length} components` : undefined}
              className={`flex h-8 w-full items-center justify-center rounded-lg border border-line bg-surface text-caption font-medium text-fg-muted transition-colors hover:border-line-strong hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ui/50 ${railCollapsed ? 'px-1' : 'px-2.5'}`}
            >
              {railCollapsed ? 'All' : <>All {COMPONENTS.length} components →</>}
            </button>
          }
        />
      )}
      {surface === 'documentation' && (
        <HubRail
          title="Theme doc"
          ariaLabel="Documentation pages"
          noun="page list"
          rows={DOC_ROWS}
          active={docPage}
          collapsed={railCollapsed}
          onToggleCollapse={() => setRailCollapsed((collapsed) => !collapsed)}
          onChange={setDocPage}
        />
      )}
      {surface === 'artefacts' && (
        <ThemeQuickSettingsRail
          key={previewTheme}
          previewTheme={previewTheme}
          previewAppearance={previewAppearance}
          // "Go to advanced edition" IS `selectFoundation` — the shell handler
          // that switches to the Variables tab on a given foundation. Passing
          // it straight through is what makes the button land on the very
          // foundation whose quick panel you were in.
          onOpenAdvanced={onEditFoundation}
          onAccentPreview={setAccentPreview}
          stylePreview={stylePreview}
          onAdoptStyle={onAdoptStyle}
          onQuickEditOpenChange={setQuickEditOpen}
          containedDrawerRootRef={hubRootRef}
          onRandomBoardAppearance={setRandomBoardAppearance}
        />
      )}
      {(surface === 'github' || surface === 'figma') && (
        <IntegrationStatusRail
          provider={surface}
          githubPushState={githubPushState}
          figmaPublishState={figmaPublishState}
          onOpenPluginDownload={surface === 'figma' ? onOpenFigmaDownload : undefined}
          onOpenGithub={surface === 'figma' ? () => onSurfaceChange('github') : undefined}
          workspaceSection={workspaceSection}
          fileName={figmaFileName}
          modeCount={figmaSyncModes.length}
        />
      )}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {hubSurface ? (
          // Same `--nav` as TopNav + footer — the shell well. The board
          // inside paints `surface.page`, so the gutter is what separates
          // chrome from the previewed theme.
          <div className={`min-h-0 flex-1 ${SHELL_CHROME} p-3`}>
            <section
              aria-label={`${themeName} preview canvas`}
              className={`flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-line ${effectiveBoardAppearance === 'dark' ? 'dark' : 'light'}`}
              style={{ background: pageCanvasColor }}
            >
              {/* One header band for every hub view — the active view's NAME
                  sits top-left; page actions (Copy page…), the view switcher and
                  the preview appearance toggle stay pinned on the right when you
                  move between Artefacts · Components · Documentation. The
                  sun/moon toggle flips ONLY the board on the right, not the
                  workspace chrome — it used to live in the Color-edition card. */}
              <div className="flex flex-shrink-0 items-center justify-between gap-3 px-3" style={{ height: THEME_BAND_H }}>
                <span className="min-w-0 flex flex-col">
                  <span className="truncate text-ui font-semibold text-fg">{hubViewLabel}</span>
                  <span aria-hidden className="mt-1 h-[3px] w-6 rounded-full bg-accent-ui" />
                </span>
                <div className="flex flex-shrink-0 items-center gap-2">
                  {surface === 'documentation' && hubDocActions}
                  {surface === 'artefacts' && (
                    <InspectorToggle active={inspecting} onChange={setInspecting} />
                  )}
                  <FigmaSyncButton onOpen={() => onSurfaceChange('figma')} />
                  <ThemeViewSwitcher view={hubSurface} onChange={onSurfaceChange} />
                  <PreviewAppearanceButton value={effectiveBoardAppearance} onChange={handleAppearanceChange} />
                </div>
              </div>
              <ThemeHubHeaderActionsProvider onActions={setHubDocActions}>
              <div className="flex min-h-0 flex-1 flex-col">
                {surface === 'artefacts' ? <ArtefactsView previewTheme={previewTheme} previewAppearance={previewAppearance} accentPreview={accentPreview} stylePreview={paintedPreview} drawerOpen={quickEditOpen} editingRole={editingToken != null} inspecting={inspecting} tileAppearances={effectiveTileAppearances} boardAppearance={effectiveBoardAppearance} onPickRole={pickRole} onOpenRoleInVariables={onOpenInVariables} /> : null}
                {surface === 'components' ? <ComponentVariantsView previewTheme={previewTheme} previewAppearance={previewAppearance} stylePreview={paintedPreview} active={showcase} onOpenComponent={onOpenComponent} /> : null}
                {surface === 'documentation' ? <DocumentationView active={docPage} onChange={setDocPage} onEditFoundation={onEditFoundation} overviewTitle={themeName} previewTheme={previewTheme} stylePreview={paintedPreview} exits={{ ...docsExits, onOpenFigmaSync: () => onSurfaceChange('figma'), onOpenGithub: () => onSurfaceChange('github') }} /> : null}
              </div>
              </ThemeHubHeaderActionsProvider>
            </section>
          </div>
        ) : (
          <>
            <IntegrationContextBar view={surface === 'github' ? 'github' : 'figma'} onBack={() => onSurfaceChange('artefacts')} />
            <div className="flex min-h-0 flex-1 flex-col">
              {surface === 'github' ? <div className="flex-1 min-w-0 min-h-0 overflow-y-auto"><GitHubConnectView embedded onPushStateChange={onGithubPushStateChange} /></div> : null}
              {surface === 'figma' ? <div className="flex-1 min-w-0 min-h-0 overflow-y-auto"><FigmaSyncView embedded onOpenDownload={onOpenFigmaDownload} publishState={figmaPublishState} onRequestSync={onRequestFigmaSync} previewTheme={previewTheme} onSelectTheme={onSelectTheme} fileName={figmaFileName} onFileNameChange={onFigmaFileNameChange} syncModes={figmaSyncModes} onSyncModesChange={onFigmaSyncModesChange} section={workspaceSection} /></div> : null}
            </div>
          </>
        )}
      </div>
    </div>
    <SemanticTokenDrawer
      previewTheme={previewTheme}
      previewAppearance={inspectedAppearance ?? effectiveBoardAppearance}
      tokenId={surface === 'artefacts' ? editingToken : null}
      inspectedCss={inspectedCss}
      stylePreview={paintedPreview}
      onTryOnEdit={stylePreview ? recordTryOnEdit : undefined}
      onClose={() => { setEditingToken(null); setInspectedCss(null); setInspectedAppearance(null) }}
      onOpenPrimitiveFamily={onOpenPrimitiveFamily}
      onOpenInVariables={onOpenInVariables}
    />
  </section>
}
