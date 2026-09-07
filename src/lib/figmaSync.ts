import { useEffect } from 'react'
import { useDesignStore } from '../store/useDesignStore'
import { generateTokenJSON, setActiveThemeHint, type GenerateTokenOptions } from './tokenGenerator'
import { DEFAULT_PUBLISH_ORIGIN, mcpOrigin } from './agentInstall'
import { claimStorageKey } from './publishTrust'
import { slugify } from './utils'

/** Ephemeral UI feedback for an explicit user-initiated Figma publish. This
 * deliberately does not live in the persisted design-system store: a spinner
 * or failed request belongs to the current interaction, not the system. */
export type FigmaPublishState = 'idle' | 'publishing' | 'done' | 'error'

// Single source of truth for the publish-to-Figma flow. Both the manual "Sync"
// pill (TopNav), the Figma connect view, and the auto-sync subscription go
// through here so they all hit the same endpoint and update the same status.

/** `/api/tokens` only exists on the deployed app — `vite dev` has no function. */
export function isLiveEnvironment(): boolean {
  if (typeof window === 'undefined') return false
  const o = window.location.origin
  return !o.includes('localhost') && !o.includes('127.0.0.1')
}

/**
 * Blob key for `/api/tokens?project=<id>`.
 * A Figma file name wins — ID to plugin and the POST must use the same slug.
 * Without one, the editor project name is the fallback (MCP, GitHub, Docs).
 */
export function syncProjectId(fileName?: string): string {
  const fromFile = fileName?.trim() ? slugify(fileName.trim()) : ''
  if (fromFile) return fromFile
  return slugify(useDesignStore.getState().projectName) || 'design-system'
}

/**
 * Origin used for published URLs (Figma Sync and MCP). Same host for both so
 * a project slug copied from Sync is valid on `resolve_token`.
 *
 * **A localhost origin resolves to the deployed apex, never to itself.** This
 * is DISPLAY-ONLY — the POST goes through `syncPath()`, a relative URL on the
 * current origin, so nothing here can send a dev build's publish to
 * production. What it fixes is the opposite direction: served from
 * `vite dev` (5173) or `vite preview` (4173), this returned that origin and
 * the AI-agents panel printed
 * `claude mcp add --transport http escala-tokens http://localhost:4173/api/mcp`
 * — a command that registers a server which can never answer. `api/*.ts` are
 * Vercel functions; Vite serves the bundle and nothing else, so that path is a
 * hard 404 (measured). `isLiveEnvironment()` right above already encodes
 * exactly this fact for the publish flow — it existed and this function simply
 * wasn't asking it.
 *
 * Deliberately NOT special-casing `vercel dev` (port 3000), where a local
 * `/api/mcp` genuinely does answer: an MCP entry is written once into a
 * long-lived editor config, and one pointing at a dev server that is up only
 * while you happen to be running it is a worse default than one pointing at
 * the always-on deployment. Someone testing the local function can still edit
 * the host by hand.
 */
export function publishOrigin(): string {
  if (typeof window === 'undefined') return DEFAULT_PUBLISH_ORIGIN
  if (!isLiveEnvironment()) return DEFAULT_PUBLISH_ORIGIN
  return mcpOrigin(window.location.origin || DEFAULT_PUBLISH_ORIGIN)
}

/** Relative endpoint used for the POST (and what the plugin should GET). */
export function syncPath(fileName?: string): string {
  return `/api/tokens?project=${encodeURIComponent(syncProjectId(fileName))}`
}

/** Absolute, copy-pasteable sync URL for the active system (for display). */
export function syncUrl(fileName?: string): string {
  return `${publishOrigin()}${syncPath(fileName)}`
}

export function getStoredClaim(slug: string): string | null {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem(claimStorageKey(slug))
}

export function setStoredClaim(slug: string, claim: string): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(claimStorageKey(slug), claim)
}

/**
 * Why a publish failed, so the UI can say something more useful than "retry":
 *  - `claim-lost`: this browser's saved claim for the slug is missing or the
 *    server rejected it (401) — another browser/machine owns the slug now, or
 *    site data was cleared. Retrying with the same claim will fail again.
 *  - `network`: the request itself didn't complete (offline, timeout, CORS).
 *  - `server`: the endpoint responded but rejected the payload for some other
 *    reason (400/403/5xx) — surfaced with its status so it's not a total guess.
 */
export type PublishFailureReason = 'claim-lost' | 'network' | 'server'
export interface PublishResult {
  ok: boolean
  reason?: PublishFailureReason
  status?: number
}

/**
 * POST the current token set to this system's scoped endpoint so an installed
 * plugin picks it up on its next sync. Records the publish time on success.
 * Never throws — a failure comes back as `{ ok: false, reason, status }` so a
 * caller can tell a lost claim (this slug needs re-claiming) apart from a
 * network hiccup (just retry) instead of a single flat "publish failed".
 *
 * First successful publish to a slug returns a claim; later writes send it as
 * `Authorization: Bearer`. The claim also lands in `.escala/system.json` when
 * the system is pushed to GitHub, so another machine can recover it.
 */
export type PublishTokensInput = Pick<GenerateTokenOptions, 'theme' | 'themes' | 'modes' | 'project' | 'section'>

function publishOptions(
  themeOrOpts?: string | PublishTokensInput,
  section?: string,
): PublishTokensInput {
  if (themeOrOpts && typeof themeOrOpts === 'object') return themeOrOpts
  return { theme: themeOrOpts, section }
}

export async function publishTokens(
  themeOrOpts?: string | PublishTokensInput,
  section?: string,
): Promise<PublishResult> {
  const opts = publishOptions(themeOrOpts, section)
  if (opts.theme) setActiveThemeHint(opts.theme)
  const slug = syncProjectId(opts.project ?? undefined)
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const claim = getStoredClaim(slug)
  if (claim) headers.Authorization = `Bearer ${claim}`

  let res: Response
  try {
    res = await fetch(syncPath(opts.project ?? undefined), {
      method: 'POST',
      headers,
      body: JSON.stringify(generateTokenJSON(undefined, {
        ...(opts.theme ? { theme: opts.theme } : {}),
        ...(opts.themes?.length ? { themes: opts.themes } : {}),
        ...(opts.modes?.length ? { modes: opts.modes } : {}),
        ...(opts.project?.trim() ? { project: opts.project.trim() } : {}),
        ...(opts.section ? { section: opts.section } : {}),
      })),
    })
  } catch {
    return { ok: false, reason: 'network' }
  }

  if (res.ok) {
    const body = (await res.json().catch(() => null)) as { claim?: unknown } | null
    if (typeof body?.claim === 'string' && body.claim) {
      setStoredClaim(slug, body.claim)
    }
    useDesignStore.getState().setFigmaLastPublishAt(new Date().toISOString())
    return { ok: true }
  }

  return {
    ok: false,
    status: res.status,
    // 401 is `api/tokens.ts`'s exact response for "this slug is claimed by a
    // claim you didn't present" — the one failure mode a plain retry can't fix.
    reason: res.status === 401 ? 'claim-lost' : 'server',
  }
}

/** Human copy for a `PublishResult.reason` — shared by the Sync pill's tooltip
 * and FigmaSyncView's status line so the two never phrase the same failure
 * differently. A missing reason (the success case) has no caller. */
export function describePublishFailure(
  reason: PublishFailureReason | undefined,
  fileName?: string,
): string {
  switch (reason) {
    case 'claim-lost':
      return `This file name ("${syncProjectId(fileName)}") is already published from another browser or device. Rename the file to publish under a new URL, or reconnect from the browser that published it first.`
    case 'network':
      return 'Could not reach the server — check your connection and try again.'
    case 'server':
    default:
      return "Couldn't publish your tokens. Retry sync, or use the plugin's Import tab to paste them manually."
  }
}

/**
 * While `autoSyncFigma` is on (and we're live), re-publish the token set ~1.5s
 * after the designer stops editing, so Figma always reads the current state.
 *
 * The change signal is the JSON of `generateTokenJSON({ theme })` — scoped
 * to the theme the Sync page radio picked, so leftover scaffolding cannot
 * republish itself. It excludes the connection timestamps, so the
 * `figmaLastPublishAt` write that `publishTokens` triggers can't feed back
 * into another publish. Re-importing unchanged payloads is also cheap on
 * the plugin side (it hashes before importing), but debouncing + signature
 * dedupe keeps the endpoint quiet during rapid edits.
 *
 * `onStateChange` shares the SAME `FigmaPublishState` the manual "Sync now"
 * button drives (plus the failure `reason`, when there is one), so a failed
 * background publish lights the same red dot instead of failing in total
 * silence — before this, `void publishTokens()` discarded the result and an
 * expired claim (or any other error) behind a live-editing session had no
 * visible symptom at all.
 */
export function useAutoFigmaSync(
  onStateChange?: (state: FigmaPublishState, reason?: PublishFailureReason) => void,
  activeThemeOrOpts?: string | PublishTokensInput,
  section?: string,
): void {
  const auto = useDesignStore((s) => s.autoSyncFigma)
  const opts = typeof activeThemeOrOpts === 'object' && activeThemeOrOpts
    ? activeThemeOrOpts
    : { theme: activeThemeOrOpts, section }
  const activeTheme = opts.theme
  const publishKey = JSON.stringify({
    theme: opts.theme ?? null,
    themes: opts.themes ?? null,
    modes: opts.modes ?? null,
    project: opts.project ?? null,
    section: opts.section ?? section ?? null,
  })

  useEffect(() => {
    if (activeTheme) setActiveThemeHint(activeTheme)
    if (!auto || !isLiveEnvironment()) return

    let timer: ReturnType<typeof setTimeout> | undefined
    let lastSig = ''
    const publishOpts: PublishTokensInput = {
      ...opts,
      section: opts.section ?? section,
    }

    const schedule = () => {
      // Empty modes = My themes is empty. Do not republish scaffold light/dark.
      if (Array.isArray(opts.modes) && opts.modes.length === 0) return
      if (activeTheme) setActiveThemeHint(activeTheme)
      const payload = generateTokenJSON(undefined, {
        ...(publishOpts.theme ? { theme: publishOpts.theme } : {}),
        ...(publishOpts.themes?.length ? { themes: publishOpts.themes } : {}),
        ...(publishOpts.modes?.length ? { modes: publishOpts.modes } : {}),
        ...(publishOpts.project?.trim() ? { project: publishOpts.project.trim() } : {}),
        ...(publishOpts.section ? { section: publishOpts.section } : {}),
      }) as { editor?: unknown }
      // Section is chrome. A tab switch must not republish the token blob.
      const { editor: _editor, ...forSig } = payload
      const sig = JSON.stringify(forSig)
      if (sig === lastSig) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        lastSig = sig
        onStateChange?.('publishing')
        void publishTokens(publishOpts).then((result) => onStateChange?.(result.ok ? 'done' : 'error', result.reason))
      }, 1500)
    }

    schedule() // publish the current state immediately when auto-sync turns on
    const unsubscribe = useDesignStore.subscribe(schedule)

    return () => {
      unsubscribe()
      if (timer) clearTimeout(timer)
    }
  }, [auto, onStateChange, activeTheme, publishKey, section])
}
