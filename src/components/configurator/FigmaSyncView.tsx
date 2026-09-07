import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { useI18n } from '../../lib/i18n'
import { useDesignStore } from '../../store/useDesignStore'
import { isLiveEnvironment, publishOrigin, syncProjectId, syncUrl as buildSyncUrl, type FigmaPublishState } from '../../lib/figmaSync'
import { buildWorkspaceAppUrl } from '../../lib/workspaceLink'
import { BASE_TONE } from '../../lib/colorUtils'
import { figmaSyncThemeKeys } from '../../lib/themeLibrary'
import { themeBrandRamp, themeDisplayName } from '../../lib/themeSources'
import {
  FIGMA_SYNC_MODE_CAP,
  hasFigmaSyncMode,
  toggleFigmaSyncAppearance,
  toggleFigmaSyncTheme,
  type FigmaSyncMode,
} from '../../lib/figmaSyncModes'
import { BackToEditor, PluginInstallPromo } from './figmaShared'
import { AppearanceGlyph } from './colorControls'
import { CopyGlyph } from '../ui/icons'
import { PLUGIN_BUILD, PLUGIN_VERSION } from '../../lib/pluginVersion'

interface FigmaSyncViewProps {
  onClose?: () => void
  embedded?: boolean
  /** Cross-link to the sibling destination — see FigmaDownloadView's own note. */
  onOpenDownload?: () => void
  /** Shared manual-publish feedback from Configurator, so this screen and the
   *  persistent header always report the same request. */
  publishState: FigmaPublishState
  /** Specific reason for the current 'error' state (a lost claim vs. a network
   *  hiccup) — same string the Sync pill's tooltip shows. Null outside 'error'. */
  publishError?: string | null
  onRequestSync: () => void
  /** Theme the canvas is previewing — selecting a sync row also previews it. */
  previewTheme: string
  onSelectTheme: (key: string) => void
  /** Figma file name and `/api/tokens?project=` slug (`slugify` of this).
   *  Defaults to the first theme. Does not rename the editor project. */
  fileName: string
  onFileNameChange: (name: string) => void
  /** Selected Figma columns — theme × Light/Dark, max 3. */
  syncModes: FigmaSyncMode[]
  onSyncModesChange: (modes: FigmaSyncMode[]) => void
  /** Workspace section id for this window (`workspaceLink.ts`). Drives the
   *  auto-updating This page link. ID to plugin is `?project=<file slug>`. */
  section?: string
}

/** Theme radios, the sync URL field, and Sync now — one height, one radius. */
/** Whether the ID currently resolves to a published payload. Deliberately a
 *  dot + one word, next to the label rather than in the field: it annotates the
 *  ID, and the field itself is what gets copied. `unknown` renders nothing —
 *  a probe that could not run must not claim either answer. */
function PublishStateBadge({ state }: { state: 'unknown' | 'live' | 'missing' }) {
  const { t } = useI18n()
  if (state === 'unknown') return null
  const live = state === 'live'
  return (
    <span
      className={`inline-flex items-center gap-1 text-mini font-semibold uppercase tracking-[0.12em] ${live ? 'text-status-success' : 'text-status-warning'}`}
      title={live
        ? t('The plugin can fetch this ID right now.')
        : t('Nothing published under this ID yet — the plugin would answer 404.')}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-status-success-solid' : 'bg-status-warning-solid'}`} />
      {live ? t('Live') : t('Not published')}
    </span>
  )
}

const SYNC_CONTROL = 'h-10 rounded-lg'
/** Chrome-page ink, not `--accent-ui`. Accent here tracks the previewed
 *  theme, so a gold Core row would paint the URL and the selected radio
 *  gold — this surface is chrome, not a specimen. */
const SYNC_FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/40'

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden
      className={`flex-shrink-0 transition-transform duration-200 ease-out ${open ? 'rotate-90' : ''}`}
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

/** Progressive disclosure for the cases Sync now cannot finish in Figma.
 *  Closed by default — the success banner already names Update now. */
function SyncStuckHelp() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const panelId = useId()

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((next) => !next)}
        className={`inline-flex items-center gap-1.5 rounded-md text-caption text-fg-muted transition-colors hover:text-fg ${SYNC_FOCUS}`}
      >
        <Chevron open={open} />
        {t('No sync yet? Help')}
      </button>
      {open ? (
        <ol id={panelId} className="mt-2 list-decimal space-y-2 pl-5 text-caption leading-relaxed text-fg-muted">
          <li>{t('Open the Escala plugin in Figma. In Live Sync, paste ID to plugin and click Update now.')}</li>
          <li>{t('A hand-imported tokens.json stays a snapshot. Keep updating that file yourself — Live Sync will not rewrite a pasted import.')}</li>
          <li>{t('Renamed or newly added variables cannot merge onto an existing collection. Use Import into this file, or Reset this file — not another Sync now here.')}</li>
        </ol>
      ) : null}
    </div>
  )
}

function CheckMark({ selected }: { selected: boolean }) {
  return (
    <span
      className={`grid h-4 w-4 flex-shrink-0 place-items-center rounded border-2 ${
        selected ? 'border-fg bg-fg text-app' : 'border-line-strong'
      }`}
      aria-hidden
    >
      {selected ? (
        <svg width="9" height="9" viewBox="0 0 16 16" fill="none">
          <path d="M3.5 8.5 6.5 11.5 12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </span>
  )
}

function EditIcon() {
  return (
    <span
      aria-hidden
      className="h-3.5 w-3.5 flex-shrink-0 bg-current"
      style={{
        WebkitMask: "url('/icons/settings/edit.svg') center / contain no-repeat",
        mask: "url('/icons/settings/edit.svg') center / contain no-repeat",
      }}
    />
  )
}

function InfoIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 7.1v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="8" cy="4.9" r=".8" fill="currentColor" />
    </svg>
  )
}

/** Click-only, same interaction as the quick-settings `InfoHint`. Tutorial
 *  lines stay reachable from the info mark without occupying a row. */
function SyncInfoTip({ label, children }: { label: string; children: ReactNode }) {
  const tooltipId = useId()
  const anchor = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const updatePosition = useCallback(() => {
    const rect = anchor.current?.getBoundingClientRect()
    if (!rect) return
    const width = 288
    setPosition({
      left: Math.max(8, Math.min(window.innerWidth - width - 8, rect.left)),
      top: rect.bottom + 6,
    })
  }, [])

  useEffect(() => {
    if (!open) return
    updatePosition()
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (anchor.current?.contains(target) || panel.current?.contains(target)) return
      setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    document.addEventListener('keydown', onKeyDown)
    // The opening click's leftover pointerdown must not dismiss.
    const listen = window.setTimeout(() => {
      document.addEventListener('pointerdown', onPointerDown)
    }, 0)
    return () => {
      window.clearTimeout(listen)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, updatePosition])

  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-expanded={open}
        aria-controls={tooltipId}
        aria-label={label}
        onClick={() => setOpen((next) => !next)}
        className={`grid h-6 w-6 flex-shrink-0 place-items-center rounded-md text-fg-faint transition-colors hover:bg-fg/8 hover:text-fg ${SYNC_FOCUS}`}
      >
        <InfoIcon />
      </button>
      {open && position && createPortal(
        <div
          ref={panel}
          id={tooltipId}
          role="tooltip"
          className="fixed z-[70] w-72 rounded-lg border border-line-strong bg-app px-3 py-2.5 text-caption leading-relaxed text-fg-muted shadow-lg"
          style={position}
        >
          {children}
        </div>,
        document.body,
      )}
    </>
  )
}

function SyncUrlInfo({ deployed }: { deployed: boolean }) {
  const { t } = useI18n()
  return (
    <SyncInfoTip label={t('About ID to plugin')}>
      <p>{t('Paste ID to plugin in Live Sync, then Sync now.')}</p>
      <p className="mt-2">{t('Changes only when you rename the file. This page holds the themes in this window — it is not the key.')}</p>
      {!deployed && (
        <p className="mt-2">
          {t('Live publish needs the deployed app — on localhost, copy the production URL or use Import with tokens.json.')}
        </p>
      )}
    </SyncInfoTip>
  )
}

// ─── Sync status and explicit publish ───────────────────────────────────────
// Opening this surface is intentionally read-only. Its parent owns the manual
// publish request and status so the top-nav Sync control and this screen always
// show the same in-flight feedback. Downloading the plugin never invokes
// /api/tokens.
export default function FigmaSyncView({
  onClose, embedded = false, onOpenDownload,
  publishState, publishError, onRequestSync, previewTheme, onSelectTheme,
  fileName, onFileNameChange, syncModes, onSyncModesChange, section,
}: FigmaSyncViewProps) {
  const store = useDesignStore()
  const {
    autoSyncFigma, setAutoSyncFigma, pluginBuildSeen,
    themeOrder, themes, themeLabels, themeKinds, themeSources,
  } = store
  const syncThemes = useMemo(
    () => figmaSyncThemeKeys(themeOrder, themes),
    [themeOrder, themes],
  )
  const cannotSync = syncThemes.length === 0
  const [isDeployed] = useState(isLiveEnvironment)
  // Mint the stable id the moment this screen opens — this IS the screen where
  // someone sets up the connection, so it is the honest place for it, and the
  // alternative (minting inside `makeDesignDefaults`) would burn an identity on
  // every reset and every module load. Idempotent, so a re-render is free.
  //
  // NOT gated on `isDeployed`: minting touches no network, and a dev build that
  // showed a stale name-slug in a field labelled "ID to plugin" would be
  // teaching the wrong thing. The PROBE below IS gated, for the opposite
  // reason — `vite dev` answers any unknown path with index.html and HTTP 200,
  // so an unguarded probe there would report a system as Live that isn't.
  const ensurePublishId = store.ensurePublishId
  useEffect(() => { ensurePublishId() }, [ensurePublishId])
  const pluginSlug = syncProjectId(fileName)
  const syncUrl = buildSyncUrl(fileName)
  const pageUrl = section
    ? buildWorkspaceAppUrl({ origin: publishOrigin(), project: pluginSlug, section })
    : null

  const { t } = useI18n()
  const pageLabelId = useId()
  const pluginLabelId = useId()
  const fileHintId = useId()
  const fileNameRef = useRef<HTMLInputElement>(null)
  const [copied, setCopied] = useState<'sync' | 'page' | null>(null)
  // ── Does this ID actually serve anything? ─────────────────────────────────
  // The screen used to hand out a copyable key with no idea whether a blob
  // existed behind it, and a key that has never been published answers 404 —
  // which is exactly what the plugin reported, as a bare "HTTP 404" that read
  // like an outage. One GET settles it, and it is the same request the plugin
  // will make, so it cannot disagree.
  //
  // Keyed by the id it answered FOR, and read back as derived state: a result
  // for a previous id (after "New ID", or a slower response overtaking a
  // faster one) can then never be shown against the current one.
  const [probe, setProbe] = useState<{ key: string; ok: boolean } | null>(null)
  useEffect(() => {
    if (!isDeployed || !pluginSlug) return
    let cancelled = false
    fetch(`/api/tokens?project=${encodeURIComponent(pluginSlug)}`, { cache: 'no-store' })
      .then((res) => { if (!cancelled) setProbe({ key: pluginSlug, ok: res.ok }) })
      // A network failure is not "unpublished" — leave it unknown rather than
      // telling someone to re-publish something that is already there.
      .catch(() => { if (!cancelled) setProbe(null) })
    return () => { cancelled = true }
  }, [pluginSlug, isDeployed, publishState])
  const publishedState: 'unknown' | 'live' | 'missing' =
    probe && probe.key === pluginSlug ? (probe.ok ? 'live' : 'missing') : 'unknown'
  // Two clicks, because it disconnects every Figma file on the old ID.
  const [regenArmed, setRegenArmed] = useState(false)
  useEffect(() => {
    if (!regenArmed) return
    const timer = setTimeout(() => setRegenArmed(false), 4000)
    return () => clearTimeout(timer)
  }, [regenArmed])
  // Parent flips `done` back to `idle` after 1.8s, and localhost never
  // publishes at all — the plugin handoff has to ride this click, not that
  // ephemeral state.
  const [handoff, setHandoff] = useState(false)

  function requestSync() {
    setHandoff(true)
    onRequestSync()
  }

  function copyUrl(kind: 'sync' | 'page', value: string) {
    navigator.clipboard.writeText(value)
    setCopied(kind)
    setTimeout(() => setCopied(null), 2000)
  }

  /** The ONE primary action: publish, then put the ID on the clipboard.
   *
   *  It used to be "Sync now", and the payoff of that button was a POST to a
   *  server — nothing the user could see. Reported as clicking it and "no ve
   *  nada". Publishing is a MEANS; the end is having the ID in hand to paste
   *  in Figma, so the button is named and shaped after the end.
   *
   *  It still publishes, and that half is not optional: hand out an ID with no
   *  blob behind it and the plugin's first poll answers 404 — the exact failure
   *  this ID exists to remove. `publishedState !== 'live'` covers both "never
   *  published" and "the probe could not answer", so a copy is never made on a
   *  guess. */
  function copyPluginId() {
    if (publishedState !== 'live' && !cannotSync && publishState !== 'publishing') requestSync()
    else setHandoff(true)
    copyUrl('sync', pluginSlug)
  }

  function handleRegenerate() {
    if (!regenArmed) { setRegenArmed(true); return }
    setRegenArmed(false)
    store.regeneratePublishId()
    // No optimistic 'missing': the effect re-probes on the new id, and until it
    // answers the badge is honestly `unknown`.
  }

  const pluginUpdateAvailable = pluginBuildSeen != null && pluginBuildSeen !== PLUGIN_BUILD

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`flex flex-col max-w-3xl ${embedded ? 'gap-5 p-6' : 'gap-8 p-8'}`}
    >
      {onClose && <BackToEditor onClose={onClose} />}

      {!embedded && onOpenDownload ? (
        <PluginInstallPromo
          version={PLUGIN_VERSION}
          updateAvailable={pluginUpdateAvailable}
          onOpenInstall={onOpenDownload}
        />
      ) : null}

      {/* Modes first, then File name + ID to plugin as one link. Scaffold
          light/dark are not My themes — an empty library shows an empty
          list, never a default-blue "Dark" row. */}
      <div className="flex flex-col rounded-xl border border-line bg-surface/50">
          <div className="flex flex-shrink-0 items-center gap-3 border-b border-line px-5 py-3">
            <p className="text-sm font-semibold text-fg">{t('File & modes')}</p>
            <p className="ml-auto text-caption text-fg-faint">
              {t('{count} of {max}', { count: String(syncModes.length), max: String(FIGMA_SYNC_MODE_CAP) })}
            </p>
          </div>
          <div className="flex flex-col gap-4 p-5">
            <div className="flex flex-col gap-1.5">
              <p className="text-caption text-fg-faint leading-relaxed">
                {cannotSync
                  ? t('Add a System style or create a theme. Trying one on does not add it.')
                  : t('Figma gets Light and Dark as columns for each selected theme. Pick up to 3 modes.')}
              </p>
              {cannotSync ? (
                <p className="text-body font-medium text-fg-muted">{t('Nothing in My themes yet.')}</p>
              ) : (
              <div role="group" aria-label={t('Modes to sync')} className="flex flex-col gap-1">
                {syncThemes.map((key) => {
                  const lightOn = hasFigmaSyncMode(syncModes, key, 'light')
                  const darkOn = hasFigmaSyncMode(syncModes, key, 'dark')
                  const selected = lightOn || darkOn
                  const atCap = syncModes.length >= FIGMA_SYNC_MODE_CAP
                  const ramp = themeBrandRamp(key, themeSources, themeKinds, store)
                  const swatch = ramp?.[BASE_TONE] ?? store.primaryColor
                  const name = themeDisplayName(key, themeLabels)
                  return (
                    <div
                      key={key}
                      className={`flex min-w-0 items-center gap-2.5 border px-3 ${SYNC_CONTROL} ${
                        selected
                          ? 'border-fg bg-fg/8 text-fg'
                          : 'border-line text-fg-muted'
                      }`}
                    >
                      <button
                        type="button"
                        aria-pressed={selected}
                        aria-current={key === previewTheme ? 'true' : undefined}
                        onClick={() => {
                          onSyncModesChange(toggleFigmaSyncTheme(syncModes, key, themeKinds))
                          onSelectTheme(key)
                        }}
                        className={`flex min-w-0 flex-1 items-center gap-2.5 text-left ${SYNC_FOCUS}`}
                      >
                        <CheckMark selected={selected} />
                        <span
                          className="h-3.5 w-3.5 flex-shrink-0 rounded-full ring-1 ring-inset ring-black/10 dark:ring-white/15"
                          style={{ background: swatch }}
                          aria-hidden
                        />
                        <span className={`min-w-0 flex-1 truncate text-body ${selected ? 'font-semibold text-fg' : 'font-medium'}`}>
                          {name}
                        </span>
                      </button>
                      <div className="flex flex-shrink-0 items-center gap-1">
                        {(['light', 'dark'] as const).map((appearance) => {
                          const on = appearance === 'light' ? lightOn : darkOn
                          const blocked = !on && atCap
                          return (
                            <button
                              key={appearance}
                              type="button"
                              aria-pressed={on}
                              disabled={blocked}
                              title={blocked ? t('Maximum 3 modes') : t(appearance === 'light' ? 'Light' : 'Dark')}
                              aria-label={`${name} ${appearance === 'light' ? t('Light') : t('Dark')}`}
                              onClick={() => {
                                onSyncModesChange(toggleFigmaSyncAppearance(syncModes, key, appearance))
                                onSelectTheme(key)
                              }}
                              className={`inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-caption transition-colors ${SYNC_FOCUS} ${
                                on
                                  ? 'bg-fg/12 text-fg'
                                  : blocked
                                    ? 'cursor-not-allowed text-fg-faint opacity-40'
                                    : 'text-fg-muted hover:bg-fg/8 hover:text-fg'
                              }`}
                            >
                              <AppearanceGlyph kind={appearance} size={12} />
                              <span className="hidden min-[520px]:inline">{t(appearance === 'light' ? 'Light' : 'Dark')}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
              )}
            </div>
          </div>
        </div>

      <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface/50 p-5">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="figma-file-name" className="text-mini font-semibold uppercase tracking-[0.12em] text-fg-faint">
              {t('File name')}
            </label>
            <div className={`group flex min-w-0 items-center gap-2 border border-line bg-app pl-3 pr-2 ${SYNC_CONTROL} focus-within:ring-2 focus-within:ring-fg/40`}>
              <input
                ref={fileNameRef}
                id="figma-file-name"
                type="text"
                value={fileName}
                onChange={(event) => onFileNameChange(event.target.value)}
                placeholder={syncThemes[0] ? themeDisplayName(syncThemes[0], themeLabels) : store.projectName}
                aria-describedby={fileHintId}
                className="min-w-0 flex-1 bg-transparent text-body text-fg outline-none"
              />
              <span
                aria-hidden
                title={t('Rename file')}
                onMouseDown={(event) => {
                  event.preventDefault()
                  fileNameRef.current?.focus()
                }}
                className="grid h-6 w-6 flex-shrink-0 cursor-text place-items-center rounded-md text-fg-faint transition-colors group-hover:bg-fg/8 group-hover:text-fg group-focus-within:bg-fg/8 group-focus-within:text-fg"
              >
                <EditIcon />
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1">
            <p id={pluginLabelId} className="text-mini font-semibold uppercase tracking-[0.12em] text-fg-faint">{t('ID to plugin')}</p>
            <SyncUrlInfo deployed={isDeployed} />
            <PublishStateBadge state={publishedState} />
            <button
              type="button"
              onClick={handleRegenerate}
              title={t('Generate a new ID. Every Figma file on the current ID stops receiving updates.')}
              className={`ml-auto rounded-md px-1.5 py-0.5 text-mini font-semibold uppercase tracking-[0.12em] transition-colors ${regenArmed ? 'bg-status-danger/12 text-status-danger' : 'text-fg-faint hover:bg-fg/8 hover:text-fg'} ${SYNC_FOCUS}`}
            >
              {regenArmed ? t('Click again to confirm') : t('New ID')}
            </button>
          </div>
          <div className="flex items-stretch gap-2">
            <div className={`flex min-w-0 flex-1 items-center gap-2 border border-line bg-app px-3 ${SYNC_CONTROL}`}>
              {/* The ID, not the URL. The plugin's connection field takes
                  either — it normalizes whatever is pasted — but the ID is the
                  thing that is stable and short enough to read back off a
                  screen, and showing the URL is what taught everyone to treat
                  the last path segment as a name they could edit. */}
              <code
                title={syncUrl}
                aria-labelledby={pluginLabelId}
                className="min-w-0 flex-1 truncate font-mono text-caption tracking-[0.04em] text-fg"
              >
                {pluginSlug}
              </code>
              <a
                href={syncUrl}
                target="_blank"
                rel="noreferrer"
                aria-label={t('Open the raw tokens.json')}
                title={syncUrl}
                className={`grid h-6 w-6 flex-shrink-0 place-items-center rounded-md text-fg-faint transition-colors hover:bg-fg/8 hover:text-fg ${SYNC_FOCUS}`}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="M6.5 3.5H3.5v9h9V9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M9.5 3.5h3v3M12.5 3.5 7.5 8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </div>
            <button
              type="button"
              onClick={copyPluginId}
              disabled={publishState === 'publishing' || cannotSync}
              className={`inline-flex min-w-[112px] flex-shrink-0 items-center justify-center gap-2 bg-fg px-3 text-caption font-semibold text-app shadow-sm transition-[opacity,transform] hover:opacity-90 active:scale-[0.98] disabled:opacity-60 ${cannotSync ? 'disabled:cursor-not-allowed' : 'disabled:cursor-wait'} ${SYNC_CONTROL} ${SYNC_FOCUS}`}
            >
              {publishState === 'publishing' ? (
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="M8 2a6 6 0 1 1-5.2 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              ) : copied === 'sync' ? (
                <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="M3.5 8.5 6.5 11.5 12.5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <CopyGlyph size={14} />
              )}
              {publishState === 'publishing'
                ? t('Publishing…')
                : publishState === 'error'
                  ? t('Try again')
                  : copied === 'sync'
                    ? t('Copied')
                    : t('Copy ID')}
            </button>
          </div>
          {/* A disabled button whose only explanation is a `title` is a dead
              end — you click, nothing happens, and the reason needs a hover you
              have no cue to attempt. It is what "no ve nada" actually was. */}
          {cannotSync && (
            <p className="text-caption leading-relaxed text-status-warning">
              {t('Add a System style to My themes first — there is nothing to publish yet.')}
            </p>
          )}
          <p id={fileHintId} className="text-caption leading-relaxed text-fg-faint">
            {publishedState === 'missing'
              ? t('Nothing published under this ID yet — press Sync now, then paste the ID in the plugin.')
              : t('Paste this ID in the plugin. It never changes when you rename a theme or the file.')}
          </p>
          </div>
        </div>
        {/* Resume readout — last, and not an input well. File name + ID to
            plugin are the work; this URL only reopens the themes in this window. */}
        {pageUrl ? (
          <div className="flex flex-col gap-1 border-t border-line pt-4">
            <p id={pageLabelId} className="text-mini font-semibold uppercase tracking-[0.12em] text-fg-faint">{t('This page')}</p>
            <div
              role="group"
              aria-labelledby={pageLabelId}
              className="flex min-w-0 items-center gap-1.5 rounded-md px-2 h-8 bg-fg/[0.03]"
            >
              <code
                className="pointer-events-none min-w-0 flex-1 cursor-default select-none truncate font-mono text-caption text-fg-faint outline-none"
                title={pageUrl}
                aria-readonly="true"
              >
                {pageUrl}
              </code>
              <SyncInfoTip label={t('About this page')}>
                <p>{t('This URL reopens these themes. ID to plugin is the key you paste in Live Sync.')}</p>
              </SyncInfoTip>
              <button
                type="button"
                onClick={() => copyUrl('page', pageUrl)}
                aria-label={copied === 'page' ? t('Page link copied') : t('Copy page link')}
                title={copied === 'page' ? t('Copied') : t('Copy')}
                className={`grid h-6 w-6 flex-shrink-0 place-items-center rounded-md text-fg-faint transition-colors hover:bg-fg/8 hover:text-fg ${SYNC_FOCUS}`}
              >
                {copied === 'page' ? (
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="text-status-success" aria-hidden>
                    <path d="M3.5 8.5 6.5 11.5 12.5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <CopyGlyph size={13} />
                )}
              </button>
            </div>
            <p className="text-caption leading-relaxed text-fg-faint">
              {t('Themes in this window. ID to plugin is the key.')}
            </p>
          </div>
        ) : null}
        {publishState === 'publishing' && (
          <div className="flex items-center gap-1.5 text-caption">
            <span className="h-1.5 w-1.5 rounded-full bg-status-warning-solid animate-pulse" />
            <span className="text-fg-faint">Publishing your tokens…</span>
          </div>
        )}
        {publishState === 'error' && (
          <div className="flex items-center gap-1.5 text-caption">
            <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-status-danger-solid" />
            <span className="text-fg-faint">{publishError || "Couldn't publish your tokens. Retry sync, or use the plugin's Import tab to paste them manually."}</span>
          </div>
        )}
        {/* The payoff, and deliberately NOT a toast. The next step happens in
            another application — the user has to leave this window, open Figma,
            find the plugin and paste. An instruction you act on somewhere else
            must not expire after two seconds, so this card stays until the
            state that produced it changes. It is also why the old copy ("This
            only published the URL") is gone: that described the mechanism,
            which is precisely the half the user cannot see and does not need. */}
        {handoff && publishState !== 'publishing' && publishState !== 'error' && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-start gap-2.5 rounded-lg bg-fg/6 px-3 py-2.5"
          >
            <span className="mt-0.5 text-status-success" aria-hidden>✓</span>
            <div className="min-w-0">
              <p className="text-caption font-semibold text-fg">
                {t('ID copied. Now paste it in the plugin.')}
              </p>
              <p className="mt-0.5 text-caption leading-relaxed text-fg-muted">
                {t('In Figma: open the Escala plugin, paste into ID to plugin, then press Start sync.')}
              </p>
            </div>
          </div>
        )}
        <SyncStuckHelp />
        {isDeployed && (
          <div className="flex items-start justify-between gap-3 rounded-lg border border-line bg-app px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-caption font-semibold text-fg">Keep Figma in sync</p>
              <p className="mt-0.5 text-caption leading-relaxed text-fg-faint">
                Re-publish automatically after every edit.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autoSyncFigma}
              aria-label="Toggle auto-sync to Figma"
              onClick={() => setAutoSyncFigma(!autoSyncFigma)}
              className={`relative mt-0.5 h-5 w-9 flex-shrink-0 rounded-full transition-colors ${
                autoSyncFigma ? 'bg-status-success-solid' : 'bg-line-strong'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                  autoSyncFigma ? 'translate-x-4' : ''
                }`}
              />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
}
