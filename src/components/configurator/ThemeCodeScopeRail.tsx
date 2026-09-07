import { useDesignStore } from '../../store/useDesignStore'
import { themeBrandRamp, themeDisplayName } from '../../lib/themeSources'
import { BASE_TONE } from '../../lib/colorUtils'
import { useI18n } from '../../lib/i18n'
import { COLOR_RAIL_WIDTH } from './colorControls'
import { WORKSPACE_CHROME } from './themeWorkspaceLayout'
import { myThemeKeys } from './ThemeLibraryRail'

export type CodeThemeScope = string

/** One My-theme key, or '' when the library is empty. Get code never
 *  ships an All-themes file — foundations and behaviour stay exact. */
export function resolveCodeTheme(listed: string[], scope: string, previewTheme: string): string {
  if (listed.includes(scope)) return scope
  if (listed.includes(previewTheme)) return previewTheme
  return listed[0] ?? ''
}

function RadioMark({ selected }: { selected: boolean }) {
  return (
    <span
      className={`grid h-4 w-4 flex-shrink-0 place-items-center rounded-full border-2 ${
        selected ? 'border-accent-ui' : 'border-line-strong'
      }`}
      aria-hidden
    >
      {selected ? <span className="h-1.5 w-1.5 rounded-full bg-accent-ui" /> : null}
    </span>
  )
}

function ThemeSwatch({ hex }: { hex: string }) {
  return (
    <span
      className="h-3.5 w-3.5 flex-shrink-0 rounded-full ring-1 ring-inset ring-black/10 dark:ring-white/15"
      style={{ background: hex }}
      aria-hidden
    />
  )
}

function ArrowIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4.5 2.5 8 6l-3.5 3.5" />
    </svg>
  )
}

/**
 * Get code's left column — which ONE theme the CSS / Markdown / Agent
 * context file is scoped to. Radio only, no All themes: a mixed file
 * would blur foundations and behaviour. Lists My themes (`themeOrder`
 * minus the built-in light/dark scaffolding), the same identity as the
 * Themes library. Width is the workspace's 240px groups column
 * (`COLOR_RAIL_WIDTH`), not a fourth number.
 */
export default function ThemeCodeScopeRail({
  scope,
  previewTheme,
  onScopeChange,
  onPreviewThemeChange,
  onOpenThemeLibrary,
}: {
  scope: CodeThemeScope
  previewTheme: string
  onScopeChange: (scope: CodeThemeScope) => void
  onPreviewThemeChange: (theme: string) => void
  onOpenThemeLibrary: () => void
}) {
  const { t } = useI18n()
  const store = useDesignStore()
  const { themeOrder, themes, themeKinds, themeLabels, themeSources } = store
  const listed = myThemeKeys(themeOrder, themes)
  const selected = resolveCodeTheme(listed, scope, previewTheme)

  const selectTheme = (key: string) => {
    onScopeChange(key)
    if (key !== previewTheme) onPreviewThemeChange(key)
  }

  return (
    <aside
      className={`flex h-full min-h-0 flex-shrink-0 flex-col border-r border-line ${WORKSPACE_CHROME}`}
      style={{ width: COLOR_RAIL_WIDTH }}
      aria-label={t('Themes')}
    >
      <div className="flex h-[52px] flex-shrink-0 items-center justify-between gap-2 border-b border-line pl-4 pr-3">
        <h2 className="min-w-0 truncate text-caption font-semibold text-fg-muted">{t('Themes')}</h2>
        <button
          type="button"
          onClick={onOpenThemeLibrary}
          aria-label={t('Themes library')}
          title={t('Themes library')}
          className="inline-flex flex-shrink-0 items-center gap-0.5 text-mini font-medium text-fg-faint transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ui/50"
        >
          {t('Themes library')}
          <ArrowIcon />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 py-2" role="radiogroup" aria-label={t('Themes')}>
        {listed.length === 0 ? (
          <p className="px-2 py-3 text-caption text-fg-faint">{t('Add a theme to get its code.')}</p>
        ) : listed.map((key) => {
          const isSelected = selected === key
          const ramp = themeBrandRamp(key, themeSources, themeKinds, store)
          const swatch = ramp?.[BASE_TONE] ?? store.primaryColor
          const name = themeDisplayName(key, themeLabels)
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => selectTheme(key)}
              className={`flex min-w-0 w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ui/50 ${
                isSelected ? 'bg-app text-fg shadow-sm' : 'text-fg-muted hover:bg-elevated hover:text-fg'
              }`}
            >
              <RadioMark selected={isSelected} />
              <ThemeSwatch hex={swatch} />
              <span className={`min-w-0 flex-1 truncate text-body ${isSelected ? 'font-semibold text-fg' : 'font-medium'}`}>
                {name}
              </span>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
