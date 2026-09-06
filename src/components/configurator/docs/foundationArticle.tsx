// The foundation article — the same page shape a component article has, so the
// docs site reads as one thing: breadcrumb · title · Overview · Use it · Why ·
// Usage · the foundation's own sections · prev/next, with the TOC on the
// right. Content and token bodies come from `foundationDocs.tsx`.
//
// "Use it" replaced the old "Ships as" section AND moved up to sit directly
// under the lead: it answers "how do I consume this" (Figma · Code · AI) with
// live values, which is the question you have before any of the conceptual
// copy — the same slot Create UI gives Installation. See `useIt.ts`.

import { type ReactNode, useMemo, useState } from 'react'
import { AIContextButton } from '../../ui/AIContextButton'
import { useI18n } from '../../../lib/i18n'
import { withAgentEnvelope } from '../../../lib/aiContext'
import { useThemeHubHeaderActions } from '../themeHubHeaderActions'
import {
  DownloadSkillButton, DocHeader, DocTitle, DocSection, CodeBlock, UseItBlock, CountBadge,
  Pager, type TocEntry,
} from './blocks'
import { useItForFoundation, USE_IT_ID, USE_IT_TITLE, USE_IT_LEAD } from './useIt'
import {
  FOUNDATION_DOCS, OVERVIEW_KEY, foundationDoc, foundationMarkdown, PrimitiveRamp,
  type FoundationDoc, type SystemDoc,
} from './foundationDocs'
import { GET_STARTED_KEY, colorPrev, introPager, overviewNext } from './getStarted'

/** "Edit in Variables Generator" — the link that makes this a documentation OF
 *  the editor rather than a parallel description of it. It opens the very
 *  foundation the page documents. */
function EditPill({ label, onEdit }: { label: string; onEdit: () => void }) {
  const { t } = useI18n()
  return (
    <button
      onClick={onEdit}
      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium bg-elevated text-fg-muted border border-line-strong hover:text-fg transition-colors whitespace-nowrap"
      title={t('Open Variables · {label}', { label })}
    >
      {t('Edit tokens')}
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </button>
  )
}

/** `FOUNDATION_DOCS` is a module-level const of plain prose STRINGS, so it
 *  needs no refactor to translate — the strings just have to pass through
 *  `t()` somewhere a hook can run. That somewhere is here and in the article
 *  below, which is why both take `t` rather than the data being restructured.
 *  Default identity so a caller that has no locale in hand still compiles. */
type Translate = (source: string, vars?: Record<string, string | number>) => string

export function foundationToc(doc: FoundationDoc, t: Translate = (s) => s): TocEntry[] {
  return [
    { id: 'description', label: t('Overview') },
    { id: USE_IT_ID, label: t(USE_IT_TITLE) },
    { id: 'why', label: t('Why {foundation} tokens', { foundation: t(doc.label).toLowerCase() }) },
    { id: 'usage', label: t('Usage') },
    ...doc.sections.map((s) => ({ id: s.id, label: t(s.title), sub: true })),
  ]
}

export function overviewToc(t: Translate = (s) => s): TocEntry[] {
  return [
    { id: 'description', label: t('Overview') },
    { id: 'start', label: t('Take it somewhere') },
    ...FOUNDATION_DOCS.map((f) => ({ id: `ov-${f.key}`, label: t(f.label) })),
  ]
}

export function FoundationArticle({
  doc, system, onOpen, onEdit, hubMode,
}: {
  doc: FoundationDoc
  system: SystemDoc
  onOpen: (key: string) => void
  /** Opens Variables · <foundation>. */
  onEdit: (foundationKey: string) => void
  /** Theme Preview hub — page actions render in the fixed header band. */
  hubMode?: boolean
}) {
  const { t } = useI18n()
  const idx = FOUNDATION_DOCS.findIndex((f) => f.key === doc.key)
  const prev = idx === 0 ? colorPrev() : FOUNDATION_DOCS[idx - 1]
  const next = FOUNDATION_DOCS[idx + 1]
  const count = doc.tokenCount(system)
  const headerActions = useMemo(() => (
    <>
      <AIContextButton
        scope="variable"
        markdown={() => withAgentEnvelope('variable', doc.label, foundationMarkdown(doc, system))}
      />
      <EditPill label={doc.label} onEdit={() => onEdit(doc.key)} />
    </>
  ), [doc, system, onEdit])
  useThemeHubHeaderActions(hubMode ? headerActions : null)

  return (
    <div className="min-w-0 flex flex-col gap-8">
      {!hubMode ? (
        <DocHeader
          section={t('Docs')}
          kind={t('Foundations')}
          title={t(doc.label)}
          actions={headerActions}
        />
      ) : null}

      <DocTitle
        title={t(doc.label)}
        eyebrow={t('Foundation')}
        lead={t(doc.lead)}
        meta={
          <CountBadge>
            {count === 1 ? t('{count} token', { count }) : t('{count} tokens', { count })}
          </CountBadge>
        }
      />

      {/* Create UI's slot for this: immediately after the description, before
          any conceptual copy — you can't act on a page until you know how to
          consume what it documents. */}
      <DocSection id={USE_IT_ID} title={t(USE_IT_TITLE)} description={t(USE_IT_LEAD)}>
        <UseItBlock useIt={useItForFoundation(doc)} />
      </DocSection>

      <DocSection
        id="why"
        title={t('Why {foundation} tokens', { foundation: t(doc.label).toLowerCase() })}
        description={t(doc.why)}
      />

      <DocSection id="usage" title={t('Usage')} description={t(doc.usage)}>
        <CodeBlock file="variables.css" code={doc.usageCode} />
      </DocSection>

      {doc.sections.map((section) => (
        <DocSection
          key={section.id}
          id={section.id}
          title={t(section.title)}
          description={section.description ? t(section.description) : undefined}
        >
          {section.render(system)}
        </DocSection>
      ))}

      <Pager
        prev={prev && { key: prev.key, label: prev.label }}
        next={next && { key: next.key, label: next.label }}
        onOpen={onOpen}
      />
    </div>
  )
}

/** The whole-system reference sheet — every foundation's sections in one
 *  column. This is what the old Design Rules page was, kept intact for the
 *  hand-off/print case the per-foundation pages don't cover. */
export function OverviewArticle({
  system, onOpen, title, hubMode,
}: {
  system: SystemDoc
  onOpen: (key: string) => void
  /** When set (the Theme Preview hub passes the previewed theme's name), the
   *  sheet titles itself after that theme instead of the generic
   *  "System reference", and the lead reads "this theme". */
  title?: string
  /** Theme Preview hub — page actions render in the fixed header band. */
  hubMode?: boolean
}) {
  const { t } = useI18n()
  const total = FOUNDATION_DOCS.reduce((n, f) => n + f.tokenCount(system), 0)
  const intro = introPager(OVERVIEW_KEY)
  const heading = title?.trim() || t('System reference')
  // Two whole sentences rather than one with a `{subject}` slot: Spanish and
  // French inflect around "this theme" / "this system" differently enough
  // (de este tema / de ce thème, and the article that precedes them) that a
  // single template would force an ungrammatical translation.
  const lead = title?.trim()
    ? t('The full specification of this theme, generated from your own tokens — every foundation in one column, for hand-off and print. Each section links to its own page for the why and the usage.')
    : t('The full specification of this system, generated from your own tokens — every foundation in one column, for hand-off and print. Each section links to its own page for the why and the usage.')
  const headerActions = useMemo(() => <DownloadSkillButton />, [])
  useThemeHubHeaderActions(hubMode ? headerActions : null)

  return (
    <div className="min-w-0 flex flex-col gap-8">
      {!hubMode ? (
        <DocHeader
          section={t('Docs')}
          kind={t('Reference')}
          title={heading}
          actions={headerActions}
        />
      ) : null}

      <DocTitle
        title={heading}
        eyebrow={t('Reference')}
        lead={lead}
        meta={<CountBadge>{t('{count} tokens', { count: total })}</CountBadge>}
      />

      <section id="start" className="flex flex-col gap-2 scroll-mt-4">
        <p className="text-ui text-fg-muted leading-relaxed">
          {t('Looking for how this lands in Figma or in your product repo?')}{' '}
          <button
            type="button"
            onClick={() => onOpen(GET_STARTED_KEY)}
            className="text-fg font-medium hover:underline"
          >
            {t('Get started')}
          </button>
          {' '}{t('is the recipe. This page is the spec.')}
        </p>
      </section>

      {FOUNDATION_DOCS.map((f) => (
        <OverviewFoundation
          key={f.key}
          f={f}
          system={system}
          onOpen={onOpen}
          // The Color section alone is 8 blocks — 20+ ramps plus every
          // categorical table — so on the theme doc (where `title` is set) it
          // opens COLLAPSED to just the Accent + Neutral ramps, with a toggle
          // for the rest. The hand-off / print sheet (`title` absent) still
          // renders everything inline.
          collapsible={f.key === 'color' && !!title?.trim()}
        />
      ))}

      <Pager
        prev={intro.prev}
        next={overviewNext()}
        onOpen={onOpen}
      />
    </div>
  )
}

/** One foundation's stack of cards in the Overview sheet. `collapsible` (the
 *  Color section on the theme doc) opens showing only the Accent + Neutral
 *  primitive ramps behind an Expand toggle, so the reader isn't dropped into
 *  20+ ramps and every categorical table before the next foundation. */
function OverviewFoundation({
  f, system, onOpen, collapsible,
}: {
  f: FoundationDoc
  system: SystemDoc
  onOpen: (key: string) => void
  collapsible: boolean
}) {
  const [open, setOpen] = useState(false)
  const { t } = useI18n()
  const showAll = !collapsible || open
  const peekFamilies = system.primitiveFamilies.filter(
    (fam) => fam.label === 'Accent' || fam.label === 'Neutral',
  )

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4 pt-2 border-t border-line">
        <h3 id={`ov-${f.key}`} className="text-base font-semibold text-fg scroll-mt-4 pt-4">{t(f.label)}</h3>
        <div className="flex items-center gap-3">
          {collapsible && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-caption text-fg-muted hover:text-fg hover:border-line-strong transition-colors whitespace-nowrap"
            >
              {open ? t('Collapse') : t('Expand')}
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={`transition-transform ${open ? 'rotate-180' : ''}`}>
                <path d="M3 4.5 6 7.5 9 4.5" />
              </svg>
            </button>
          )}
          <button
            onClick={() => onOpen(f.key)}
            className="text-caption text-fg-faint hover:text-fg transition-colors whitespace-nowrap"
          >
            {t('Read the {foundation} page', { foundation: t(f.label).toLowerCase() })} →
          </button>
        </div>
      </div>
      {showAll ? (
        f.sections.map((section) => (
          <Block
            key={section.id}
            title={t(section.title)}
            description={section.description ? t(section.description) : undefined}
          >
            {section.render(system)}
          </Block>
        ))
      ) : (
        <Block
          title={t('Primitives')}
          description={t('The raw color ramps every semantic token aliases. Accent and Neutral shown — Expand for the states, alpha and the categorical roles.')}
        >
          <div className="flex flex-col gap-5">
            {peekFamilies.map((fam) => (
              <div key={fam.label} className="flex flex-col gap-1.5">
                <span className="text-caption text-fg-muted">{fam.label}</span>
                <PrimitiveRamp scale={fam.scale} naming={system.colorNaming} />
              </div>
            ))}
          </div>
        </Block>
      )}
    </section>
  )
}

/** Overview's per-section card. Unlike the per-foundation page, these carry no
 *  TOC anchor of their own — the TOC here is one entry per FOUNDATION, or a
 *  eight-foundation sheet would produce a crowded rail nobody can scan. */
function Block({
  title, description, children,
}: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-app overflow-hidden">
      <div className="px-4 @min-[760px]:px-6 pt-5 pb-3">
        <h4 className="text-[15px] font-semibold text-fg">{title}</h4>
        {description && <p className="text-ui text-fg-muted mt-1 max-w-2xl leading-relaxed">{description}</p>}
      </div>
      <div className="min-w-0 px-4 @min-[760px]:px-6 pb-6">{children}</div>
    </div>
  )
}

export { OVERVIEW_KEY, foundationDoc }
