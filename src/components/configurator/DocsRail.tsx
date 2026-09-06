import type { ComponentType } from 'react'
import { useI18n } from '../../lib/i18n'
import { RAIL_COLLAPSED_WIDTH, RAIL_WIDTH } from './SectionRail'
import { SHELL_CHROME } from './themeWorkspaceLayout'

const RAIL_ROW_ACTIVE = 'border-line-strong bg-app text-fg font-semibold shadow-[0_2px_12px_-6px_rgba(0,0,0,0.24)]'
const RAIL_ROW_IDLE = 'border-transparent text-fg-muted hover:bg-elevated hover:text-fg'

function SidebarToggleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <line x1="9.5" y1="4" x2="9.5" y2="20" />
    </svg>
  )
}

export interface DocsRailRow {
  key: string
  label: string
  Icon?: ComponentType
  /** Section label drawn above this row when the rail is expanded. Only set
   *  it on the first row of a group. */
  heading?: string
}

/** Docs' left rail — same shell as ComponentsRail (`bg-tab-bar` workspace
 *  chrome, h-[52px] header band, collapse toggle, RAIL_WIDTH). */
export default function DocsRail({
  rows,
  activeKey,
  onSelect,
  collapsed,
  onToggleCollapse,
}: {
  rows: DocsRailRow[]
  activeKey: string
  onSelect: (key: string) => void
  collapsed: boolean
  onToggleCollapse: () => void
}) {
  const { t } = useI18n()
  return (
    <div
      style={{ width: collapsed ? RAIL_COLLAPSED_WIDTH : RAIL_WIDTH }}
      className={`flex-shrink-0 flex flex-col min-h-0 transition-[width] duration-200 ${SHELL_CHROME}`}
    >
      <div
        className={`flex items-center h-[52px] flex-shrink-0 border-b border-line ${
          collapsed ? 'justify-center px-0' : 'justify-between pl-3 pr-2'
        }`}
      >
        {!collapsed && <span className="text-ui font-semibold text-fg truncate">{t('Docs')}</span>}
        <button
          onClick={onToggleCollapse}
          aria-label={t(collapsed ? 'Expand sidebar' : 'Collapse sidebar')}
          aria-expanded={!collapsed}
          title={t(collapsed ? 'Expand sidebar' : 'Collapse sidebar')}
          className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg text-fg-faint hover:text-fg hover:bg-elevated/40 transition-colors"
        >
          <SidebarToggleIcon />
        </button>
      </div>

      <nav aria-label={t('Docs')} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2 pt-2 pb-3 flex flex-col gap-0.5">
        {rows.map(({ key, label, Icon, heading }, i) => {
          const on = activeKey === key
          return (
            <div key={key} className="flex flex-col gap-0.5">
              {heading && !collapsed && (
                <span className={`px-2.5 pb-1 text-mini font-semibold uppercase tracking-widest text-fg-faint ${i === 0 ? 'pt-1' : 'pt-3'}`}>
                  {heading}
                </span>
              )}
              <button
                onClick={() => onSelect(key)}
                aria-current={on ? 'page' : undefined}
                title={label}
                className={`flex items-center h-9 rounded-xl border text-ui text-left transition-colors ${
                  collapsed ? 'w-9 mx-auto justify-center' : 'w-full gap-2 px-2.5'
                } ${
                  on ? RAIL_ROW_ACTIVE : RAIL_ROW_IDLE
                }`}
              >
                {Icon ? (
                  <span className={`flex-shrink-0 ${on ? '' : 'text-fg-faint'}`}>
                    <Icon />
                  </span>
                ) : null}
                {!collapsed && <span className="truncate">{label}</span>}
              </button>
            </div>
          )
        })}
      </nav>
    </div>
  )
}
