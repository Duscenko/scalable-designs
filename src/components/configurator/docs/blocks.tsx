// Shared documentation blocks — used by BOTH article kinds the app renders:
// a foundation page (`foundationDocs.tsx`, under the Docs destination) and a
// component page (`componentArticle.tsx`, under Components).
//
// They live here, shared, rather than in either article, because a foundation
// and a component should still read as the same KIND of page even though they
// now live under two separate top-nav destinations: same breadcrumb shape,
// same Copy context to Agents, same section headings, same code block, same TOC, same
// prev/next. Two copies of these would let the two drift apart the way the
// pre-merge Documentation/Components split once did.

import { useState, type ReactNode } from 'react'
import { buildCopyPageContext } from '../../../lib/skillExport'
import { AIContextButton } from '../../ui/AIContextButton'
import { useI18n } from '../../../lib/i18n'
import type { UseIt, UseItDestId } from './useIt'

// ── Copy ─────────────────────────────────────────────────────────────────────

export function CopyButton({
  text, label, title,
}: { text: string; label?: string; title?: string }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  async function copy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={copy}
      title={title}
      className="flex items-center gap-1.5 text-caption text-fg-muted hover:text-fg transition-colors whitespace-nowrap"
    >
      {copied ? (
        <><span className="text-status-success">✓</span> {t('Copied')}</>
      ) : (
        <>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden><rect x="1" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.2" /><path d="M3 3V2a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H8" stroke="currentColor" strokeWidth="1.2" /></svg>
          {label ?? t('Copy')}
        </>
      )}
    </button>
  )
}

/** Component article header — `AIContextButton` scoped to one catalogue page. */
export function CopyAgentContextButton({ text }: { text: string }) {
  return <AIContextButton scope="component" markdown={text} />
}

/** Overview header — same chrome, global Skill markdown (zip still lives in Export).
 *  Labelled paste-only: install lives on Docs → Use in code. */
export function DownloadSkillButton() {
  const { t } = useI18n()
  return <AIContextButton scope="global" label={t('Copy page')} markdown={buildCopyPageContext} />
}

// ── Page chrome ──────────────────────────────────────────────────────────────

/** Breadcrumb + page actions. `section` is the top-nav destination this page
 *  lives under ("Components" or "Docs" — they're separate destinations now,
 *  not one shared "Documentation"); `kind` is the middle crumb — "Foundations"
 *  or a component category. */
export function DocHeader({
  section, kind, title, actions, extra, sticky = false,
}: {
  section: string; kind: string; title: string; actions: ReactNode
  /** Rendered in the actions cluster after `actions` — e.g. a trailing control
   *  that must stay rightmost. */
  extra?: ReactNode
  /** Pins the header to the top of the scrolling article (the Theme Preview hub). */
  sticky?: boolean
}) {
  return (
    <div className={`flex items-center justify-between gap-4 min-w-0 @max-[640px]:flex-col @max-[640px]:items-start ${
      sticky ? 'sticky top-0 z-20 bg-app -mx-5 @min-[760px]:-mx-8 px-5 @min-[760px]:px-8 py-3 border-b border-line' : ''
    }`}>
      {/* The MIDDLE crumb is the one that drops on a narrow window, not the
          page's own name: with the rail, the master list and the TOC all
          claiming width, three crumbs plus the actions truncated to
          "Components / B… / B", which names nothing. The section and the
          page survive at every width; the group in between is already visible
          in the rail. */}
      <div className="flex items-center gap-1.5 text-caption text-fg-faint min-w-0">
        <span className="flex-shrink-0">{section}</span>
        <span aria-hidden className="hidden lg:inline flex-shrink-0">/</span>
        <span className="hidden lg:inline truncate">{kind}</span>
        <span aria-hidden className="flex-shrink-0">/</span>
        <span className="text-fg font-medium truncate">{title}</span>
      </div>
      <div className="flex items-center gap-3 max-w-full flex-shrink-0">{actions}{extra}</div>
    </div>
  )
}

export function DocTitle({
  title, eyebrow, lead, meta,
}: { title: string; eyebrow: string; lead: string; meta?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 -mt-3">
      <div className="flex items-center gap-2.5 flex-wrap">
        <h2 className="text-2xl font-semibold text-fg">{title}</h2>
        <span className="text-mini uppercase tracking-widest text-fg-faint mt-1.5">{eyebrow}</span>
        {meta && <span className="mt-1.5">{meta}</span>}
      </div>
      {/* The lead paragraph IS the "Description"/"Overview" section — it carries
          the TOC anchor rather than a second block repeating the same string. */}
      <Prose id="description" text={lead} className="text-sm text-fg-muted leading-relaxed max-w-xl scroll-mt-4" />
    </div>
  )
}

/** Prose with `inline code` spans. The foundation pages describe tokens by
 *  NAME constantly ("`sm` for a resting card"), and a paragraph that prints its
 *  own backticks reads as an unrendered markdown file. Split-on-backtick rather
 *  than a markdown dependency: this is the only formatting these strings use,
 *  and keeping it to one rule means the prose can't grow syntax the renderer
 *  silently drops. */
export function Prose({ id, text, className = '' }: { id?: string; text: string; className?: string }) {
  const parts = text.split('`')
  return (
    <p id={id} className={className}>
      {parts.map((part, i) =>
        i % 2 === 1
          ? <code key={i} className="font-mono text-[0.92em] px-1 py-0.5 rounded bg-elevated/70 border border-line text-fg">{part}</code>
          : <span key={i}>{part}</span>,
      )}
    </p>
  )
}

export function SectionHeading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h3 id={id} className="text-base font-semibold text-fg scroll-mt-4">
      {children}
    </h3>
  )
}

/** A prose section: heading + optional paragraph + body. The shape every
 *  numbered section of both article kinds uses. */
export function DocSection({
  id, title, description, children,
}: { id: string; title: string; description?: string; children?: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <SectionHeading id={id}>{title}</SectionHeading>
      {description && <Prose text={description} className="text-ui text-fg-muted leading-relaxed" />}
      {children}
    </section>
  )
}

// ── Code / preview blocks ────────────────────────────────────────────────────

export function BlockChrome({ left, children }: { left: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-line bg-surface/60">
      {left}
      {children}
    </div>
  )
}

export function ViewToggle({
  view, onChange,
}: { view: 'preview' | 'code'; onChange: (v: 'preview' | 'code') => void }) {
  const { t } = useI18n()
  // The label is now a real word, not the state key under a `capitalize`
  // class — that class also has to go, or "vista previa" would render as
  // "Vista Previa" (Spanish and French capitalise only the first word).
  const label = { preview: t('Preview'), code: t('Code') }
  return (
    <div className="flex items-center gap-1">
      {(['preview', 'code'] as const).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          aria-pressed={view === v}
          className={`px-2.5 py-1 rounded-md text-caption font-medium transition-colors ${
            view === v ? 'bg-elevated text-fg' : 'text-fg-muted hover:text-fg'
          }`}
        >
          {label[v]}
        </button>
      ))}
    </div>
  )
}

export function CodePane({ code, minH = 60 }: { code: string; minH?: number }) {
  return (
    <pre
      className="px-4 py-3 text-caption font-mono leading-relaxed text-fg-muted overflow-x-auto whitespace-pre bg-surface/40"
      style={{ minHeight: minH }}
    >
      {code}
    </pre>
  )
}

/** A titled, copyable code block — the "Usage" snippet on every page. */
export function CodeBlock({ file, code }: { file: string; code: string }) {
  return (
    <div className="rounded-xl border border-line overflow-hidden">
      <BlockChrome left={<span className="text-caption font-mono text-fg-faint truncate">{file}</span>}>
        <CopyButton text={code} />
      </BlockChrome>
      <CodePane code={code} />
    </div>
  )
}

/** A specimen surface with a Preview/Code toggle. Used by the component page's
 *  per-axis Examples and by any foundation section that has code worth showing
 *  next to the specimen. */
export function PreviewCode({
  surface, code, minH = 180, children,
}: { surface?: string; code: string; minH?: number; children: ReactNode }) {
  const [view, setView] = useState<'preview' | 'code'>('preview')
  return (
    <div className="rounded-xl border border-line overflow-hidden">
      <BlockChrome left={<ViewToggle view={view} onChange={setView} />}>
        <CopyButton text={code} />
      </BlockChrome>
      {view === 'preview' ? (
        <div
          className="flex flex-wrap items-center justify-center gap-x-8 gap-y-6 p-8"
          style={{ minHeight: minH, backgroundColor: surface }}
        >
          {children}
        </div>
      ) : (
        <CodePane code={code} />
      )}
    </div>
  )
}

export function ExampleCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2.5 min-w-0">
      {children}
      <span className="text-mini text-fg-faint">{label}</span>
    </div>
  )
}

/** "Use it" — this element in the three places the platform ships to.
 *
 *  Supersedes `ShipsAs`, which listed the same three destinations as static,
 *  hand-written naming PATTERNS in a 3-row table. Two things changed and both
 *  matter: the values are now the user's own, resolved live (see `useIt.ts`),
 *  and each one is copyable. The third row also changed identity — `Figma` /
 *  `variables.css` / `tokens.json` became **Figma · Code · AI**, because AI is
 *  a first-class destination everywhere else in this product (Get started is
 *  literally those three) and was the one missing from the triad. tokens.json
 *  didn't get dropped; it's named in the Code tab's note, where it belongs.
 *
 *  Tabs rather than three rows at once, for the same reason Create UI's
 *  Installation block uses them: one destination is the one you're actually
 *  going to. It also survives the 400px preview column, where three stacked
 *  code panes would not.
 *
 *  Chrome is reused, not invented: `BlockChrome` already renders exactly this
 *  bar (left slot + trailing actions) and `CodePane` the body, so this reads
 *  as the same object as every other code block on the page. The tab strip
 *  mirrors `AgentInstallPanel`'s (aria-pressed + `bg-elevated` active) so the
 *  product's two "how do I install this" surfaces don't drift apart. */
export function UseItBlock({ useIt }: { useIt: UseIt }) {
  const { t } = useI18n()
  const [active, setActive] = useState<UseItDestId>('code')
  // Falls back to the first destination rather than rendering an empty pane if
  // a caller ever ships a partial descriptor.
  const dest = useIt.destinations.find((d) => d.id === active) ?? useIt.destinations[0]
  if (!dest) return null

  return (
    <div className="rounded-xl border border-line overflow-hidden">
      <BlockChrome
        left={
          <div role="tablist" aria-label={t('Destination')} className="flex items-center gap-1">
            {useIt.destinations.map((d) => (
              <button
                key={d.id}
                role="tab"
                aria-selected={d.id === dest.id}
                onClick={() => setActive(d.id)}
                className={`px-2.5 py-1 rounded-md text-caption font-medium transition-colors ${
                  d.id === dest.id ? 'bg-elevated text-fg' : 'text-fg-muted hover:text-fg'
                }`}
              >
                {t(d.label)}
              </button>
            ))}
          </div>
        }
      >
        <CopyButton text={dest.code} />
      </BlockChrome>
      <CodePane code={dest.code} minH={0} />
      {dest.note && (
        <p className="px-4 py-2 text-caption leading-relaxed text-fg-faint border-t border-line break-words">
          {t(dest.note, dest.noteVars)}
        </p>
      )}
    </div>
  )
}

/** Small count pill next to a page title ("32 tokens"). */
export function CountBadge({ children }: { children: ReactNode }) {
  return (
    <span className="text-mini px-2 py-0.5 rounded-full bg-elevated/80 text-fg-faint border border-line">
      {children}
    </span>
  )
}

// ── "On this page" TOC ───────────────────────────────────────────────────────

export interface TocEntry { id: string; label: string; sub?: boolean }

export function OnThisPage({
  entries, scrollRoot,
}: { entries: TocEntry[]; scrollRoot: React.RefObject<HTMLDivElement | null> }) {
  const { t } = useI18n()
  const jump = (id: string) => {
    scrollRoot.current?.querySelector(`#${CSS.escape(id)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  return (
    <nav aria-label={t('On this page')} className="flex flex-col gap-1">
      <span className="text-mini uppercase tracking-widest text-fg-faint mb-1">{t('On this page')}</span>
      {entries.map((entry) => (
        <button
          key={entry.id}
          onClick={() => jump(entry.id)}
          className={`text-left text-body py-0.5 transition-colors text-fg-muted hover:text-fg ${entry.sub ? 'pl-3' : ''}`}
        >
          {entry.label}
        </button>
      ))}
    </nav>
  )
}

// ── Prev / next ──────────────────────────────────────────────────────────────

export function Pager({
  prev, next, onOpen,
}: {
  prev?: { key: string; label: string }
  next?: { key: string; label: string }
  onOpen: (key: string) => void
}) {
  const { t } = useI18n()
  return (
    <div className="flex items-stretch justify-between gap-3 pt-2 border-t border-line">
      {prev ? (
        <button
          onClick={() => onOpen(prev.key)}
          className="flex flex-col items-start gap-0.5 rounded-xl border border-line px-4 py-2.5 hover:border-line-strong transition-colors"
        >
          <span className="text-mini text-fg-faint">← {t('Previous')}</span>
          <span className="text-xs font-medium text-fg">{t(prev.label)}</span>
        </button>
      ) : <span />}
      {next ? (
        <button
          onClick={() => onOpen(next.key)}
          className="flex flex-col items-end gap-0.5 rounded-xl border border-line px-4 py-2.5 hover:border-line-strong transition-colors"
        >
          <span className="text-mini text-fg-faint">{t('Next')} →</span>
          <span className="text-xs font-medium text-fg">{t(next.label)}</span>
        </button>
      ) : <span />}
    </div>
  )
}
