import { useState, useEffect, useRef, useCallback, useMemo, Fragment, type ComponentType, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useDesignStore } from '../store/useDesignStore'
import { useTheme, setTheme } from '../lib/theme'
import { BASE_TONE, brandSolidPair, chromeAccent, darkChromeWash, readableInk } from '../lib/colorUtils'
import { themeBrandRamp, themeDisplayName } from '../lib/themeSources'
import { defaultFigmaSyncModes, type FigmaSyncMode } from '../lib/figmaSyncModes'
import { isLiveEnvironment, publishTokens, syncProjectId, useAutoFigmaSync, describePublishFailure, type FigmaPublishState, type PublishFailureReason } from '../lib/figmaSync'
import { encodeWorkspaceSection, parseWorkspaceSearch, syncWorkspaceSearch } from '../lib/workspaceLink'
import { type GitHubPushState } from '../lib/github'
import { useLoadActiveFonts } from '../lib/fonts'
import { useEnsureColorScales, useRegenerateScalesOnScaleSettings } from '../lib/colorActions'
import { RAIL_WIDTH, RAIL_COLLAPSED_WIDTH } from '../components/configurator/SectionRail'
import FoundationIconRail from '../components/configurator/FoundationIconRail'
import FoundationWorkbench from '../components/configurator/FoundationWorkbench'
import type { VariableCollectionItem, VariableCollectionKey } from '../components/configurator/VariableCollectionRail'
import ThemeCodeFormat, { resolveCodeTheme, type CodeThemeScope } from '../components/configurator/ThemeCodeFormat'
import ThemeLibraryRail, { THEME_LIBRARY_WIDTH, myThemeKeys } from '../components/configurator/ThemeLibraryRail'
import { resolveListedTheme } from '../lib/themeLibrary'
import { SHELL_CHROME, WORKSPACE_CHROME, WORKSPACE_CHIP_ACTIVE, WORKSPACE_CHIP_HOVER, WORKSPACE_CHIP_REST, WORKSPACE_TAB_TRACK } from '../components/configurator/themeWorkspaceLayout'
import { stylePreviewBrandRamp, type StylePreview } from '../lib/stylePreviewOverlay'
import ThemePreviewHub, { type ThemeHubSurface } from '../components/configurator/ThemePreviewHub'
import TopNav, { type TopNavKey } from '../components/configurator/TopNav'
import { TokenSearchField } from '../components/configurator/TokenSearchField'
import { buildTokenSearchIndex, type TokenSearchEntry } from '../lib/tokenSearch'
import { generateTokenJSON, setActiveThemeHint } from '../lib/tokenGenerator'
import { AboutHome, COPYRIGHT_LINE } from '../components/configurator/AboutMenu'
import { hasOnboarded, markOnboarded } from '../lib/onboarding'
import { ChromeTabDefs } from '../components/ui/ChromeTabShape'
import { FigmaGlyph, GitHubGlyph } from '../components/ui/icons'
import { ResetScopeControl } from '../components/configurator/ThemeResetButton'
import { usePopoverPlacement } from '../components/configurator/colorControls'
import type { ThemeAppearance } from '../lib/themeModes'

// Four tabs, matching the four top-nav destinations: read "what this is"
// ('about' — the landing surface for new visitors, see `hasOnboarded()`
// below), EDIT the system ('foundations' — the Variables Generator), browse
// the catalogue ('components'), or read the token reference ('docs').
// Components and Docs used to be folded into one 'docs' tab (a single rail
// with two groups); split back into their own tabs, each with its own
// single-purpose rail.
type Tab = 'about' | 'foundations' | 'components' | 'docs'
import PreviewPanel from '../components/preview/PreviewPanel'
import ExportView from '../components/configurator/ExportView'
import FigmaSyncView from '../components/configurator/FigmaSyncView'
import FigmaDownloadView from '../components/configurator/FigmaDownloadView'
import GitHubConnectView from '../components/configurator/GitHubConnectView'
import IconLibrary from '../components/configurator/IconLibrary'
import ComponentsRail from '../components/configurator/ComponentsRail'
import ComponentsView from '../components/configurator/ComponentsView'
import DocsView, { CHANGELOG_KEY, FAQ_KEY } from '../components/configurator/DocsView'
import { GUIDE_MCP_KEY, GUIDE_FIGMA_KEY } from '../components/configurator/docs/getStarted'
import { OPEN_FAQ_EVENT } from '../lib/aiContext'
import SaveView, { SaveSidePanel } from '../components/configurator/SaveView'
import Step2_ColorPalette from '../components/configurator/Step2_ColorPalette'
import ColorHub, { type ColorTab } from '../components/configurator/ColorHub'
import TypeHub from '../components/configurator/TypeHub'
import { type SemanticFocus } from '../components/configurator/Step3_SemanticTokens'
import { type TypeFocus } from '../components/configurator/TypeSemantics'
import ExportWizard from '../components/configurator/ExportWizard'
import ImportSystemModal from '../components/configurator/ImportSystemModal'
import NewSystemModal from '../components/configurator/NewSystemModal'
import Step4_Typography from '../components/configurator/Step4_Typography'
import Step5_Spacing from '../components/configurator/Step5_Spacing'
import StepRadius from '../components/configurator/StepRadius'
import Step7_Shadow from '../components/configurator/Step7_Shadow'
import Step8_Grid from '../components/configurator/Step8_Grid'
import Step9_Sizes from '../components/configurator/Step9_Sizes'
import StepStroke from '../components/configurator/StepStroke'
import LayoutHub, { LayoutTabHeading } from '../components/configurator/LayoutHub'
import GridSemantics from '../components/configurator/GridSemantics'
import { COMPONENTS, type ComponentDef } from '../lib/componentCatalogue'
import { PaletteIcon } from '../components/ui/icons'
import { useI18n } from '../lib/i18n'

// ── Stroke-icon factory (16px on a 24 grid, tracks currentColor) ────────────
// Multiple subpaths: separate them with "|".
const ic = (d: string, sw = '2'): ComponentType => () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d.split('|').map((p, i) => <path key={i} d={p} />)}
  </svg>
)

// ── Foundation sections: metadata + the prop-less, store-driven component ─────
interface FoundationSection {
  key: string
  label: string
  short: string // compact label for the icon rail
  hint: string
  title: string
  /** Workbench column heading — names this family, not a generic “Groups”. */
  variablesLabel: string
  subtitle: string
  /** Every Variables section takes the shell's table heading; the ones with no
   *  semantic layer (Icons, Color's own hub) just ignore it. */
  Component: ComponentType<{ tabBar?: ReactNode; previewTheme?: string; query?: string }>
  Icon: ComponentType
}

const FOUNDATIONS: FoundationSection[] = [
  {
    key: 'color',
    label: 'Color',
    short: 'Color',
    hint: 'Brand, neutrals & state scales',
    title: 'Color',
    variablesLabel: 'Color variables',
    subtitle: 'Map your semantic aliases and craft the gradients your system ships with.',
    Component: Step2_ColorPalette,
    // The same palette mark the token tables use for color rows — one official
    // "color" glyph across rail, header and tables.
    Icon: () => <PaletteIcon size={16} />,
  },
  {
    key: 'typography',
    label: 'Typography',
    short: 'Font',
    hint: 'Primitive scale + text roles',
    title: 'Typography',
    variablesLabel: 'Text variables',
    subtitle: 'Primitives for the scale, then semantic text styles — labels, placeholders, headings — mapped for desktop and mobile.',
    Component: Step4_Typography,
    Icon: ic('M8 7H16M12 7V17M7.8 21H16.2C17.8802 21 18.7202 21 19.362 20.673C19.9265 20.3854 20.3854 19.9265 20.673 19.362C21 18.7202 21 17.8802 21 16.2V7.8C21 6.11984 21 5.27976 20.673 4.63803C20.3854 4.07354 19.9265 3.6146 19.362 3.32698C18.7202 3 17.8802 3 16.2 3H7.8C6.11984 3 5.27976 3 4.63803 3.32698C4.07354 3.6146 3.6146 4.07354 3.32698 4.63803C3 5.27976 3 6.11984 3 7.8V16.2C3 17.8802 3 18.7202 3.32698 19.362C3.6146 19.9265 4.07354 20.3854 4.63803 20.673C5.27976 21 6.11984 21 7.8 21Z'),
  },
  {
    key: 'radius',
    label: 'Border radius',
    short: 'Radius',
    hint: 'Corner-radius personality',
    title: 'Border radius',
    variablesLabel: 'Radius variables',
    subtitle: 'Primitives for the scale, then semantic aliases — action, container, overlay — mapped onto that ramp.',
    Component: StepRadius,
    Icon: ic('M5 19V11C5 7.68629 7.68629 5 11 5H19', '1.8'),
  },
  {
    key: 'spacing',
    label: 'Spacing',
    short: 'Spacing',
    hint: 'Base spacing scale',
    title: 'Spacing',
    variablesLabel: 'Spacing variables',
    subtitle: 'Primitives for the 4px grid, then semantic aliases — gaps and insets — mapped onto that scale.',
    Component: Step5_Spacing,
    Icon: ic('M21 21V3M3 21V3M9 8V16C9 16.9319 9 17.3978 9.15224 17.7654C9.35523 18.2554 9.74458 18.6448 10.2346 18.8478C10.6022 19 11.0681 19 12 19C12.9319 19 13.3978 19 13.7654 18.8478C14.2554 18.6448 14.6448 18.2554 14.8478 17.7654C15 17.3978 15 16.9319 15 16V8C15 7.06812 15 6.60218 14.8478 6.23463C14.6448 5.74458 14.2554 5.35523 13.7654 5.15224C13.3978 5 12.9319 5 12 5C11.0681 5 10.6022 5 10.2346 5.15224C9.74458 5.35523 9.35523 5.74458 9.15224 6.23463C9 6.60218 9 7.06812 9 8Z'),
  },
  {
    key: 'shadow',
    label: 'Shadow',
    short: 'Shadow',
    hint: 'Elevation levels',
    title: 'Shadow',
    variablesLabel: 'Shadow variables',
    subtitle: 'Tune the elevation ramp — from subtle cards to floating dialogs.',
    Component: Step7_Shadow,
    Icon: ic('M8 4h10a2 2 0 0 1 2 2v10M4 10a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8Z', '1.8'),
  },
  {
    key: 'grid',
    label: 'Grid',
    short: 'Grid',
    hint: 'Columns, gutters & breakpoints',
    title: 'Grid',
    variablesLabel: 'Grid variables',
    subtitle: 'Breakpoint primitives, then desktop / mobile aliases — the cut Type and the layout grid share.',
    Component: Step8_Grid,
    Icon: ic('M7.5 12h.01m8.99 0h.01M12 12h.01M12 16.5h.01m-.01-9h.01M3 7.8v8.4c0 1.68 0 2.52.327 3.162a3 3 0 0 0 1.311 1.311C5.28 21 6.12 21 7.8 21h8.4c1.68 0 2.52 0 3.162-.327a3 3 0 0 0 1.311-1.311C21 18.72 21 17.88 21 16.2V7.8c0-1.68 0-2.52-.327-3.162a3 3 0 0 0-1.311-1.311C18.72 3 17.88 3 16.2 3H7.8c-1.68 0-2.52 0-3.162.327a3 3 0 0 0-1.311 1.311C3 5.28 3 6.12 3 7.8Z'),
  },
  {
    key: 'sizes',
    label: 'Sizes',
    short: 'Sizes',
    hint: 'Component size scale',
    title: 'Sizes',
    variablesLabel: 'Size variables',
    subtitle: 'Control heights, then semantic aliases — compact, control, touch — mapped onto that ramp.',
    Component: Step9_Sizes,
    Icon: ic('M4 20V4M20 20V4M8 12h8M8 12l2.5-2.5M8 12l2.5 2.5M16 12l-2.5-2.5M16 12l-2.5 2.5', '1.8'),
  },
  {
    key: 'stroke',
    label: 'Stroke',
    short: 'Stroke',
    hint: 'Border width & focus ring',
    title: 'Stroke',
    variablesLabel: 'Stroke variables',
    subtitle: 'Line weight primitives, then semantic aliases — divider, control, focus — not paint.',
    Component: StepStroke,
    Icon: ic('M3 3h.01M3 12h.01M3 21h.01M3 16.5h.01M3 7.5h.01M7.5 3h.01m-.01 9h.01m-.01 9h.01M16.5 3h.01m-.01 9h.01m-.01 9h.01M21 3h.01M21 12h.01M21 21h.01M21 16.5h.01m-.01-9h.01M12 21V3'),
  },
  {
    key: 'icons',
    label: 'Icon library',
    short: 'Icons',
    hint: 'Best icon libraries',
    title: 'Icon library',
    variablesLabel: 'Icon library',
    subtitle: 'Pick the icon set your system standardizes on — referenced in your tokens and docs.',
    Component: IconLibrary,
    Icon: ic('M20.5 7.27783L12 12.0001M12 12.0001L3.49997 7.27783M12 12.0001L12 21.5001M21 16.0586V7.94153C21 7.59889 21 7.42757 20.9495 7.27477C20.9049 7.13959 20.8318 7.01551 20.7354 6.91082C20.6263 6.79248 20.4766 6.70928 20.177 6.54288L12.777 2.43177C12.4934 2.27421 12.3516 2.19543 12.2015 2.16454C12.0685 2.13721 11.9315 2.13721 11.7986 2.16454C11.6484 2.19543 11.5066 2.27421 11.223 2.43177L3.82297 6.54288C3.52345 6.70928 3.37369 6.79248 3.26463 6.91082C3.16816 7.01551 3.09515 7.13959 3.05048 7.27477C3 7.42757 3 7.59889 3 7.94153V16.0586C3 16.4013 3 16.5726 3.05048 16.7254C3.09515 16.8606 3.16816 16.9847 3.26463 17.0893C3.37369 17.2077 3.52345 17.2909 3.82297 17.4573L11.223 21.5684C11.5066 21.726 11.6484 21.8047 11.7986 21.8356C11.9315 21.863 12.0685 21.863 12.2015 21.8356C12.3516 21.8047 12.4934 21.726 12.777 21.5684L20.177 17.4573C20.4766 17.2909 20.6263 17.2077 20.7354 17.0893C20.8318 16.9847 20.9049 16.8606 20.9495 16.7254C21 16.5726 21 16.4013 21 16.0586Z'),
  },
]

// The "Variables" half of the rail (Styles = icons/shadow) —
// also the exact category list HomeActions' "New" menu offers, so the two
// can never drift apart.
const VARIABLE_FOUNDATIONS = FOUNDATIONS.filter((f) => !['icons', 'shadow'].includes(f.key))

// Component categories get icons too, so the Components/Documentation rail
// reads exactly like the Variables one (same row shape, icon + label).
const CATEGORY_ICONS: Record<string, ComponentType> = {
  'Button & Actions':    ic('M9 3v11l2.5-2.5L14 17l2.5-1-2.5-5.5H18z', '1.8'),
  'Form Controls':       ic('M3 7.5h18|M3 16.5h18|M8 5v5|M16 14v5', '1.8'),
  'Indicators':          ic('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z|M12 8v4.5|M12 16h.01', '1.8'),
  'Content & Surfaces':  ic('M4 5h16v14H4z|M4 10h16', '1.8'),
  'Feedback':            ic('M21 14a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z', '1.8'),
  'Navigation':          ic('M4 6h16|M4 12h9|M4 18h16', '1.8'),
}

// The editor follows the Figma Variables hierarchy: foundation → collection
// → group. Every foundation declares only the collections it actually owns,
// so the navigation never offers a semantic or gradient surface that does not
// exist for that data type.
const VARIABLE_COLLECTIONS: Record<string, VariableCollectionItem[]> = {
  color: [
    { key: 'primitives', label: 'Color primitives' },
    { key: 'semantics', label: 'Color semantics' },
    { key: 'gradients', label: 'Gradients' },
  ],
  typography: [
    { key: 'primitives', label: 'Type primitives' },
    { key: 'semantics', label: 'Text semantics' },
  ],
  radius: [
    { key: 'primitives', label: 'Radius primitives' },
    { key: 'semantics', label: 'Radius semantics' },
  ],
  spacing: [
    { key: 'primitives', label: 'Spacing primitives' },
    { key: 'semantics', label: 'Spacing semantics' },
  ],
  grid: [
    { key: 'primitives', label: 'Grid primitives' },
    { key: 'semantics', label: 'Grid semantics' },
  ],
  sizes: [
    { key: 'primitives', label: 'Size primitives' },
    { key: 'semantics', label: 'Size semantics' },
  ],
  stroke: [
    { key: 'primitives', label: 'Stroke primitives' },
    { key: 'semantics', label: 'Stroke semantics' },
  ],
  shadow: [{ key: 'primitives', label: 'Shadow styles' }],
  icons: [{ key: 'primitives', label: 'Icon library' }],
}

const ComponentsIcon = ic('M21 8 12 3 3 8l9 5 9-5ZM3 8v8l9 5 9-5V8M12 13v8')
// Docs (the token reference) — a ruled page, distinct from DocIcon's plain
// sheet (the README export).
const RulesIcon = ic('M4 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z|M8 7h8|M8 12h8|M8 17h5', '1.8')
const StartIcon = ic('M12 3l2.1 6.4H21l-5.4 3.9 2.1 6.4L12 16.8 6.3 19.7 8.4 13.3 3 9.4h6.9z', '1.8')
const CodeIcon = ic('M16 18l6-6-6-6M8 6l-6 6 6 6')
const DocIcon = ic('M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6')
const SaveIcon: ComponentType = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
    <path d="M17 21v-8H7v8M7 3v5h8" />
  </svg>
)

const FigmaIcon: ComponentType = () => <FigmaGlyph size={18} />
const GitHubIcon: ComponentType = () => <GitHubGlyph size={18} />
/** Rail footer — match `FoundationIconRail`'s h-5 mask (~14px artwork). */

const ExportIcon: ComponentType = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M8 10V2.5M5 5.5 8 2.5l3 3M3 9.5v3.25c0 .69.56 1.25 1.25 1.25h7.5c.69 0 1.25-.56 1.25-1.25V9.5" />
  </svg>
)

type ExportMode = 'code' | 'md' | 'figma-sync' | 'figma-download' | 'github' | 'save' | null
type ThemeWorkspaceTab = 'preview' | 'primitives' | 'code'

function themeLabel(key: string): string {
  if (key === 'light') return 'Light'
  if (key === 'dark') return 'Dark'
  return key.charAt(0).toUpperCase() + key.slice(1)
}

/** One Theme menu for any count. A Light/Dark segment only works for the
 *  default pair — extra style themes are named keys (`forest`, `brand-b`),
 *  each with its own palette and a light/dark kind. Same trigger at 2 or 12. */
function PreviewThemeSwitch({
  themes,
  kinds,
  value,
  onChange,
}: {
  themes: string[]
  kinds: Record<string, 'light' | 'dark'>
  value: string
  onChange: (key: string) => void
}) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const current = themes.includes(value) ? value : themes[0]

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (themes.length < 2 || !current) return null

  return (
    <div ref={menuRef} className="relative flex-shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Preview theme ${themeLabel(current)}`}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 h-8 pl-2.5 pr-2 rounded-lg border border-line bg-app text-body font-medium hover:border-line-strong transition-colors"
      >
        <span className="text-fg-faint font-normal">Theme</span>
        <span className="text-fg truncate max-w-[8rem]">{themeLabel(current)}</span>
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" className="text-fg-faint" strokeWidth="1.6" aria-hidden>
          <path d="M3 4.5 6 8l3-3.5" />
        </svg>
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label="Preview theme"
          className="absolute right-0 top-full mt-1 z-50 w-56 max-h-64 overflow-y-auto py-1 rounded-lg border border-line bg-surface shadow-[0_12px_32px_-12px_rgba(0,0,0,0.28)]"
        >
          {themes.map((t) => {
            const on = t === current
            const kind = kinds[t] ?? 'light'
            return (
              <li key={t}>
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => { onChange(t); setOpen(false) }}
                  className={`w-full flex items-center justify-between gap-3 px-2.5 py-1.5 text-left transition-colors ${
                    on ? 'bg-accent-ui/[0.06]' : 'hover:bg-elevated/60'
                  }`}
                >
                  <span className={`text-body font-medium truncate ${on ? 'text-accent-ui' : 'text-fg'}`}>
                    {themeLabel(t)}
                  </span>
                  <span className="text-caption text-fg-faint capitalize flex-shrink-0">{kind}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

const THEME_WORKSPACE_TABS: { key: ThemeWorkspaceTab; label: string; icon: string }[] = [
  { key: 'preview', label: 'Theme preview', icon: '/icons/theme-hub-icons/Icon/theme.svg' },
  { key: 'primitives', label: 'Variables', icon: '/icons/theme-hub-icons/Icon/variables.svg' },
  { key: 'code', label: 'Get code', icon: '/icons/theme-hub-icons/Icon/code.svg' },
]

function WorkspaceTabIcon({ source }: { source: string }) {
  const mask = `url('${source}') center / contain no-repeat`
  return <span aria-hidden className="size-[15.75px] bg-current" style={{ WebkitMask: mask, mask }} />
}

function ThemeWorkspaceTabs({
  value,
  onChange,
  search,
}: {
  value: ThemeWorkspaceTab
  onChange: (tab: ThemeWorkspaceTab) => void
  search?: ReactNode
}) {
  const { t } = useI18n()
  return (
    <div className={`theme-workspace-tab-bar h-[52px] flex min-w-0 flex-shrink-0 items-center gap-3 border-b border-line ${WORKSPACE_CHROME} pl-[8px] pr-3 xl:pr-4`}>
      <div
        role="tablist"
        aria-label={t('Theme workspace')}
        className={`theme-workspace-tab-strip ${WORKSPACE_TAB_TRACK}`}
        onKeyDown={(event) => {
          const current = THEME_WORKSPACE_TABS.findIndex((item) => item.key === value)
          let next = current
          if (event.key === 'ArrowRight') next = (current + 1) % THEME_WORKSPACE_TABS.length
          else if (event.key === 'ArrowLeft') next = (current + THEME_WORKSPACE_TABS.length - 1) % THEME_WORKSPACE_TABS.length
          else if (event.key === 'Home') next = 0
          else if (event.key === 'End') next = THEME_WORKSPACE_TABS.length - 1
          else return
          event.preventDefault()
          onChange(THEME_WORKSPACE_TABS[next].key)
          const tabs = event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')
          requestAnimationFrame(() => tabs[next]?.focus())
        }}
      >
        {THEME_WORKSPACE_TABS.map((item, index) => {
          const active = item.key === value
          return (
            <Fragment key={item.key}>
              {index > 0 && (
                <span aria-hidden className="h-[26.5px] w-px flex-shrink-0 bg-line" />
              )}
              <button
                type="button"
                role="tab"
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                onClick={() => onChange(item.key)}
                title={t(item.label)}
                className={`theme-workspace-tab group flex h-9 min-w-0 items-center gap-[9px] rounded-[9px] py-[4.5px] pl-[4.5px] pr-[9px] text-caption tracking-[0.18px] transition-[color,background-color,transform] duration-150 ease-[var(--ease-out-quint)] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ui/50 ${active
                  ? `${WORKSPACE_CHIP_ACTIVE} font-bold`
                  : `font-normal ${WORKSPACE_CHIP_REST} ${WORKSPACE_CHIP_HOVER}`
                }`}
              >
                <span className={`grid size-[27px] flex-shrink-0 place-items-center rounded-[6.75px] transition-colors ${active
                  ? 'bg-inverse-action text-inverse-action-ink'
                  : 'bg-black/[0.04] text-fg-faint dark:bg-white/[0.06] group-hover:text-fg-muted'
                }`}>
                  <WorkspaceTabIcon source={item.icon} />
                </span>
                <span className="truncate px-[2.25px]">{t(item.label)}</span>
              </button>
            </Fragment>
          )
        })}
      </div>
      {search && (
        <div className="ml-auto flex flex-shrink-0 items-center min-w-0">
          {search}
        </div>
      )}
    </div>
  )
}

const EXPORT_FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/40'
const EXPORT_MENU_W = 220
const EXPORT_HALF =
  'transition-[color,background-color,box-shadow,transform] duration-150 ease-[var(--ease-out-quint)] hover:shadow-[inset_0_0_0_9999px_rgba(0,0,0,0.05)]'

function ExportMenuGlyph({ src }: { src: string }) {
  const mask = `url('${src}') center / contain no-repeat`
  return <span aria-hidden className="h-3.5 w-3.5 flex-shrink-0 bg-current" style={{ WebkitMask: mask, mask }} />
}

function ExportPill({
  onExport,
  onSyncFigma,
  onConnectGithub,
  onExportCode,
  onConnectMcp,
}: {
  onExport: () => void
  onSyncFigma: () => void
  onConnectGithub: () => void
  onExportCode: () => void
  onConnectMcp: () => void
}) {
  const { t } = useI18n()
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const place = usePopoverPlacement(rootRef, open, { prefer: 200, min: 160, max: 280 })
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useEffect(() => {
    if (!open) return
    const rect = rootRef.current?.getBoundingClientRect()
    if (!rect) return
    const left = Math.max(8, Math.min(window.innerWidth - EXPORT_MENU_W - 8, rect.right - EXPORT_MENU_W))
    setPos({
      left,
      top: place.up ? rect.top - 8 : rect.bottom + 6,
    })
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, place.up])

  const pick = (go: () => void) => {
    setOpen(false)
    go()
  }

  const itemClass = `flex w-full items-center gap-2.5 px-2.5 py-2 text-left text-caption font-medium text-fg transition-colors hover:bg-fg/8 ${EXPORT_FOCUS}`

  return (
    <div ref={rootRef} className="relative inline-flex h-8 flex-shrink-0">
      <div className="inline-flex h-8 overflow-hidden rounded-lg bg-white text-black">
        <button
          type="button"
          onClick={onExport}
          className={`inline-flex h-full items-center gap-1.5 px-2.5 text-caption font-medium ${EXPORT_HALF} active:scale-[0.98] ${EXPORT_FOCUS}`}
        >
          <ExportIcon />
          <span>{t('Export')}</span>
        </button>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={t('More export destinations')}
          onClick={() => setOpen((next) => !next)}
          className={`grid h-full w-8 place-items-center border-l border-black/10 ${EXPORT_HALF} ${EXPORT_FOCUS}`}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden className={open ? 'rotate-180' : undefined}>
            <path d="M2.5 4.25 6 7.75l3.5-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      {open && pos && createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label={t('More export destinations')}
          className="fixed z-[70] overflow-hidden rounded-lg border border-line-strong bg-app py-1 shadow-lg"
          style={{
            width: EXPORT_MENU_W,
            left: pos.left,
            ...(place.up ? { bottom: window.innerHeight - (rootRef.current?.getBoundingClientRect().top ?? 0) + 6 } : { top: pos.top }),
            maxHeight: place.max,
          }}
        >
          <button type="button" role="menuitem" className={itemClass} onClick={() => pick(onExport)}>
            <span className="grid h-4 w-4 flex-shrink-0 place-items-center text-fg"><ExportIcon /></span>
            {t('Export')}
          </button>
          <div className="my-1 border-t border-line" />
          <button type="button" role="menuitem" className={itemClass} onClick={() => pick(onSyncFigma)}>
            <span className="grid h-4 w-4 flex-shrink-0 place-items-center text-fg"><FigmaGlyph size={14} /></span>
            {t('Sync Figma')}
          </button>
          <button type="button" role="menuitem" className={itemClass} onClick={() => pick(onConnectGithub)}>
            <span className="grid h-4 w-4 flex-shrink-0 place-items-center text-fg"><GitHubGlyph size={14} /></span>
            {t('Connect GitHub')}
          </button>
          <button type="button" role="menuitem" className={itemClass} onClick={() => pick(onExportCode)}>
            <span className="grid h-4 w-4 flex-shrink-0 place-items-center text-fg"><CodeIcon /></span>
            {t('Export code')}
          </button>
          <button type="button" role="menuitem" className={itemClass} onClick={() => pick(onConnectMcp)}>
            <span className="grid h-4 w-4 flex-shrink-0 place-items-center text-fg">
              <ExportMenuGlyph src="/icons/settings/mcp.svg" />
            </span>
            {t('Connect with MCP')}
          </button>
        </div>,
        document.body,
      )}
    </div>
  )
}

// ── Center header (icon + colored title + | + subtitle [+ export]) ───────────
function CenterHeader({ Icon, title, subtitle, accentColor, right }: { Icon: ComponentType; title: string; subtitle: string; accentColor?: string; right?: ReactNode }) {
  const { t } = useI18n()
  return (
    <div className="flex items-center gap-2.5 px-6 lg:px-8 h-[52px] border-b border-line flex-shrink-0">
      <span className="flex-shrink-0" style={{ color: accentColor }}>
        <Icon />
      </span>
      <h1 className="text-sm font-semibold flex-shrink-0" style={{ color: accentColor }}>{t(title)}</h1>
      <span className="text-line-strong flex-shrink-0">|</span>
      <p className="text-sm text-fg-faint truncate min-w-0 max-w-md">{t(subtitle)}</p>
      {right && <div className="flex-shrink-0 ml-auto">{right}</div>}
    </div>
  )
}

export default function Configurator() {
  const reduceMotion = useReducedMotion() ?? false
  const { t } = useI18n()
  // `selectedComponents`/`toggleComponent` are no longer read here — the
  // include checkbox moved into ComponentsView along with the master list.
  const store = useDesignStore()
  const { primaryScale, primaryDarkScale, primaryColor, markFoundationComplete, iconLibrary, themeKinds, themeOrder, themes, themeSources, projectCreated } = store
  const theme = useTheme()
  // Fetches the configured typeface's webfont — mounted here (not inside the
  // Typography foundation) so every foundation's PreviewPanel actually
  // renders in it from first paint, not just after a visit to Font.
  useLoadActiveFonts()
  // Rebuilds every ramp when the contrast shift changes — mounted here, not in
  // a foundation, so it can't be orphaned by which component the Color section
  // happens to render (see the hook's own note).
  useRegenerateScalesOnScaleSettings()
  // Backfills the DERIVED colour ramps (`primaryScale`, `errorScale`, …) when
  // they're empty — `makeDesignDefaults()` ships them `{}` and a persisted
  // store can carry that shape. It used to be mounted only on the Color-editing
  // surfaces (ColorPrimitives / Step3 / QuickFoundationsPanel), so landing on
  // the Themes → Theme Preview hub FIRST left every `{accent.9}` / `{error.11}`
  // ref in the Categorical projection resolving to `'transparent'` — the
  // Component Variants specimens rendered invisible until you visited Primitives
  // once. Hoisted to the shell for the same reason the regenerate hook is:
  // it can't be orphaned by which surface you happen to open first.
  useEnsureColorScales()
  // This browser had never entered the workspace when the shell first rendered.
  // Captured HERE, before anything below can write the persist key (something
  // in the hook/state setup between here and where `stylePreview` initialises
  // does — checked: the store key exists by that point even on a wiped
  // browser), and read from this one value everywhere first-run behaviour
  // branches. `markOnboarded()` flips `hasOnboarded()` the instant the user
  // leaves About, so a second call is worthless; the affordances it gates
  // (About as the landing tab, Core already tried on, the Themes Library
  // collapsed to just "Create your theme") must hold for the whole session.
  const [firstRun] = useState(() => !hasOnboarded())
  // App deep-link (`?project=&section=`). Per-window, not Zustand — two
  // windows can sit on two sections of the same system. A shared section
  // wins over the first-visit About landing.
  const [incomingWorkspace] = useState(() => parseWorkspaceSearch(window.location.search))
  const incomingPlace = incomingWorkspace.place
  // Every session lands on Variables · Color — EXCEPT a first-time visitor,
  // who lands on About instead. This is the one exception to "no separate
  // landing screen": About is a real tab a returning user can still switch to
  // any time, not a wizard step.
  const [tab, setTab] = useState<Tab>(() => incomingPlace?.tab ?? (firstRun ? 'about' : 'foundations'))
  // Leaving About for anything else marks this browser onboarded, so the
  // NEXT reload lands on Variables · Color instead. Every existing path that
  // changes tabs (`selectFoundation`, `changeTab`, `selectComponent`,
  // `openDocs`) already calls `setTab`, so this one effect covers all of
  // them without a second call site to remember.
  useEffect(() => {
    if (tab !== 'about') markOnboarded()
  }, [tab])
  const [activeFoundation, setActiveFoundation] = useState<string>(() => incomingPlace?.foundation ?? 'color')
  // Themes is now the entry surface: exploration first, advanced token editing
  // only after the user deliberately opens one of the other tabs.
  const [themeWorkspaceTab, setThemeWorkspaceTab] = useState<ThemeWorkspaceTab>(() => incomingPlace?.workspace ?? 'preview')
  const [themeHubSurface, setThemeHubSurface] = useState<ThemeHubSurface>(() => incomingPlace?.surface ?? 'artefacts')
  const [codeScope, setCodeScope] = useState<CodeThemeScope>('')
  const [activeComponent, setActiveComponent] = useState<ComponentDef | null>(
    () => COMPONENTS.find((c) => c.key === incomingPlace?.component) ?? COMPONENTS.find((c) => c.key === 'Button') ?? null,
  )
  const [exportMode, setExportMode] = useState<ExportMode>(null)
  // Manual Figma publishing is one interaction shared by the top bar and the
  // detail screen. It is intentionally local — never restore a stale spinner
  // or request failure after reload.
  const [figmaPublishState, setFigmaPublishState] = useState<FigmaPublishState>('idle')
  // Set alongside an 'error' state, read by FigmaSyncView's status line — a
  // lost claim (someone else owns this project name) needs a rename or a
  // reconnect, not just "retry", so the generic "publish failed" copy isn't
  // enough on its own. Cleared on the next non-error transition.
  const [figmaPublishError, setFigmaPublishError] = useState<string | null>(null)
  const figmaPublishResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [githubPushState, setGithubPushState] = useState<GitHubPushState>('idle')
  const githubPushResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (figmaPublishResetTimer.current) clearTimeout(figmaPublishResetTimer.current)
    if (githubPushResetTimer.current) clearTimeout(githubPushResetTimer.current)
  }, [])
  // Which semantic GROUP the preview should specimen — reported by
  // Step3_SemanticTokens, normalized so it means the same thing whichever
  // architecture is active. The table owns its own nav selection; this is
  // report-only. (They were one shared value before, which is what kept the
  // non-flat architectures' preview stuck on the generic overview.)
  const [semanticFocus, setSemanticFocus] = useState<SemanticFocus | 'all'>('all')
  // Collection is foundation-local, not a global workspace depth. This is the
  // Figma Variables hierarchy: family → collection → group. Remembering the
  // last collection per family prevents Color Semantics from forcing Radius
  // to open on semantics too.
  const [collectionByFoundation, setCollectionByFoundation] = useState<Record<string, VariableCollectionKey>>(() => {
    const foundation = incomingPlace?.foundation
    const collection = incomingPlace?.collection
    return foundation && collection ? { [foundation]: collection } : {}
  })
  const activeFoundationCollections = VARIABLE_COLLECTIONS[activeFoundation] ?? [{ key: 'primitives', label: 'Primitives' }]
  const requestedCollection = collectionByFoundation[activeFoundation] ?? 'primitives'
  const activeCollection = activeFoundationCollections.some(({ key }) => key === requestedCollection)
    ? requestedCollection
    : 'primitives'
  const setFoundationCollection = (foundation: string, collection: VariableCollectionKey) => {
    setCollectionByFoundation((current) => ({ ...current, [foundation]: collection }))
  }
  const colorTab: ColorTab = activeCollection === 'semantics' ? 'semantics' : activeCollection === 'gradients' ? 'gradients' : 'primary'
  // One search field lives in the stable Foundation toolbar. Primitives and
  // Semantics consume the same value, so changing depth does not make search
  // jump to a second, redundant header row.
  const [colorQuery, setColorQuery] = useState('')
  const [typeFocus, setTypeFocus] = useState<TypeFocus>('all')
  const [typeReveal, setTypeReveal] = useState<{ key: string; seq: number } | null>(null)
  const [layoutReveal, setLayoutReveal] = useState<{ key: string; seq: number } | null>(null)
  const [colorReveal, setColorReveal] = useState<{ key: string; seq: number; as?: 'token' | 'group' | 'row' } | null>(null)
  // A ramp-grid family label in a Semantics Token Details drawer → jump to that
  // family's ramp in Color · Primitives. `seq` so clicking the same family
  // twice still re-selects it. `key` is the family VOCABULARY name (`accent`,
  // `neutral`, …); `ColorPrimitives` resolves it against the previewed theme.
  const [colorFamilyReveal, setColorFamilyReveal] = useState<{ key: string; seq: number } | null>(null)
  /** Land on the Variables tab, Color, in one collection. Both "leave this
   *  drawer for the real table" doors below share it so they can't drift into
   *  two different ideas of where the table is. */
  const openColorCollection = (collection: VariableCollectionKey) => {
    setActiveFoundation('color')
    setFoundationCollection('color', collection)
    setThemeWorkspaceTab('primitives')
    setExportMode(null)
    setTab('foundations')
  }
  const openPrimitiveFamily = (family: string) => {
    openColorCollection('primitives')
    setColorFamilyReveal((prev) => ({ key: family, seq: (prev?.seq ?? 0) + 1 }))
  }
  /** Theme Preview's Token Details → this token's row in the full Semantics
   *  table, revealed and flashed. Reuses the same `revealRole` channel the
   *  preview specimens already use, so there is one "show me this token"
   *  mechanism rather than a second one for the drawer. */
  const openTokenInVariables = (tokenId: string) => {
    openColorCollection('semantics')
    setColorReveal((prev) => ({ key: tokenId, seq: (prev?.seq ?? 0) + 1, as: 'row' }))
  }
  // Primitives' own 198px left column (accent-color cell · Groups · family
  // nav), collapsed to a swatch strip. Lifted for the same reason `colorTab`
  // is: TopNav's brand block continues this column's divider up through the
  // header (`brandWidth` below), so the shell has to know the width to keep
  // that one rule unbroken. Not persisted — a per-session working preference,
  // like `previewCollapsed`.
  const [groupsRailCollapsed, setGroupsRailCollapsed] = useState(false)
  // Theme selection and preview appearance are editor state. They deliberately
  // do not read or write `sd-theme`: the latter is chrome-only and lives in
  // lib/theme.ts. A dark-spectrum theme leads with Dark, while the user can
  // inspect its Light appearance without repainting the Escala workspace.
  //
  // SEEDED from the chrome's own appearance, never from `themeOrder[0]`. The
  // store ships its two built-ins in a fixed order (`['light', 'dark']`), so
  // `themeOrder[0]` is literally the string `'light'` — which rendered a LIGHT
  // board inside dark chrome on every first load, in an app whose documented
  // default is dark (`getTheme()`, and the pre-paint script in index.html).
  // The board has to read the same source that decided the chrome: prefer a
  // theme whose `themeKinds` matches it, and keep `themeOrder[0]` as the
  // fallback for a system with no theme on that side (a theme-scoped kit — see
  // the clamp below).
  //
  // A SEED, not a link. The two stay decoupled after this first render, which
  // is what lets the user inspect a Light theme without repainting Escala.
  const initialTheme = resolveListedTheme(themeOrder, themes, themeKinds, incomingPlace?.theme, theme)
  const [previewSelection, setPreviewSelection] = useState<{
    theme: string
    appearance: ThemeAppearance
  }>(() => ({ theme: initialTheme, appearance: themeKinds[initialTheme] ?? theme }))
  // CLAMPED to a theme the current system actually has. `previewThemeRaw` can
  // point at a theme that no longer exists, and nothing used to notice:
  //
  //  · **Loading a theme-scoped system.** Saving "just one theme" narrows
  //    `themeOrder` (see `scopeSnapshotToTheme`), so loading a Dark-only kit
  //    while previewing light left `previewTheme === 'light'` against a system
  //    with no light theme. Measured: `resolvePreviewTokens(state, 'light')`
  //    fell through `themes[key] ?? themes.light ?? {}` to an empty map and
  //    `themeKinds[key] ?? 'light'`, rendering surface `#fdfdfd` / text
  //    `#0a0d12` — a fully LIGHT preview of a system whose only theme is dark,
  //    beside a Semantics table showing one Dark column.
  //  · **Deleting the previewed theme.** `removeTheme` drops the key and never
  //    looks at what is being previewed — the same dangling reference by
  //    another route.
  //
  // Derived rather than corrected through an effect on purpose: a `useEffect`
  // that calls `setPreviewTheme` is the cascading-render pattern the React
  // lint rule flags, and it would fight `changePreviewTheme` on every load.
  // The RAW value is deliberately kept, so re-loading a system that has the
  // user's preferred theme again snaps back to it instead of stranding them on
  // whatever the narrow system happened to carry.
  const previewTheme = resolveListedTheme(
    themeOrder,
    themes,
    themeKinds,
    previewSelection.theme,
    previewSelection.appearance,
  )
  const previewAppearance = previewSelection.theme === previewTheme
    ? previewSelection.appearance
    : (themeKinds[previewTheme] ?? 'light')
  const syncThemes = useMemo(() => {
    const own = myThemeKeys(themeOrder, themes)
    return own.length ? own : themeOrder.filter((key) => Boolean(themes[key]))
  }, [themeOrder, themes])
  const [figmaFileName, setFigmaFileName] = useState(() =>
    themeDisplayName(syncThemes[0] ?? previewTheme, store.themeLabels),
  )
  const [figmaFileNameDirty, setFigmaFileNameDirty] = useState(false)
  const [figmaSyncModes, setFigmaSyncModes] = useState<FigmaSyncMode[]>(() =>
    defaultFigmaSyncModes(syncThemes, themeKinds),
  )
  const syncThemeKey = syncThemes.join('|')
  useEffect(() => {
    if (!figmaFileNameDirty && syncThemes[0]) {
      setFigmaFileName(themeDisplayName(syncThemes[0], store.themeLabels))
    }
  }, [figmaFileNameDirty, syncThemes, store.themeLabels, syncThemeKey])
  useEffect(() => {
    setFigmaSyncModes((current) => {
      const valid = current.filter((mode) => syncThemes.includes(mode.theme))
      return valid.length ? valid : defaultFigmaSyncModes(syncThemes, themeKinds)
    })
  }, [syncThemeKey, syncThemes, themeKinds])
  const figmaPublishBase = useMemo(() => ({
    theme: previewTheme,
    modes: figmaSyncModes,
    project: figmaFileName.trim() || undefined,
  }), [previewTheme, figmaSyncModes, figmaFileName])
  // Ephemeral "try-on" of a System Style preset from the Themes Library. It
  // never touches the store — the preview reads `resolveStylePreviewTokens`
  // instead of the live tokens while it's set (see ThemePreviewHub). Cleared by
  // any real theme change and whenever the preview surface isn't on screen.
  //
  // Seeding "Core, pre-tried-on" for a themeless browser is the LIBRARY's job,
  // not the shell's: this state's only writer that survives is the rail (its
  // unmount cleanup nulls it, and in dev StrictMode's mount/unmount/mount
  // clobbered any value seeded here before the rail ever rendered). The rail
  // re-seeds Core on every mount until a theme is committed — see `hasOwnTheme`
  // there.
  const [stylePreview, setStylePreview] = useState<StylePreview | null>(null)
  const changePreviewTheme = (key: string) => {
    setStylePreview(null)
    // Read the LIVE store, never this render's `themeKinds`. A theme that
    // `mintTheme` created microseconds ago — Create theme, or a Suggested
    // Style's "Add to system" — does not exist in the closure yet, so the old
    // `themeKinds[key] ?? 'light'` fell through and previewed EVERY new dark
    // theme as light. It never self-corrected either: `previewSelection.theme`
    // already equalled `previewTheme`, so the `themeKinds` fallback below is
    // skipped and the stale 'light' stuck until the row was clicked again.
    const kinds = useDesignStore.getState().themeKinds
    setPreviewSelection({ theme: key, appearance: kinds[key] ?? 'light' })
  }
  const changePreviewAppearance = (appearance: ThemeAppearance) => {
    setPreviewSelection((current) => ({ ...current, theme: previewTheme, appearance }))
    // A live System Style try-on renders from `stylePreview.appearance`, not
    // `previewAppearance` — so the board's sun/moon has to move it too. This is
    // the control the per-preset toggle in the Themes Library used to be.
    setStylePreview((current) => (current ? { ...current, appearance } : current))
  }
  // Right preview panel can be collapsed for more center width; re-expanded
  // via the slim strip that replaces it while collapsed. Starts EXPANDED: it's
  // a persistent, always-visible specimen of the category being edited, not an
  // opt-in extra — collapsing is still available for anyone who wants the width.
  const [previewCollapsed, setPreviewCollapsed] = useState(false)
  // Left section rail (SectionRail) collapsed to an icon-only strip — mirrors
  // the right preview panel's own collapse pattern. TopNav's brand block
  // reads this too (via `railCollapsed` below), so the wordmark drops out in
  // step with the rail instead of leaving orphaned empty space beside it.
  const [railCollapsed, setRailCollapsed] = useState(false)
  // Per-section export window (CSS · Tailwind · Tokens · MD) — opened from the header.
  const [sectionExportOpen, setSectionExportOpen] = useState(false)
  // `null` means the normal whole-system entry point. The Theme Preview hub
  // sets this to its selected theme, then opens the same ExportWizard.
  const [themeExportScope, setThemeExportScope] = useState<string | null>(null)
  // Which primitive color families the NEXT export run starts scoped to.
  // `null` = whatever the collection default is (every family) — set only by
  // Primitives' per-family export icon, and cleared again whenever the generic
  // Export pill opens the wizard, so a quick export never leaks its narrow
  // scope into the next full one.
  // Bumped on every open so the wizard REMOUNTS. Its step/format/family state
  // is internal, and closing then reopening inside the 0.15s exit animation
  // reuses the same AnimatePresence child — so a narrowed run (a few families,
  // already on step 3) could hand that state to the next export. A fresh key
  // per open makes "opened again" mean "started again".
  const [exportRun, setExportRun] = useState(0)
  const openSectionExport = () => {
    setThemeExportScope(null)
    setExportRun((n) => n + 1)
    setSectionExportOpen(true)
  }
  const openThemeExport = (themeKey: string) => {
    setThemeExportScope(themeKey)
    setExportRun((n) => n + 1)
    setSectionExportOpen(true)
  }
  // Import-your-design-system modal (paste/drop a tokens JSON → review → adopt).
  const [importOpen, setImportOpen] = useState(false)
  const [newSystemOpen, setNewSystemOpen] = useState(false)
  // Components catalogue — filters the master list by label/key. ONE search
  // state now: Documentation carried a second, identical one (`docsSearch`)
  // over the same catalogue, so a filter typed in one section was invisible in
  // the other. Rendered in CenterHeader's row, not inside the master list's
  // column — the box used to open that column with a gap under the header.
  const [componentSearch, setComponentSearch] = useState('')
  // Docs exposes only focused operating pages from the top-menu. The token
  // reference stays in the preview's contextual documentation surface, so the
  // global destination never duplicates it.
  const [docFoundationKey, setDocFoundationKey] = useState<string>(() => incomingPlace?.doc ?? GUIDE_MCP_KEY)

  const section = FOUNDATIONS.find((s) => s.key === activeFoundation) ?? FOUNDATIONS[0]

  // ── Chrome accent — the UI's own highlight color (table active states,
  // modified dots, previewed-theme tints via `accent-ui`) tracks the system's
  // primary, adjusted for readability on dark chrome like the header/rail.
  // It used to be `primaryScale[9]` raw in light chrome — the anchor tone, i.e.
  // the user's hex verbatim. That's the one tone with NO contrast guarantee, so
  // a light accent gave 3:1 section titles and 3:1 white-on-fill buttons while
  // the Color preview panel right beside them rendered a correctly-darkened
  // button (the token side anchors `action-primary` to `accessibleSolidTone`).
  // Same anchor now drives the chrome, resolved against the chrome's own page —
  // and each appearance walks its OWN ramp, so dark chrome reads the dark twin
  // instead of brightening a light-ramp tone by hand.
  // The contrast target is `--app` (the chrome PAGE), deliberately — the same
  // reference the role catalogue uses for every text role
  // (`contrastAgainst: 'background-primary'`). Aiming at `--elevated`
  // (#e8e8ea) instead would be stricter, but for a pale accent it forces tone
  // 12 — near-black — and the chrome stops reading as the user's colour at
  // all. Residual: accent text sitting ON `bg-elevated` (active table rows)
  // lands around 3.8:1 — fine as a UI component, short of AA for body text.
  // Fixing THAT means moving those rows off `bg-elevated` onto an accent tint,
  // which is a visual-design change, not a token one.
  // Resolved against the PREVIEWED theme's own brand family (`themeSources`),
  // not always the global `accent` — selecting a theme folder in Primitives
  // (or a Semantics column) previews that theme via `previewTheme`, and the
  // chrome accent has to follow it or picking e.g. Green leaves every chip,
  // dot and this toolbar wash pinned to Theme 1's purple. Same fix as
  // `StepGradients`' `themeBrandRamp` call — one resolver, so a family
  // reference can't disagree about which ramp "the accent" means depending on
  // which surface reads it.
  //
  // FORCED to the chrome's own appearance (`theme`), not the previewed theme's.
  // Preview appearance and chrome appearance are decoupled in the Themes
  // workspace — inspecting a LIGHT theme's Light face while the workspace is in
  // dark mode is normal — and every derivation below (`--accent-ui`,
  // `--accent-solid`, the Layer 0 gradient, the toolbar wash) is chrome, read
  // against the chrome page. Feeding it the light twin there bled a bright
  // splash into the dark chrome and dropped the accent-fill contrast. The
  // preview canvas keeps `previewAppearance`; only the chrome locks to `theme`.
  //
  // A live STYLE TRY-ON wins over the previewed theme, for the same reason the
  // previewed theme wins over the global accent: the chrome has to be reading
  // the same system the canvas is. `themeBrandRamp` resolves from the real
  // store, which a try-on deliberately never touches — so selecting Core left
  // the canvas blue and every chip, wash and accent-filled control on the
  // traditional violet. Same appearance rule as below: the CHROME's, not the
  // previewed one's.
  const chromeAppearance = theme === 'dark' ? 'dark' : 'light'
  const uiAccentRamp = stylePreview
    ? stylePreviewBrandRamp(store, stylePreview.preset, chromeAppearance)
    : themeBrandRamp(previewTheme, themeSources, themeKinds, store, chromeAppearance)
  const uiAccent =
    theme === 'dark'
      ? chromeAccent(uiAccentRamp ?? primaryDarkScale, '#1b1b1c', primaryColor)
      : chromeAccent(uiAccentRamp ?? primaryScale, '#f5f5f5', primaryColor)
  // ── …and the chrome accent as a FILL, which is a different question ──
  // `chromeAccent` walks UP the ramp until the tone clears 4.5:1 against the
  // chrome PAGE. That is the right rule for INK, and the wrong one for a solid
  // fill: a fill isn't read against the page, its LABEL is read against the
  // fill. Solving both with one value visibly desaturated the fill — measured
  // on accent `#a317e6` in dark chrome, `--accent-ui` landed on dark-ramp tone
  // 11 (`#a557d7`, a washed lavender) while the Color preview's Primary button
  // rendered the anchor `#a317e6`. Same accent, two colours on screen, which is
  // exactly what the chrome's accent buttons looked wrong against.
  //
  // The fill uses `brandSolidPair` on the previewed ramp — the SAME rule
  // `{accent.solid}` resolves through in Categorical (`action.primary`) and the
  // same one the flat catalogue's `background-brand-solid` anchors to. So an
  // accent-filled chrome control is the user's brand solid, hex for hex with
  // the preview. **This has to track whatever `{accent.solid}` uses**: it was
  // `solidInkPair`, and when that walked a dark ramp to its near-white end the
  // chrome's accent buttons went pale in lockstep with the canvas — the bug
  // stayed invisible precisely because both halves were wrong together.
  const fillRamp = uiAccentRamp ?? (theme === 'dark' ? primaryDarkScale : primaryScale)
  const uiAccentSolid = (() => {
    const inks = ['#ffffff', '#0a0d12']
    const ramp = fillRamp && Object.keys(fillRamp).length ? fillRamp : null
    if (!ramp) return primaryColor
    return ramp[brandSolidPair(ramp, inks).tone] ?? primaryColor
  })()
  // The ink for an `--accent-solid` fill, solved against THAT fill — not
  // against `--accent-ui`, which is a different colour now.
  const uiAccentInk = readableInk(uiAccentSolid)
  useEffect(() => {
    document.documentElement.style.setProperty('--accent-ui', uiAccent)
    document.documentElement.style.setProperty('--accent-solid', uiAccentSolid)
    document.documentElement.style.setProperty('--accent-ink', uiAccentInk)
  }, [uiAccent, uiAccentSolid, uiAccentInk])

  // ── Layer 0: brand-derived gradient (re-derives live with brand + theme) ──
  const s = uiAccentRamp ?? (theme === 'dark' ? primaryDarkScale : primaryScale)
  // Dark is SOLVED, not read off a ramp tone — see `darkChromeWash`. Picking a
  // tone is a lightness-driven choice, so the stop's saturation was whatever
  // that hue's ramp happened to leave there: the default accent's dark tone 6
  // (`#49266c`) measured L 0.352 at 63 % of the chroma available at that
  // lightness, i.e. mid-dark AND under-saturated — brown, not brand.
  // `darkChromeWash` pins the depth and takes the full gamut wall at it, so
  // every hue lands equally deep and equally vivid (`#2a0048` for the default
  // violet). Light keeps its ramp tones: pale-tint → white has no such problem.
  // Second stop stays `#1b1b1c` — that IS `--app` in dark, so the wash resolves
  // into the page rather than onto a near-match of it.
  const gradient =
    theme === 'dark'
      ? `linear-gradient(160deg, ${darkChromeWash(s[BASE_TONE] ?? primaryColor ?? '#9522e9')} 0%, #1b1b1c 48%)`
      : `linear-gradient(160deg, ${s[3] ?? s[2] ?? primaryColor ?? '#ede9fe'} 0%, ${s[1] ?? '#faf5ff'} 42%, #ffffff 100%)`

  // ── Navigation handlers (selecting anything leaves export mode) ──
  // Marking happens on *leave*: a foundation counts as visited for the
  // progress checklist once the user navigates away from it.
  const commitVisit = useCallback(() => {
    if (!exportMode && tab === 'foundations') {
      markFoundationComplete(activeFoundation)
    }
  }, [activeFoundation, exportMode, markFoundationComplete, tab])
  const navigateToSearchResult = useCallback((entry: TokenSearchEntry) => {
    commitVisit()
    setExportMode(null)
    setTab('foundations')
    setThemeWorkspaceTab('primitives')
    setColorQuery('')

    const { foundation, collection, id, group } = entry

    if (foundation === 'color') {
      setActiveFoundation('color')
      setFoundationCollection('color', collection)
      if (collection === 'primitives' && group) {
        setColorFamilyReveal((prev) => ({ key: group, seq: (prev?.seq ?? 0) + 1 }))
      } else if (collection === 'semantics') {
        setColorReveal((prev) => ({ key: id, seq: (prev?.seq ?? 0) + 1, as: 'row' }))
      }
      return
    }

    setActiveFoundation(foundation)
    if (collection === 'semantics') {
      setFoundationCollection(foundation, 'semantics')
      if (foundation === 'typography') {
        setTypeReveal((prev) => ({ key: id, seq: (prev?.seq ?? 0) + 1 }))
      } else {
        setLayoutReveal((prev) => ({ key: id, seq: (prev?.seq ?? 0) + 1 }))
      }
    } else {
      setFoundationCollection(foundation, 'primitives')
      setColorQuery(id)
    }
  }, [commitVisit])
  const selectFoundation = (key: string) => {
    commitVisit()
    setExportMode(null)
    setTab('foundations')
    setThemeWorkspaceTab('primitives')
    setActiveFoundation(key)
  }
  /**
   * The WORKSPACE icon rail's own handler — it picks a foundation without
   * moving you between tabs.
   *
   * `selectFoundation` (above) forces `themeWorkspaceTab: 'primitives'`, which
   * is right for every OUTSIDE door into the editor (Docs' "Edit tokens",
   * TopNav, a quick panel's "Go to advanced edition") and wrong for the rail
   * itself: on Variables the rail is which TABLE you're editing, so jumping
   * tabs on every click would be leaving the screen you meant to stay on.
   */
  const selectWorkspaceFoundation = (key: string) => {
    commitVisit()
    setActiveFoundation(key)
    // The quick panel only mounts on the artefacts surface (`ThemePreviewHub`),
    // so picking a foundation from Components or Documentation would otherwise
    // change nothing visible. Choosing a foundation IS "I want to edit it".
    if (themeWorkspaceTab === 'preview' && themeHubSurface !== 'artefacts') setThemeHubSurface('artefacts')
  }
  const changeThemeWorkspaceTab = (next: ThemeWorkspaceTab) => {
    setThemeWorkspaceTab(next)
    // GitHub and Figma are detail surfaces inside Theme Preview, not a new
    // workspace tab. Clicking the already-selected Theme preview tab must
    // therefore behave like Home: restore the original artefacts canvas and
    // its quick-edit rail instead of leaving the integration page in place.
    if (next === 'preview') setThemeHubSurface('artefacts')
    // Get code is always one My-theme. Theme preview and this picker must
    // agree on which theme the file describes. Built-in light/dark are not
    // listed there — those fall through to the first own theme, or empty.
    if (next === 'code' && themeWorkspaceTab !== 'code') {
      const listed = myThemeKeys(themeOrder, themes)
      setCodeScope(resolveCodeTheme(listed, codeScope, previewTheme))
    }
  }
  const openCodeForTheme = (key: string) => {
    changePreviewTheme(key)
    setCodeScope(key)
    setThemeWorkspaceTab('code')
  }
  /**
   * Per-theme twin of the canvas header's Sync button. Same shape as
   * `openCodeForTheme` directly above, plus one thing that shape doesn't need:
   * it SELECTS the theme as the sync target.
   *
   * Previewing alone is not enough and shipped wrong once — the page opened on
   * the clicked theme while File & modes still had the previous one checked and
   * the slug still read `?project=core--minimalist`, i.e. a menu item on the
   * Glass Copy row that would have published Core. `defaultFigmaSyncModes` is
   * the same helper the initial state uses, handed one theme, so the selection
   * is both appearances of it in the usual kind-first order — not a second
   * mode-building code path that could disagree with the picker.
   *
   * The FILE NAME is deliberately left alone: one Figma file carries a column
   * per theme, so the name belongs to the file, not to whichever theme is
   * checked, and it is a user-editable field with its own default rule.
   */
  const syncFigmaForTheme = (key: string) => {
    changePreviewTheme(key)
    setFigmaSyncModes(defaultFigmaSyncModes([key], themeKinds))
    setThemeWorkspaceTab('preview')
    setThemeHubSurface('figma')
  }
  const openThemeLibraryFromCode = () => {
    changeThemeWorkspaceTab('preview')
    window.requestAnimationFrame(() => {
      document.getElementById('themes-library')?.focus()
    })
  }
  /** Docs destination, opened at a specific foundation — the reverse of
   *  `FoundationArticle`'s own "Edit tokens" link. Used by the preview aside's
   *  Documentation tab, whose accordion is a reading surface for the column,
   *  not a replacement for the full-width page. */
  const openDocs = (key: string) => {
    commitVisit()
    setExportMode(null)
    setTab('docs')
    setDocFoundationKey(key)
  }
  const leaveExportWizard = () => setSectionExportOpen(false)
  const openFigmaSyncPage = () => {
    leaveExportWizard()
    commitVisit()
    setExportMode(null)
    setTab('foundations')
    setThemeWorkspaceTab('preview')
    setThemeHubSurface('figma')
  }
  const openGithubPage = () => {
    leaveExportWizard()
    commitVisit()
    setExportMode(null)
    setTab('foundations')
    setThemeWorkspaceTab('preview')
    setThemeHubSurface('github')
  }
  const openGetCodePage = () => {
    leaveExportWizard()
    commitVisit()
    setExportMode(null)
    setTab('foundations')
    if (themeWorkspaceTab !== 'code') {
      const listed = myThemeKeys(themeOrder, themes)
      setCodeScope(resolveCodeTheme(listed, codeScope, previewTheme))
    }
    setThemeWorkspaceTab('code')
  }
  const openMcpPage = () => {
    leaveExportWizard()
    openDocs(GUIDE_MCP_KEY)
  }
  useEffect(() => {
    const onOpenFaq = () => {
      commitVisit()
      setExportMode(null)
      setTab('docs')
      setDocFoundationKey(FAQ_KEY)
    }
    window.addEventListener(OPEN_FAQ_EVENT, onOpenFaq)
    return () => window.removeEventListener(OPEN_FAQ_EVENT, onOpenFaq)
  }, [commitVisit])
  const selectComponent = (c: ComponentDef) => {
    commitVisit()
    markFoundationComplete('components')
    setExportMode(null)
    setTab('components')
    setActiveComponent(c)
  }
  const changeTab = (t: Tab) => {
    commitVisit()
    if (t === 'components') markFoundationComplete('components')
    setExportMode(null)
    setTab(t)
  }
  const openExport = (mode: Exclude<ExportMode, null>) => {
    commitVisit()
    setExportMode(mode)
  }
  const openFigmaSyncDetails = useCallback(() => {
    commitVisit()
    setExportMode('figma-sync')
  }, [commitVisit])
  const handleFigmaPublishState = useCallback((next: FigmaPublishState, reason?: PublishFailureReason) => {
    if (figmaPublishResetTimer.current) {
      clearTimeout(figmaPublishResetTimer.current)
      figmaPublishResetTimer.current = null
    }
    setFigmaPublishState(next)
    setFigmaPublishError(next === 'error' ? describePublishFailure(reason, figmaFileName) : null)
    if (next === 'done') {
      figmaPublishResetTimer.current = setTimeout(() => setFigmaPublishState('idle'), 1800)
    }
  }, [figmaFileName])
  // Re-publish to /api/tokens after edits while auto-sync is on (no-op
  // otherwise) — shares handleFigmaPublishState with the manual button below
  // so a background failure lights the same red dot instead of failing silently.
  const workspaceSection = encodeWorkspaceSection({
    tab,
    workspace: themeWorkspaceTab,
    surface: themeHubSurface,
    theme: previewTheme,
    foundation: activeFoundation,
    collection: activeCollection,
    component: activeComponent?.key,
    doc: docFoundationKey,
  })
  useEffect(() => {
    syncWorkspaceSearch({ project: syncProjectId(figmaFileName), section: workspaceSection })
  }, [workspaceSection, store.projectName, figmaFileName])
  useAutoFigmaSync(handleFigmaPublishState, { ...figmaPublishBase, section: workspaceSection })
  useEffect(() => {
    setActiveThemeHint(previewTheme)
  }, [previewTheme])
  const publishFigmaNow = useCallback(() => {
    commitVisit()
    if (!isLiveEnvironment() || figmaPublishState === 'publishing') return
    handleFigmaPublishState('publishing')
    void publishTokens({ ...figmaPublishBase, section: workspaceSection }).then((result) => handleFigmaPublishState(result.ok ? 'done' : 'error', result.reason))
  }, [commitVisit, figmaPublishState, handleFigmaPublishState, figmaPublishBase, workspaceSection])
  const syncFigmaNow = useCallback(() => {
    setExportMode('figma-sync')
    publishFigmaNow()
  }, [publishFigmaNow])
  const handleGithubPushState = useCallback((next: GitHubPushState) => {
    if (githubPushResetTimer.current) {
      clearTimeout(githubPushResetTimer.current)
      githubPushResetTimer.current = null
    }
    setGithubPushState(next)
    if (next === 'done') {
      githubPushResetTimer.current = setTimeout(() => setGithubPushState('idle'), 1800)
    }
  }, [])

  const tokenSearchIndex = useMemo(() => {
    const json = generateTokenJSON()
    return buildTokenSearchIndex({
      colors: {
        primitive: json.colors.primitive,
        primitiveAlpha: json.colors.primitiveAlpha,
        themes: json.colors.themes,
        themeOrder: json.colors.themeOrder,
        semanticArchitecture: json.colors.semanticArchitecture,
        architecture: json.colors.architecture ?? undefined,
      },
      typography: json.typography,
      spacing: json.spacing,
      spacingRoles: json.spacingRoles,
      radius: json.radius,
      radiusRoles: json.radiusRoles,
      sizes: json.sizes,
      sizeRoles: json.sizeRoles,
      selector: json.selector,
      selectorRoles: json.selectorRoles,
      stroke: json.stroke,
      strokeRoles: json.strokeRoles,
      grid: json.grid,
      breakpointRoles: json.breakpointRoles,
      shadows: json.shadows,
      gradients: json.gradients,
    }, previewTheme)
  }, [store, previewTheme])

  const tokenSearchField = (
    <TokenSearchField
      value={colorQuery}
      onChange={setColorQuery}
      index={tokenSearchIndex}
      onSelect={navigateToSearchResult}
    />
  )

  // The rail footer is Reset now. Figma sync moved to the canvas header (and
  // each theme's options menu); GitHub keeps its doors in the connection rail,
  // SaveView, the Export wizard and Docs — see `ResetScopeControl`.
  const themeWorkspaceSyncFooter = <ResetScopeControl previewTheme={previewTheme} />

  // ── Resolve center header + body for the current mode ──
  let header: { Icon: ComponentType; title: string; subtitle: string; right?: ReactNode }
  let body: ReactNode
  let centerKey: string

  if (exportMode === 'github') {
    header = { Icon: GitHubIcon, title: 'GitHub', subtitle: 'Version your design system in a repository.' }
    body = (
      <div className="h-full overflow-y-auto">
        <GitHubConnectView onClose={() => setExportMode(null)} onPushStateChange={handleGithubPushState} />
      </div>
    )
    centerKey = 'export-github'
  } else if (exportMode === 'figma-sync') {
        header = { Icon: FigmaIcon, title: 'Figma', subtitle: 'Name the file, pick modes, then publish to the plugin.' }
    body = (
      <div className="h-full overflow-y-auto">
        <FigmaSyncView
          onClose={() => setExportMode(null)}
          onOpenDownload={() => setExportMode('figma-download')}
          publishState={figmaPublishState}
          publishError={figmaPublishError}
          onRequestSync={syncFigmaNow}
          previewTheme={previewTheme}
          onSelectTheme={changePreviewTheme}
          fileName={figmaFileName}
          onFileNameChange={(name) => {
            setFigmaFileNameDirty(true)
            setFigmaFileName(name)
          }}
          syncModes={figmaSyncModes}
          onSyncModesChange={setFigmaSyncModes}
          section={workspaceSection}
        />
      </div>
    )
    centerKey = 'export-figma-sync'
  } else if (exportMode === 'figma-download') {
    header = { Icon: FigmaIcon, title: 'Figma', subtitle: 'Get the plugin and install it in Figma.' }
    body = (
      <div className="h-full overflow-y-auto">
        <FigmaDownloadView onClose={() => setExportMode(null)} onOpenSync={openFigmaSyncDetails} />
      </div>
    )
    centerKey = 'export-figma-download'
  } else if (exportMode === 'md') {
    header = { Icon: DocIcon, title: 'Docs', subtitle: 'Your didactic README — preview, copy or download it.' }
    body = (
      <div className="h-full overflow-y-auto">
        <ExportView initialTab="markdown" onClose={() => setExportMode(null)} />
      </div>
    )
    centerKey = 'export-md'
  } else if (exportMode === 'code') {
    header = { Icon: CodeIcon, title: 'Export', subtitle: 'tokens.json and variables.css for your codebase.' }
    body = (
      <div className="h-full overflow-y-auto">
        <ExportView initialTab="tokens" onClose={() => setExportMode(null)} />
      </div>
    )
    centerKey = 'export-code'
  } else if (exportMode === 'save') {
    header = { Icon: SaveIcon, title: 'System library', subtitle: 'Save, restore and manage your design systems.' }
    body = (
      <div className="h-full overflow-y-auto p-8">
        <SaveView onImport={() => setImportOpen(true)} onNewSystem={() => setNewSystemOpen(true)} />
      </div>
    )
    centerKey = 'export-save'
  } else if (tab === 'about') {
    // header is unused — About skips CenterHeader entirely (see the
    // `skipCenterHeader` note below) in favor of its own hero. StartIcon is
    // just a harmless placeholder to satisfy the type.
    header = { Icon: StartIcon, title: 'About', subtitle: '' }
    body = (
      <AboutHome
        onStart={() => selectFoundation('color')}
        onLearnAI={() => openDocs(GUIDE_MCP_KEY)}
        foundationCount={FOUNDATIONS.length}
      />
    )
    centerKey = 'about'
  } else if (tab === 'foundations') {
    header = { Icon: section.Icon, title: section.title, subtitle: section.subtitle }
    // Export is transversal and lives in TopNav; there's no per-foundation
    // action pill in CenterHeader (Variables foundations don't render that
    // header at all). The old whole-system Reset pill is gone entirely.
    const Active = section.Component
    // Inner body only — Groups | icon-rail is the STABLE shell
    // (FoundationWorkbench, mounted outside the keyed motion below) so
    // Color → Font doesn't remount the switcher.
    body = section.key === 'color' ? (
      <ColorHub
        mode={colorTab}
        onFocusChange={setSemanticFocus}
        previewTheme={previewTheme}
        previewAppearance={previewAppearance}
        onPreviewThemeChange={changePreviewTheme}
        onPreviewAppearanceChange={changePreviewAppearance}
        query={colorQuery}
        onQueryChange={setColorQuery}
        railCollapsed={groupsRailCollapsed}
        revealRole={colorReveal}
        revealFamily={colorFamilyReveal}
        managedThemesExternally
        onOpenGradients={() => setFoundationCollection('color', 'gradients')}
        onBackToSystemColors={() => setFoundationCollection('color', 'primitives')}
        onOpenPrimitiveFamily={openPrimitiveFamily}
      />
    ) : section.key === 'typography' ? (
      <TypeHub
        mode={activeCollection === 'semantics' ? 'semantics' : 'primary'}
        onFocusChange={setTypeFocus}
        revealRole={typeReveal}
        railCollapsed={groupsRailCollapsed}
        previewTheme={previewTheme}
        previewAppearance={previewAppearance}
        query={colorQuery}
      />
    ) : section.key === 'icons' ? (
      <div className="h-full overflow-y-auto p-8">
        <Active />
      </div>
    ) : section.key === 'radius' || section.key === 'spacing' || section.key === 'sizes' || section.key === 'stroke' ? (
      <LayoutHub
        family={section.key === 'sizes' ? 'size' : section.key}
        mode={activeCollection === 'semantics' ? 'semantics' : 'primary'}
        Primitives={Active}
        revealRole={layoutReveal}
        railCollapsed={groupsRailCollapsed}
        previewTheme={previewTheme}
        previewAppearance={previewAppearance}
        query={colorQuery}
      />
    ) : section.key === 'grid' ? (
      <LayoutHub
        family="breakpoint"
        mode={activeCollection === 'semantics' ? 'semantics' : 'primary'}
        Primitives={Active}
        Semantics={GridSemantics}
        revealRole={layoutReveal}
        railCollapsed={groupsRailCollapsed}
        previewTheme={previewTheme}
        previewAppearance={previewAppearance}
        query={colorQuery}
      />
    ) : section.key === 'shadow' ? (
      // Shadow has no semantic layer, so it never goes through LayoutHub — but
      // its table is still the primitive list and takes the same heading and
      // the workspace's own search (so it drops its inner bar like the rest).
      <Active tabBar={<LayoutTabHeading mode="primary" />} query={colorQuery} previewTheme={previewTheme} />
    ) : (
      <Active />
    )
    centerKey = `f-${section.key}`
  } else if (tab === 'components') {
    header = {
      Icon: ComponentsIcon,
      title: 'Components',
      subtitle: 'One page per component — live playground, examples, accessibility, Figma and API.',
      // Search stays last. Theme switch + Edit Color sit in the gap the
      // subtitle already yields (`truncate`). Same `previewTheme` as the
      // playground — not a second switcher.
      right: (
        <div className="flex items-center gap-2">
          <PreviewThemeSwitch
            themes={(() => {
              const own = myThemeKeys(themeOrder, themes)
              return own.length ? own : themeOrder.filter((t) => themes[t])
            })()}
            kinds={themeKinds}
            value={previewTheme}
            onChange={changePreviewTheme}
          />
          <button
            type="button"
            onClick={() => selectFoundation('color')}
            className="h-8 px-2 text-body font-medium text-fg-muted hover:text-fg transition-colors flex-shrink-0"
          >
            Edit Color
          </button>
          <div className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-app border border-line w-44 lg:w-52 min-w-[8rem] focus-within:border-line-strong transition-colors">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-fg-faint flex-shrink-0">
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M9.5 9.5L12.5 12.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              value={componentSearch}
              onChange={(e) => setComponentSearch(e.target.value)}
              placeholder="Search components"
              aria-label="Search components"
              className="flex-1 min-w-0 bg-transparent text-ui text-fg-muted placeholder:text-fg-faint outline-none"
            />
            {componentSearch && (
              <button onClick={() => setComponentSearch('')} aria-label="Clear filter" className="text-fg-faint hover:text-fg-muted transition-colors w-4 h-4 flex items-center justify-center flex-shrink-0 text-xs">✕</button>
            )}
          </div>
        </div>
      ),
    }
    body = (
      <ComponentsView
        previewTheme={previewTheme}
        active={activeComponent}
        onSelect={selectComponent}
      />
    )
    // Constant, NOT keyed on the open component: the view owns its own article
    // remount, and re-keying here would rebuild the master list — losing its
    // scroll position — on every pick.
    centerKey = 'components'
  } else {
    // tab === 'docs'
    header = {
      Icon: RulesIcon,
      title: 'Docs',
      subtitle: 'MCP, Figma, release notes and answers for working with Escala.',
    }
    body = (
      <DocsView
        activeFoundationKey={docFoundationKey}
        onSelectFoundationKey={setDocFoundationKey}
        onEditFoundation={selectFoundation}
        allowReference={false}
        exits={{
          onOpenFigmaDownload: () => openExport('figma-download'),
          onOpenFigmaSync: () => openExport('figma-sync'),
          onOpenExport: openSectionExport,
          onOpenSave: () => openExport('save'),
          onOpenGithub: () => openExport('github'),
        }}
      />
    )
    // Constant, same reasoning as Components above.
    centerKey = 'docs'
  }

  // Preview is hidden in Components (the page goes full-width and carries its
  // own live playground) and in Docs (a full-width reference sheet) — and in
  // every export/connect view (Code · Docs · Figma · GitHub), which own the
  // full panel. Save keeps the aside: it hosts the Overview + Connections
  // panel.
  // Theme exploration is now the central canvas, so the old 400px companion
  // preview is retained only where it has a different job (Save connections)
  // — plus the Variables tab, see `showPreview` below `foundationCanvas`.

  // The section rail shows in every editing view and in none of the export /
  // connect views — those own the full width, in every section alike.
  const railVisible = projectCreated && !exportMode
  // Components alone uses the outer left rail. Docs is a set of focused pages
  // selected in its top-menu, so it intentionally uses the full reading width.
  const outerRailVisible = railVisible && tab === 'components'
  // Every Variables foundation paints a 198px Groups column (Color owns it
  // inside ColorHub; the rest wrap with FoundationWorkbench). It's not an
  // outer SectionRail, so `outerRailVisible` above stays false — but the
  // brand block's divider still needs to continue unbroken into that column.
  const themesCanvas = tab === 'foundations' && !exportMode
  const themeLibraryVisible = themesCanvas
  const groupsColumnVisible = themesCanvas && themeWorkspaceTab !== 'preview'
  // Color's Groups column can COLLAPSE on Primitives AND Semantics (Gradients
  // keeps its full width — its rail is the gradient list, whose rows are named
  // swatches with nothing glyph-sized to collapse to). Other foundations stay
  // at 198px. Read from `colorControls`' own exported constants rather than
  // repeating the numbers, since a mismatch here is exactly a broken line.
  const groupsColumnCollapsed = groupsColumnVisible && groupsRailCollapsed && colorTab !== 'gradients'

  // The global TopNav is mounted in EVERY view; this maps the current shell
  // state to its lit section.
  const navActive: TopNavKey | null =
    (!exportMode && tab === 'about') ? 'about'
    : (!exportMode && tab === 'components') ? 'components'
    : (!exportMode && tab === 'docs') ? 'docs'
    : (!exportMode && tab === 'foundations') ? 'variables'
    : null
  const handleNav = (key: TopNavKey) => {
    if (key === 'variables') {
      commitVisit()
      setExportMode(null)
      setTab('foundations')
      setThemeWorkspaceTab('preview')
    }
    else changeTab(key)
  }

  const foundationCanvas = themesCanvas && themeWorkspaceTab === 'primitives'
  // NOT extended to the Variables tab. The mockup's right-hand "VARIABLES
  // PREVIEW" column already exists — it is `VariablesPreviewPane`, the inline
  // aside every semantic table (Color, Type, Layout, Grid) renders as a sibling
  // of its own scroll region, header text and all. Adding a second, shell-level
  // aside beside it put the SAME specimen on screen twice and squeezed the
  // token table to ~238px between them (measured at 1266px). One preview.
  const showPreview = exportMode === 'save'
  const themeWorkspaceRailVisible = themesCanvas && themeWorkspaceTab === 'primitives'
  /** Foundation icon rail is Variables-only. Theme Preview and Get code both
   *  already name their destination in the tab strip; a 64px Color/Font/Radius
   *  switcher beside a CSS pane (or the artefact canvas) is leftover Variables
   *  chrome. Switching lives on Variables, and it always offers all nine. */
  // About gets its own hero instead of the dense-editor CenterHeader row —
  // same opt-out `foundationCanvas` already makes for a different reason.
  const skipCenterHeader = themesCanvas || tab === 'about'

  // A live System-Style try-on is a PREVIEW surface only — it holds no ramps in
  // the store, so the Variables editor (ColorPrimitives et al.) can't reflect
  // it and would keep showing the OPEN system's ramps under the tried-on
  // style's name (the reported "click Core, still see the old ramps" bug).
  // Leaving Theme Preview therefore DROPS the try-on, so the editing tabs show
  // the system they can actually edit.
  //
  // It used to MINT a theme here instead (`adoptPreset(…, { asCopy: true })`),
  // and that is what put a "Core Copy" row in My themes on a browser that had
  // never created anything: the rail seeds a Core try-on whenever the user owns
  // no theme, and About's "Start building" CTA lands on Variables — an editing
  // tab — so the seed was committed before the user touched a single control.
  // Committing is now only ever explicit ("Add to system") or a real edit (the
  // quick rail's first-control auto-adopt). Navigating is neither.
  useEffect(() => {
    if (!themesCanvas || themeWorkspaceTab === 'preview' || !stylePreview) return
    setStylePreview(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themesCanvas, themeWorkspaceTab, stylePreview])

  return (
    <div className="h-screen w-full overflow-hidden flex flex-col relative isolate bg-app">
      {/* Chrome tab geometry — mounted once, referenced by every `.color-hub-tab-bg`
          (Color/Type/Layout hub tabs, PreviewPanel's Preview/Artefacts/.MD). */}
      <ChromeTabDefs />
      {/* ── Layer 0: brand gradient ── */}
      <div aria-hidden className="absolute inset-0 -z-10" style={{ background: gradient }} />

      {/* ── Row 1: the global top bar — brand block + section nav + actions ── */}
      <TopNav
        nav={navActive}
        onNav={handleNav}
        exportAction={(
          <ExportPill
            onExport={openSectionExport}
            onSyncFigma={openFigmaSyncPage}
            onConnectGithub={openGithubPage}
            onExportCode={openGetCodePage}
            onConnectMcp={openMcpPage}
          />
        )}
        brandWidth={themeLibraryVisible ? THEME_LIBRARY_WIDTH : outerRailVisible ? (railCollapsed ? RAIL_COLLAPSED_WIDTH : RAIL_WIDTH) : null}
        // Drops the wordmark, leaving just the mark. Either narrow-brand-block
        // case has to set this, not only the Components rail: at 56px the
        // lockup overflows its own block by ~67px (measured) and the two lines
        // spill past the divider they're supposed to sit inside.
        railCollapsed={outerRailVisible && railCollapsed}
        chromeAppearance={theme}
        onChromeAppearanceChange={setTheme}
        onOpenDocsPage={(page) => {
          const docsPage = page === 'mcp'
            ? GUIDE_MCP_KEY
            : page === 'figma'
              ? GUIDE_FIGMA_KEY
              : page === 'changelog'
                ? CHANGELOG_KEY
                : FAQ_KEY
          openDocs(docsPage)
        }}
      />

      <div className="flex-1 min-h-0 flex">
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
      {/* ── Body: section sub-rail + floating white panel ── */}
      <div className="flex-1 min-h-0 flex">
        {/* Components' rail — component categories only, now that Docs owns
            its own page and no longer shares this column (see DocsView). Its
            entries come straight from `CATEGORIES`, so the rail can never
            offer a category the catalogue doesn't have.
            Variables reserves no outer column at all — switching lives in the
            horizontal FoundationIconRail docked in its header, freeing this
            width for a foundation's own sub-nav (Color's family Groups tree,
            promoted inside ColorPrimitives). */}
        {railVisible && tab === 'components' && (
          <ComponentsRail
            icons={CATEGORY_ICONS}
            active={activeComponent}
            onSelect={selectComponent}
            search={componentSearch}
            collapsed={railCollapsed}
            onToggleCollapse={() => setRailCollapsed((v) => !v)}
          />
        )}
        {themeLibraryVisible && (
          <ThemeLibraryRail
            previewTheme={previewTheme}
            onPreviewThemeChange={changePreviewTheme}
            onStylePreview={setStylePreview}
            activeStylePreview={stylePreview}
            onSyncFigma={syncFigmaForTheme}
            onOpenInCode={openCodeForTheme}
            syncFooter={themeWorkspaceSyncFooter}
          />
        )}

        {/* ── Layer 1: the content surface, flush under the top bar ──
            Variables' Groups column IS the outer rail (under the logo), so
            this wrapper stays transparent there. Components / Docs / export
            views paint `bg-app` and the hairline from the first column. */}
        <div className={`flex-1 min-w-0 flex ${themesCanvas ? 'flex-col' : ''} overflow-hidden ${themeLibraryVisible || !foundationCanvas ? 'bg-app border-l border-line' : ''}`}>
          {/* On the Themes workspace the tab strip is a FULL-WIDTH row above the
              icon rail + editor. GitHub and Figma sync live in ThemeLibraryRail. */}
          {themesCanvas && (
            <ThemeWorkspaceTabs
              value={themeWorkspaceTab}
              onChange={changeThemeWorkspaceTab}
              search={tokenSearchField}
            />
          )}
          <div className={themesCanvas ? 'flex-1 min-h-0 flex overflow-hidden' : 'contents'}>
          {themeWorkspaceRailVisible && (
            // Variables only — which token TABLE the centre column shows.
            // Theme Preview and Get code do not mount this rail: the tab strip
            // already names those destinations, and a Color/Font/Radius column
            // beside a CSS pane (or the artefact canvas) is leftover chrome.
            <FoundationIconRail
              orientation="vertical"
              active={activeFoundation}
              onSelect={selectWorkspaceFoundation}
              groups={[
                { label: t('Variables'), items: VARIABLE_FOUNDATIONS.map((foundation) => ({ key: foundation.key, label: t(foundation.short), Icon: foundation.Icon })) },
                { label: t('Styles'), items: FOUNDATIONS.filter((foundation) => !VARIABLE_FOUNDATIONS.includes(foundation)).map((foundation) => ({ key: foundation.key, label: t(foundation.short), Icon: foundation.Icon })) },
              ].filter((group) => group.items.length > 0)}
            />
          )}
          {/* Center editor */}
          <main className="flex-1 min-w-0 flex flex-col">
            {/* No CenterHeader on the Themes canvas — the icons ARE the section
                title, and the tab strip above owns the header row. */}
            {!skipCenterHeader && (
              <CenterHeader
                Icon={header.Icon}
                title={header.title}
                subtitle={header.subtitle}
                // Same derivation as --accent-ui, not a second copy of it: this
                // title WAS the raw anchor tone, the most visible 3:1 failure.
                accentColor={uiAccent}
                right={header.right}
              />
            )}
            <div className="flex-1 min-h-0">
              {/* No `exit` animation and no AnimatePresence: the header (above)
                  and this body both derive from `activeFoundation` in the same
                  render, so they must swap in the same commit. An exit-then-enter
                  sequence (mode="wait") would hold the OLD body on screen under the
                  NEW header for the fade-out duration — a title/content mismatch.
                  Opacity only — a y-nudge on the whole canvas made Groups and
                  the icon rail jump even after they were the same layout. */}
              {themesCanvas && themeWorkspaceTab === 'preview' ? (
                <motion.div
                  key="theme-preview"
                  className="h-full"
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                >
                  <ThemePreviewHub
                    surface={themeHubSurface}
                    onSurfaceChange={setThemeHubSurface}
                    previewTheme={previewTheme}
                    previewAppearance={previewAppearance}
                    stylePreview={stylePreview}
                    onAdoptStyle={changePreviewTheme}
                    onSelectTheme={changePreviewTheme}
                    onPreviewAppearanceChange={changePreviewAppearance}
                    onOpenComponent={selectComponent}
                    onOpenComponents={() => changeTab('components')}
                    onEditFoundation={selectFoundation}
                    onOpenPrimitiveFamily={openPrimitiveFamily}
                    onOpenInVariables={openTokenInVariables}
                    figmaPublishState={figmaPublishState}
                    workspaceSection={workspaceSection}
                    onRequestFigmaSync={publishFigmaNow}
                    onOpenFigmaDownload={() => openExport('figma-download')}
                    figmaFileName={figmaFileName}
                    onFigmaFileNameChange={(name) => {
                      setFigmaFileNameDirty(true)
                      setFigmaFileName(name)
                    }}
                    figmaSyncModes={figmaSyncModes}
                    onFigmaSyncModesChange={setFigmaSyncModes}
                    githubPushState={githubPushState}
                    onGithubPushStateChange={handleGithubPushState}
                    docsExits={{
                      onOpenFigmaDownload: () => openExport('figma-download'),
                      onOpenFigmaSync: () => setThemeHubSurface('figma'),
                      onOpenExport: openSectionExport,
                      onOpenSave: () => openExport('save'),
                      onOpenGithub: () => setThemeHubSurface('github'),
                    }}
                  />
                </motion.div>
              ) : themesCanvas && themeWorkspaceTab === 'code' ? (
                <motion.div
                  key="theme-code-format"
                  className="h-full"
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                >
                  <ThemeCodeFormat
                    previewTheme={previewTheme}
                    scope={codeScope}
                    onScopeChange={(next) => {
                      setCodeScope(next)
                      if (next) changePreviewTheme(next)
                    }}
                    onPreviewThemeChange={changePreviewTheme}
                    onOpenThemeLibrary={openThemeLibraryFromCode}
                  />
                </motion.div>
              ) : foundationCanvas ? (
                <FoundationWorkbench
                  railCollapsed={groupsColumnCollapsed}
                  onToggleRail={
                    colorTab !== 'gradients'
                      ? () => setGroupsRailCollapsed((collapsed) => !collapsed)
                      : undefined
                  }
                  label={section.variablesLabel}
                  gutter={activeFoundation === 'icons'}
                  activeCollection={activeCollection}
                  collections={activeFoundationCollections}
                  onCollectionChange={(collection) => setFoundationCollection(activeFoundation, collection)}
                >
                  <motion.div
                    key={centerKey}
                    className="h-full"
                    initial={reduceMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  >
                    {body}
                  </motion.div>
                </FoundationWorkbench>
              ) : (
                <motion.div
                  key={centerKey}
                  className="h-full"
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                >
                  {body}
                </motion.div>
              )}
            </div>
          </main>
          </div>

          {/* Right live preview (hidden in components tab — full width for docs)

              The threshold is an EXPLICIT `min-[1180px]:`, not `xl:`. Tailwind's
              breakpoints are rem-based and `:root` sets `font: 18px/…`, so `xl`
              resolves to 80rem = **1440px** here, not the 1280 the utility name
              implies. That hid the panel on every window below 1440 — including a
              16" MacBook Pro on any scaled resolution under 1512, or full-screen
              with the window not maximised — and the live specimen is half the
              point of the workspace, not a wide-screen bonus.
              1180 is MEASURED, not guessed: with the full 400px aside, nothing
              inside `main` overflows down to that width (the Primitives table
              still shows both light and dark columns, and every railed section
              keeps its 198px gutter). Below it the token tables start clipping,
              so that's where the panel genuinely has to go. The collage's own
              floor is 380px (at 360 its tiles overflow), which is why the aside
              keeps ONE width instead of shrinking — there is no useful range
              between 380 and 400 to trade the center 20px for. */}
          {showPreview && (previewCollapsed ? (
            <button
              onClick={() => setPreviewCollapsed(false)}
              aria-label="Expand preview"
              title="Expand preview"
              className="hidden min-[1180px]:flex w-8 flex-shrink-0 items-center justify-center border-l border-line bg-app hover:bg-elevated/50 text-fg-faint hover:text-fg transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>
          ) : (
            <aside className="hidden min-[1180px]:flex w-[400px] flex-shrink-0 overflow-hidden border-l border-line">
              {exportMode === 'save' ? (
                // Save pairs the share/identity center with the system overview.
                <SaveSidePanel
                  onOpenFigma={() => openExport('figma-sync')}
                  onOpenGithub={() => openExport('github')}
                  onCollapse={() => setPreviewCollapsed(true)}
                />
              ) : (
                <PreviewPanel
                  focus={!exportMode && tab === 'foundations' && activeFoundation === 'color' && colorTab === 'semantics' ? semanticFocus : null}
                  typeFocus={!exportMode && tab === 'foundations' && activeFoundation === 'typography' && activeCollection === 'semantics' ? typeFocus : null}
                  categoryKey={!exportMode && tab === 'foundations' ? activeFoundation : null}
                  mdWholeSystem={
                    !exportMode && tab === 'foundations' && activeFoundation === 'color' && colorTab !== 'semantics'
                  }
                  previewTheme={previewTheme}
                  previewAppearance={previewAppearance}
                  iconLibraryKey={!exportMode && tab === 'foundations' && activeFoundation === 'icons' ? iconLibrary : null}
                  onCollapse={() => setPreviewCollapsed(true)}
                  onEditTypeRole={(key) => {
                    setFoundationCollection('typography', 'semantics')
                    setTypeReveal((prev) => ({ key, seq: (prev?.seq ?? 0) + 1 }))
                  }}
                  onEditLayoutRole={(key) => {
                    setLayoutReveal((prev) => ({ key, seq: (prev?.seq ?? 0) + 1 }))
                  }}
                  onEditColorToken={(key) => {
                    setFoundationCollection('color', 'semantics')
                    setColorReveal((prev) => ({ key, seq: (prev?.seq ?? 0) + 1, as: 'token' }))
                  }}
                  onEditColorGroup={(key) => {
                    setFoundationCollection('color', 'semantics')
                    setColorReveal((prev) => ({ key, seq: (prev?.seq ?? 0) + 1, as: 'group' }))
                  }}
                />
              )}
            </aside>
          ))}
        </div>
      </div>
      </div>
      </div>

      {/* ── Row 3: the footer hairline ──
          The shell is a fixed-viewport app (h-screen, no page scroll), so there
          is no "bottom of the page" for a conventional footer to sit at. This is
          a 28px rule instead — copyright plus Source / MIT License colophon
          links. The About TAB already carries the full story (how it works,
          changelog, legal). `bg-nav` keeps this
          strip on `--nav` with TopNav and the Themes library — the shell
          frame. `--tab-bar` is the workspace level; `--app` is the page. */}
      <footer className={`flex-shrink-0 h-7 flex items-center gap-3 px-4 lg:px-5 border-t border-line ${SHELL_CHROME}`}>
        <span className="min-w-0 flex-1 text-mini text-fg-faint truncate">
          {COPYRIGHT_LINE}
        </span>
        {/* The project's own source. It used to be an icon button in TopNav's
            global cluster, next to Language and Appearance — but those change
            the session and this leaves the app, and its GitHub mark collided
            with the user's OWN repo-sync mark two rows down. Here it reads as
            what it is: a colophon link, on the attribution line, in the
            attribution's own type size. Text + mark rather than a bare glyph —
            there's no 24px target pressure on a 28px rule, and the word is what
            makes it unambiguous next to a copyright notice. */}
        <div className="flex h-full flex-shrink-0 items-center gap-2">
        <a
          href="https://github.com/Duscenko/escala-tokens"
          target="_blank"
          rel="noreferrer"
          aria-label="Open the Escala Tokens source on GitHub"
          title="Open the Escala Tokens source on GitHub"
          // `text-fg-muted`, not the `text-fg-faint` the copyright line uses:
          // this is the one INTERACTIVE thing in the footer, and faint measured
          // 4.39:1 at 10.5px — under AA for small text. The static line beside
          // it can sit quieter; a link people have to find cannot.
          // `h-full` claims the whole 28px strip as the hit area (WCAG 2.2
          // target size) without the mark or the type growing.
          className="flex h-full flex-shrink-0 items-center gap-1.5 rounded px-0.5 text-mini text-fg-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-ui/50"
        >
          <span
            aria-hidden
            className="h-3 w-3 bg-current"
            style={{
              WebkitMask: "url('/ide-logos/github-outline.svg') center / contain no-repeat",
              mask: "url('/ide-logos/github-outline.svg') center / contain no-repeat",
            }}
          />
          <span className="hidden sm:inline">Source</span>
        </a>
        <a
          href="https://github.com/Duscenko/escala-tokens/blob/main/LICENSE"
          target="_blank"
          rel="noreferrer"
          aria-label="Read the MIT License"
          title="Read the MIT License"
          className="flex h-full flex-shrink-0 items-center rounded px-0.5 text-mini text-fg-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-ui/50"
        >
          <span className="hidden sm:inline">MIT License</span>
          <span className="sm:hidden">MIT</span>
        </a>
        </div>
      </footer>

      {/* Guided export — Source → Format → Export. TRANSVERSAL: reachable from
          TopNav regardless of `tab`/`exportMode`, so this modal overlay (its
          own fixed backdrop) isn't gated to Variables. It ALWAYS opens with
          every foundation checked — pre-scoping it to the section on screen
          silently under-shipped anyone who hit Next without reading the
          checklist (the same reason the `['primitives','semantics']` partial
          default was retired). The one narrowing that stays is `initialModes`:
          "Export theme" from Theme Preview ships just that theme. */}
      <AnimatePresence>
        {sectionExportOpen && (
          <ExportWizard
            key={exportRun}
            initialModes={themeExportScope ? [themeExportScope] : undefined}
            activeTheme={previewTheme}
            themeScope={themeExportScope}
            themeScopeLabel={themeExportScope ? (store.themeLabels[themeExportScope] || themeExportScope) : undefined}
            onClose={() => { setSectionExportOpen(false); setThemeExportScope(null) }}
            onConnectGithub={() => { setSectionExportOpen(false); openExport('github') }}
            onAddSyncOption={() => { setSectionExportOpen(false); setThemeExportScope(null); openFigmaSyncDetails() }}
          />
        )}
      </AnimatePresence>

      {/* Import-your-design-system window */}
      <AnimatePresence>
        {importOpen && (
          <ImportSystemModal
            onClose={() => setImportOpen(false)}
            onImported={() => {
              setImportOpen(false)
              // Land on Variables · Color so the tables render the freshly imported system.
              setExportMode(null)
              setTab('foundations')
              setActiveFoundation('color')
            }}
          />
        )}
      </AnimatePresence>


      {/* New-design-system window — name + accent, then straight into Foundations */}
      <AnimatePresence>
        {newSystemOpen && (
          <NewSystemModal
            onClose={() => setNewSystemOpen(false)}
            onCreated={() => {
              setNewSystemOpen(false)
              // Land on Foundations · Color so the guided flow continues into tokens.
              setExportMode(null)
              setTab('foundations')
              setActiveFoundation('color')
              setFoundationCollection('color', 'primitives')
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
