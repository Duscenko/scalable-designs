import { type ReactNode } from 'react'
import { useDesignStore } from '../../store/useDesignStore'
import { getStoredToken, type GitHubPushState } from '../../lib/github'
import { syncProjectId, type FigmaPublishState } from '../../lib/figmaSync'
import { FIGMA_SYNC_MODE_CAP } from '../../lib/figmaSyncModes'
import { GitHubGlyph } from '../ui/icons'
import { FigmaLogo, PluginInstallPromo, relativeTime } from './figmaShared'
import { PLUGIN_BUILD, PLUGIN_VERSION } from '../../lib/pluginVersion'
import { QUICK_RAIL_STACK_GAP, QUICK_SETTINGS_WIDTH, RailCard, ThemeRailScrollRegion } from './ThemeQuickSettingsRail'
import { THEME_BAND_H } from './colorControls'
import { WORKSPACE_CHROME } from './themeWorkspaceLayout'

type IntegrationProvider = 'github' | 'figma'

function StatusDot({ active, busy, error }: { active: boolean; busy?: boolean; error?: boolean }) {
  const color = error ? 'bg-status-danger-solid' : busy ? 'bg-status-warning-solid' : active ? 'bg-status-success-solid' : 'bg-fg-faint'
  return <span aria-hidden className={`h-2 w-2 flex-shrink-0 rounded-full ${color} ${busy ? 'animate-pulse' : ''}`} />
}

// `dot` is only ever passed to the STATUS row — the one row whose value is a
// live state rather than a stored fact. It used to live in a provider header
// above this list, which meant the column stated its identity twice (band +
// header) and the dot annotated the provider name instead of the state it
// actually reports.
function StatusRow({
  label, value, mono = false, dot, onClick,
}: {
  label: string
  value: string
  mono?: boolean
  dot?: ReactNode
  onClick?: () => void
}) {
  const valueClass = `min-w-0 break-words text-right ${mono ? 'font-mono' : ''}`
  return (
    <div className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] items-start gap-2 px-3 py-2">
      <dt className="text-caption text-fg-faint">{label}</dt>
      <dd className="flex min-w-0 items-center justify-end gap-1.5 text-caption leading-relaxed text-fg-muted">
        {dot}
        {onClick ? (
          <button
            type="button"
            onClick={onClick}
            className={`${valueClass} rounded-sm transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/40 ${
              value === 'Connect' ? 'underline decoration-fg-faint underline-offset-2 hover:decoration-fg' : ''
            }`}
          >
            {value}
          </button>
        ) : (
          <span className={valueClass}>{value}</span>
        )}
      </dd>
    </div>
  )
}

function stateLabel(state: GitHubPushState | FigmaPublishState) {
  if (state === 'pushing') return 'Pushing…'
  if (state === 'publishing') return 'Publishing…'
  if (state === 'done') return 'Complete'
  if (state === 'error') return 'Needs attention'
  return 'Idle'
}

export default function IntegrationStatusRail({
  provider,
  githubPushState,
  figmaPublishState,
  onOpenPluginDownload,
  onOpenGithub,
  workspaceSection,
  fileName,
  modeCount,
}: {
  provider: IntegrationProvider
  githubPushState: GitHubPushState
  figmaPublishState: FigmaPublishState
  /** Theme Preview hub — plugin install lives in this rail, not the sync card. */
  onOpenPluginDownload?: () => void
  /** Opens the GitHub surface — the Figma card no longer hosts this door. */
  onOpenGithub?: () => void
  /** Handshake facts from the Sync card — Protocol names the same IDs. */
  workspaceSection?: string
  fileName?: string
  modeCount?: number
}) {
  const { githubRepo, githubLastPushAt, figmaLastPublishAt, autoSyncFigma, pluginBuildSeen } = useDesignStore()
  const pluginUpdateAvailable = pluginBuildSeen != null && pluginBuildSeen !== PLUGIN_BUILD
  const githubCredentialSaved = Boolean(getStoredToken())
  const isGithub = provider === 'github'
  const connected = isGithub ? githubCredentialSaved : Boolean(figmaLastPublishAt)
  const busy = isGithub ? githubPushState === 'pushing' : figmaPublishState === 'publishing'
  const error = isGithub ? githubPushState === 'error' : figmaPublishState === 'error'
  // The header's own expression, moved onto the status ROW: in-flight and
  // failed states outrank "connected", which is only a resting fact.
  const statusValue = error
    ? 'Needs attention'
    : busy
      ? stateLabel(isGithub ? githubPushState : figmaPublishState)
      : connected ? 'Connected' : 'Not connected'
  const githubConnected = Boolean(githubRepo || githubCredentialSaved)
  const githubStatusValue = githubPushState === 'error'
    ? 'Needs attention'
    : githubPushState === 'pushing'
      ? 'Pushing…'
      : githubRepo
        ? 'Connected'
        : githubCredentialSaved
          ? 'Signed in'
          : 'Not connected'

  return (
    <aside
      aria-label={`${isGithub ? 'GitHub' : 'Figma'} integration status`}
      className={`flex h-full flex-shrink-0 flex-col overflow-hidden border-r border-line ${WORKSPACE_CHROME}`}
      style={{ width: QUICK_SETTINGS_WIDTH }}
    >
      {/* Provider band. `THEME_BAND_H` + `border-b` because it sits on the SAME
          row as `IntegrationContextBar`'s breadcrumb in the column beside it —
          without the border the divider started at the rail's right edge and
          the two top rows read as different heights. It names the PROVIDER,
          not the previewed theme: a theme name is meaningless on an
          integration screen, which is why `ThemeIdentityBand` isn't used here. */}
      <div
        className="flex flex-shrink-0 items-center gap-2.5 border-b border-line px-4"
        style={{ height: THEME_BAND_H }}
      >
        <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg border border-line bg-surface text-fg">
          {isGithub ? <GitHubGlyph size={14} /> : <FigmaLogo size={16} />}
        </span>
        <span className="min-w-0 truncate text-ui font-semibold text-fg">{isGithub ? 'GitHub' : 'Figma'}</span>
      </div>
      <ThemeRailScrollRegion padClass="px-3 py-3">
        <div className={`flex flex-col ${QUICK_RAIL_STACK_GAP}`}>
        <RailCard title="Connection">
          <dl className="divide-y divide-line">
            {isGithub ? (
              <>
                <StatusRow label="Push status" value={statusValue} dot={<StatusDot active={connected} busy={busy} error={error} />} />
                <StatusRow label="Latest push" value={relativeTime(githubLastPushAt)} />
                <StatusRow label="Repository" value={githubRepo ?? 'Not selected'} mono={Boolean(githubRepo)} />
                <StatusRow label="Account" value={githubCredentialSaved ? 'Credentials saved' : 'Not connected'} />
              </>
            ) : (
              <>
                <StatusRow label="Sync status" value={statusValue} dot={<StatusDot active={connected} busy={busy} error={error} />} />
                <StatusRow label="Published" value={relativeTime(figmaLastPublishAt)} />
                <StatusRow label="ID to plugin" value={`/api/tokens · ${syncProjectId(fileName)}`} mono />
                <StatusRow label="Auto sync" value={autoSyncFigma ? 'On' : 'Off'} />
                <StatusRow
                  label="GitHub"
                  value={
                    githubPushState === 'error' || githubPushState === 'pushing'
                      ? githubStatusValue
                      : githubRepo
                        ? 'Connected'
                        : onOpenGithub
                          ? 'Connect'
                          : githubStatusValue
                  }
                  onClick={onOpenGithub}
                  dot={
                    <StatusDot
                      active={githubConnected}
                      busy={githubPushState === 'pushing'}
                      error={githubPushState === 'error'}
                    />
                  }
                />
              </>
            )}
          </dl>
        </RailCard>

        <RailCard title="Protocol">
          {isGithub ? (
            <>
              <dl className="divide-y divide-line">
                <StatusRow label="Snapshot" value={githubRepo ? '.escala/system.json' : 'On first push'} mono />
                <StatusRow label="Visibility" value="Private recommended" />
                <StatusRow label="Backup" value={githubRepo ? 'Repository linked' : 'Not configured'} />
              </dl>
              <p className="px-3 pb-2.5 pt-2 text-mini leading-relaxed text-fg-muted">Pushes tokens, CSS, documentation, and the recoverable editor snapshot.</p>
            </>
          ) : (
            <>
              <dl className="divide-y divide-line">
                <StatusRow label="This page" value={workspaceSection || 'This window'} mono={Boolean(workspaceSection)} />
                <StatusRow label="File" value={fileName?.trim() || 'Untitled'} />
                <StatusRow
                  label="Modes"
                  value={`${modeCount ?? 0} of ${FIGMA_SYNC_MODE_CAP}`}
                />
                <StatusRow label="Backup" value={githubRepo ? githubRepo : 'No repository'} mono={Boolean(githubRepo)} />
              </dl>
              {onOpenPluginDownload ? (
                // Inside the card now, so it takes the card's own gutter — it
                // used to sit full-bleed in the scroll region, which reads as
                // misaligned against rows inset 14px above it.
                <div className="px-3 pb-2.5 pt-2">
                <PluginInstallPromo
                  layout="stacked"
                  version={PLUGIN_VERSION}
                  updateAvailable={pluginUpdateAvailable}
                  onOpenInstall={onOpenPluginDownload}
                  info="Paste ID to plugin in Live Sync — that is the key. This page holds the themes in this window. File and modes travel in the published payload."
                />
                </div>
              ) : null}
            </>
          )}
        </RailCard>
        </div>
      </ThemeRailScrollRegion>
    </aside>
  )
}
