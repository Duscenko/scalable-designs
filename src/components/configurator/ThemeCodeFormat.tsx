import { Fragment, type KeyboardEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDesignStore } from '../../store/useDesignStore'
import { captureCodeSnapshot } from '../../lib/codeScope'
import { buildCSS, buildMarkdown } from '../../lib/exporters'
import { generateTokenJSON } from '../../lib/tokenGenerator'
import { buildAgentSkillFiles } from '../../lib/agentBundle'
import {
  FIGMA_MAKE_URL,
  agentSetupPrompt,
  claudeChatUrl,
  cursorPromptUrl,
  figmaAgentLead,
} from '../../lib/agentInstall'
import { publishOrigin, syncProjectId } from '../../lib/figmaSync'
import { themeDisplayName } from '../../lib/themeSources'
import { useI18n } from '../../lib/i18n'
import { showToast } from '../ui/Toast'
import { WORKSPACE_CHIP_ACTIVE } from './themeWorkspaceLayout'
import { usePopoverPlacement } from './colorControls'
import ThemeCodeScopeRail, { resolveCodeTheme, type CodeThemeScope } from './ThemeCodeScopeRail'
import { myThemeKeys } from './ThemeLibraryRail'

export type { CodeThemeScope }
export { resolveCodeTheme }

type Format = 'css' | 'markdown' | 'agent'

const FORMATS: { key: Format; label: string; file: string }[] = [
  { key: 'css', label: 'CSS', file: 'variables.css' },
  { key: 'markdown', label: 'Markdown', file: 'README.md' },
  { key: 'agent', label: 'Agent context', file: 'references/tokens.md' },
]

const PREVIEW_LINE_LIMIT = 32

const COPY_FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/40'
const COPY_MENU_W = 220

function CopyIcon({ done = false }: { done?: boolean }) {
  if (done) {
    return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m3.25 8.25 3 3 6.5-6.5" /></svg>
  }
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" aria-hidden><rect x="5.25" y="2.25" width="7.5" height="9" rx="1.5" /><path d="M10.75 12v.75a1.5 1.5 0 0 1-1.5 1.5h-6a1.5 1.5 0 0 1-1.5-1.5v-8a1.5 1.5 0 0 1 1.5-1.5H4" /></svg>
}

function DestLogo({ name }: { name: 'claudecode' | 'cursor' | 'figma' }) {
  return (
    <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center" aria-hidden>
      <img src={`/ide-logos/${name}-dark.svg`} alt="" className="h-3.5 w-3.5 dark:hidden" />
      <img src={`/ide-logos/${name}-light.svg`} alt="" className="hidden h-3.5 w-3.5 dark:block" />
    </span>
  )
}

function MarkdownMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2.5 4.25h11v7.5h-11z" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4.25 9.5V6.5L6 8.25 7.75 6.5v3M10.25 6.5v3l2-1.75" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

async function writeClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function openHandoff(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

function CopyPageSplit({
  disabled,
  pageContent,
  markdown,
  skillMd,
  projectName,
}: {
  disabled: boolean
  pageContent: string
  markdown: string
  skillMd: string
  projectName: string
}) {
  const { t } = useI18n()
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const place = usePopoverPlacement(rootRef, open, { prefer: 200, min: 160, max: 280 })
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useEffect(() => {
    if (!open) return
    const rect = rootRef.current?.getBoundingClientRect()
    if (!rect) return
    const left = Math.max(8, Math.min(window.innerWidth - COPY_MENU_W - 8, rect.right - COPY_MENU_W))
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

  const flashCopied = () => {
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  const copyPage = async () => {
    if (!(await writeClipboard(pageContent))) {
      showToast(t('Couldn’t copy — try again'))
      return
    }
    flashCopied()
    showToast(t('Copied the file on this page.'))
  }

  const copyMarkdown = async () => {
    setOpen(false)
    if (!(await writeClipboard(markdown))) {
      showToast(t('Couldn’t copy — try again'))
      return
    }
    flashCopied()
    showToast(t('Copied README.md.'))
  }

  const openClaude = async () => {
    const prompt = agentSetupPrompt(publishOrigin(), syncProjectId(), 'claude')
    const copiedOk = await writeClipboard(prompt)
    openHandoff(claudeChatUrl(prompt))
    setOpen(false)
    showToast(copiedOk
      ? t('Copied the setup prompt. Finish connecting MCP in the chat that opened.')
      : t('Couldn’t copy — try again'))
  }

  const openCursor = async () => {
    const prompt = agentSetupPrompt(publishOrigin(), syncProjectId(), 'cursor')
    const copiedOk = await writeClipboard(prompt)
    openHandoff(cursorPromptUrl(prompt))
    setOpen(false)
    showToast(copiedOk
      ? t('Copied the setup prompt. Finish connecting MCP in the chat that opened.')
      : t('Couldn’t copy — try again'))
  }

  const openFigmaAgent = async () => {
    const copiedOk = await writeClipboard(`${figmaAgentLead(projectName)}${skillMd}`)
    openHandoff(FIGMA_MAKE_URL)
    setOpen(false)
    showToast(copiedOk
      ? t('Copied the Figma skill. Paste it in Make — it cannot hold a live MCP connection.')
      : t('Couldn’t copy — try again'))
  }

  const itemClass = `flex w-full items-center gap-2.5 px-2.5 py-2 text-left text-caption font-medium text-fg transition-colors hover:bg-fg/8 ${COPY_FOCUS}`

  return (
    <div ref={rootRef} className="relative inline-flex h-8 flex-shrink-0">
      <div className={`inline-flex h-8 overflow-hidden rounded-lg border border-line bg-app ${disabled ? 'pointer-events-none opacity-40' : ''}`}>
        <button
          type="button"
          onClick={() => void copyPage()}
          className={`inline-flex h-full items-center gap-2 px-2.5 text-caption font-medium text-fg-muted transition-colors hover:bg-fg/8 hover:text-fg ${COPY_FOCUS}`}
        >
          <CopyIcon done={copied} />
          {copied ? t('Copied') : t('Copy page')}
        </button>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={t('More copy destinations')}
          onClick={() => setOpen((next) => !next)}
          className={`grid h-full w-8 place-items-center border-l border-line text-fg-muted transition-colors hover:bg-fg/8 hover:text-fg ${COPY_FOCUS}`}
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
          aria-label={t('More copy destinations')}
          className="fixed z-[70] overflow-hidden rounded-lg border border-line-strong bg-app py-1 shadow-lg"
          style={{
            width: COPY_MENU_W,
            left: pos.left,
            ...(place.up ? { bottom: window.innerHeight - (rootRef.current?.getBoundingClientRect().top ?? 0) + 6 } : { top: pos.top }),
            maxHeight: place.max,
          }}
        >
          <button type="button" role="menuitem" className={itemClass} onClick={() => void openClaude()}>
            <DestLogo name="claudecode" />
            {t('Open in Claude')}
          </button>
          <button type="button" role="menuitem" className={itemClass} onClick={() => void openCursor()}>
            <DestLogo name="cursor" />
            {t('Open in Cursor')}
          </button>
          <button type="button" role="menuitem" className={itemClass} onClick={() => void openFigmaAgent()}>
            <DestLogo name="figma" />
            {t('Figma Agent')}
          </button>
          <button type="button" role="menuitem" className={itemClass} onClick={() => void copyMarkdown()}>
            <span className="grid h-4 w-4 flex-shrink-0 place-items-center text-fg"><MarkdownMark /></span>
            {t('Copy Markdown')}
          </button>
        </div>,
        document.body,
      )}
    </div>
  )
}

function highlightedMarkdown(line: string): ReactNode {
  const heading = line.match(/^(\s*)(#{1,6})(\s+)(.*)$/)
  if (heading) return <><span className="text-fg-faint">{heading[1]}{heading[2]}</span>{heading[3]}<span className="font-semibold text-fg">{heading[4]}</span></>

  const yaml = line.match(/^([a-zA-Z][\w-]*)(:)(.*)$/)
  if (yaml) return <><span className="text-accent-ui">{yaml[1]}</span><span className="text-fg-faint">{yaml[2]}</span><span>{yaml[3]}</span></>

  const parts = line.split(/(`[^`]+`|\*\*[^*]+\*\*)/g)
  return parts.map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`')) return <span key={index} className="text-accent-ui">{part}</span>
    if (part.startsWith('**') && part.endsWith('**')) return <span key={index} className="font-semibold text-fg">{part}</span>
    return <Fragment key={index}>{part}</Fragment>
  })
}

function highlightedCss(line: string): ReactNode {
  if (/^\s*\/\*/.test(line)) return <span className="text-fg-faint">{line}</span>

  const declaration = line.match(/^(\s*)(--[^:]+)(:)(.*?)(;?)$/)
  if (declaration) {
    return <>{declaration[1]}<span className="text-accent-ui">{declaration[2]}</span><span className="text-fg-faint">{declaration[3]}</span><span className="text-fg">{declaration[4]}</span><span className="text-fg-faint">{declaration[5]}</span></>
  }

  const rule = line.match(/^(\s*)([^{}]+)(\s*\{\s*)$/)
  if (rule) return <>{rule[1]}<span className="font-medium text-fg">{rule[2]}</span><span className="text-fg-faint">{rule[3]}</span></>
  if (/^\s*[{}]+\s*$/.test(line)) return <span className="text-fg-faint">{line}</span>
  return line
}

function CodeLine({ value, number, format }: { value: string; number: number; format: Format }) {
  // Agent context is prose (headings, paragraphs, lists) plus markdown tables,
  // not a declaration dump. `min-w-max` + `whitespace-pre` on CSS/Markdown is
  // what keeps tables and `--var:` rows intact; the same pair turns Agent
  // context into an infinitely-wide column. Wrap + a prose measure only there;
  // table rows keep the pane width so columns stay aligned.
  const wrap = format === 'agent'
  const heading = wrap && /^#{1,6}\s/.test(value)
  const table = wrap && /^\s*\|/.test(value)
  return (
    <div className={`grid grid-cols-[48px_minmax(0,1fr)] ${wrap ? 'text-caption leading-relaxed' : 'min-w-max text-body leading-[22px]'} ${heading ? 'pt-2.5' : ''}`}>
      <span aria-hidden className="select-none border-r border-line pr-3 text-right font-mono text-fg-faint/70">{number}</span>
      <code className={`px-4 font-mono text-fg-muted ${wrap ? `block min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${table ? '' : 'max-w-prose'}` : 'min-w-max whitespace-pre'}`}>{format === 'css' ? highlightedCss(value) : highlightedMarkdown(value)}</code>
    </div>
  )
}

/**
 * Read-only companion to Export. Inspect/copy the same CSS, documentation and
 * agent contract that the existing export flow ships.
 */
export default function ThemeCodeFormat({
  previewTheme,
  scope = '',
  onScopeChange,
  onPreviewThemeChange,
  onOpenThemeLibrary,
  showBreadcrumb = false,
}: {
  previewTheme: string
  scope?: CodeThemeScope
  onScopeChange: (scope: CodeThemeScope) => void
  onPreviewThemeChange: (theme: string) => void
  onOpenThemeLibrary: () => void
  showBreadcrumb?: boolean
}) {
  const { t } = useI18n()
  const store = useDesignStore()
  const [format, setFormat] = useState<Format>('css')
  const [expanded, setExpanded] = useState(false)
  const active = FORMATS.find((item) => item.key === format) ?? FORMATS[0]
  const listed = myThemeKeys(store.themeOrder, store.themes)
  const effectiveScope = resolveCodeTheme(listed, scope, previewTheme)
  // One library theme, both appearances. Kits save still uses
  // scopeSnapshotToTheme; this file is what someone pastes.
  const source = useMemo(() => (
    effectiveScope ? captureCodeSnapshot(store, effectiveScope) : null
  ), [store, effectiveScope])
  const artifacts = useMemo(() => {
    if (!source) return { css: '', markdown: '', tokensMd: '', skillMd: '' }
    const json = generateTokenJSON(source)
    const { files } = buildAgentSkillFiles(json, {
      projectFallback: source.projectName,
      iconKey: source.iconAiSource,
    })
    return {
      css: buildCSS(source as ReturnType<typeof useDesignStore.getState>),
      markdown: buildMarkdown(source as ReturnType<typeof useDesignStore.getState>),
      tokensMd: files.find((file) => file.path === 'references/tokens.md')?.text ?? '',
      skillMd: files.find((file) => file.path === 'SKILL.md')?.text ?? '',
    }
  }, [source])
  const content = format === 'css' ? artifacts.css : format === 'markdown' ? artifacts.markdown : artifacts.tokensMd
  const lines = useMemo(() => (effectiveScope && content ? content.split('\n') : []), [content, effectiveScope])
  const visibleLines = expanded ? lines : lines.slice(0, PREVIEW_LINE_LIMIT)
  const scopedLabel = effectiveScope
    ? themeDisplayName(effectiveScope, store.themeLabels)
    : t('Add a theme to get its code.')

  const selectFormat = (key: Format) => {
    setFormat(key)
    setExpanded(false)
  }

  const onTabListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const current = Math.max(0, FORMATS.findIndex((item) => item.key === format))
    const next = (current + (event.key === 'ArrowRight' ? 1 : FORMATS.length - 1)) % FORMATS.length
    selectFormat(FORMATS[next].key)
    const tabs = event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    requestAnimationFrame(() => tabs[next]?.focus())
  }

  return (
    <section className="h-full min-h-0 flex bg-app" aria-label="Code format">
      <ThemeCodeScopeRail
        scope={effectiveScope}
        previewTheme={previewTheme}
        onScopeChange={onScopeChange}
        onPreviewThemeChange={onPreviewThemeChange}
        onOpenThemeLibrary={onOpenThemeLibrary}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {showBreadcrumb ? (
          <header className="flex-shrink-0 border-b border-line px-5 py-3 foundation-layer-bar">
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-mini text-fg-faint">
              <span>Theme preview</span><span aria-hidden>/</span><span>Code</span><span aria-hidden>/</span>
              <span className="font-medium text-fg">{active.label}</span>
            </nav>
          </header>
        ) : null}
        <div className="flex min-h-0 flex-1 p-3">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-line-strong bg-surface shadow-sm">
            <header className="flex min-h-[54px] flex-shrink-0 items-center gap-4 border-b border-line px-3 foundation-layer-bar">
              <div
                className="flex h-8 flex-shrink-0 items-center gap-0.5 rounded-lg border border-line bg-tab-bar p-0.5"
                role="tablist"
                aria-label="Code format"
                onKeyDown={onTabListKeyDown}
              >
                {FORMATS.map((item) => {
                  const selected = item.key === format
                  return (
                    <button
                      key={item.key}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      tabIndex={selected ? 0 : -1}
                      onClick={() => selectFormat(item.key)}
                      className={`h-7 rounded-md px-3 text-caption font-medium transition-[color,background-color,transform] duration-150 ease-[var(--ease-out-quint)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ui/50 ${selected ? `${WORKSPACE_CHIP_ACTIVE} shadow-sm` : 'text-fg-faint hover:bg-surface hover:text-fg'}`}
                    >
                      {item.label}
                    </button>
                  )
                })}
              </div>
              <div className="min-w-0 truncate text-caption text-fg-faint">
                <span className="font-mono text-fg-muted">{active.file}</span>
                <span className="px-2 text-fg-faint/70" aria-hidden>·</span>
                <span>{scopedLabel}</span>
                {lines.length ? (
                  <>
                    <span className="px-2 text-fg-faint/70" aria-hidden>·</span>
                    <span>{lines.length} lines</span>
                  </>
                ) : null}
              </div>
              {expanded ? <button type="button" onClick={() => setExpanded(false)} className="ml-auto flex-shrink-0 text-caption font-medium text-fg-faint transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ui/55">Collapse</button> : <span className="ml-auto" />}
              <CopyPageSplit
                disabled={!effectiveScope}
                pageContent={content}
                markdown={artifacts.markdown}
                skillMd={artifacts.skillMd}
                projectName={source?.projectName || store.projectName}
              />
            </header>
      {/* The fade + "Show full file" is a SIBLING of the scroller, inside a
          `relative` wrapper — it used to be a child of it, `absolute bottom-0`.
          Inside a scroll container that resolves against the UNSCROLLED padding
          box, so the fade rode up with the content the moment you scrolled and
          the last lines rendered past it un-faded (measured: 731px of content
          in a 663px box, so it always overflowed). Out here it is pinned to the
          panel's real bottom edge and stays there at any scroll position.

          The scroller is `bg-app` rather than `bg-app/40` for the same fix. The
          gradient has to END in the exact colour behind it, and `bg-app/40` over
          the card's `--surface` composites to rgb(20.8, 20.8, 22.6) while the
          gradient's solid stop was `--app` rgb(10,10,10) — an OKLab ΔL of 0.051
          between them, larger than most of this app's own elevation steps, so
          it read as a dark BAR across the bottom instead of a dissolve. One
          opaque token on both sides is the only way the two can't disagree. */}
            <div className="relative min-h-0 flex-1">
              <div className={`h-full bg-app py-3 ${format === 'agent' ? 'overflow-y-auto overflow-x-hidden' : 'overflow-auto'}`} role="region" aria-label={`${active.file} preview`} tabIndex={0}>
                {effectiveScope
                  ? visibleLines.map((line, index) => <CodeLine key={`${index}-${line}`} value={line} number={index + 1} format={format} />)
                  : <p className="px-7 py-2 text-caption text-fg-faint">{t('Add a theme to get its code.')}</p>}
              </div>
              {!expanded && lines.length > PREVIEW_LINE_LIMIT ? (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex h-24 items-end justify-center bg-gradient-to-t from-app via-app/90 to-transparent pb-4 pt-8">
                  <button type="button" onClick={() => setExpanded(true)} className="pointer-events-auto h-8 rounded-lg border border-line-strong bg-elevated px-3 text-caption font-semibold text-fg shadow-sm transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ui/55">
                    Show full file <span className="ml-1 font-normal text-fg-faint">{lines.length} lines</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
