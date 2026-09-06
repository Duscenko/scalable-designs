import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { TOKEN_SCHEMA_VERSION } from '../../lib/tokenGenerator'
import { useI18n } from '../../lib/i18n'
import { COMPONENT_KEYS } from '../../lib/componentCatalogue'
import { ALL_ROLES } from '../../lib/semanticRoles'
import { categoricalRoleCount } from '../../lib/semanticArchitectures'
import { TOOL_SPECS } from '../../lib/agentAccess/types'
import { FIGMA_PLUGIN_ZIP, cn } from '../../lib/utils'
import { BrandMark, FigmaGlyph, TOP_NAV_H } from './TopNav'
import { NumberTicker } from '../ui/number-ticker'
import { RainbowButton } from '../ui/rainbow-button'
import { BentoGrid } from '../ui/bento-grid'
import { SparkleCircleIcon } from '../ui/icons'
import { DiaTextReveal } from '../ui/dia-text-reveal'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '../ui/accordion'
import AgentInstallPanel from './AgentInstallPanel'

// ── The corporate/about drawer (burger menu) ─────────────────────────────────
// Everything the workspace itself can't say: what Escala IS, how its three
// token tiers relate, how the Figma plugin consumes them, what the component
// docs are derived from, and who made it. "What shipped when" used to live
// here too — moved to Docs · Changelog (`docs/changelogArticle.tsx`), since
// it's documentation, not corporate/about copy, and Docs is where a returning
// user would actually look for it.
//
// A right-side drawer rather than a centered modal: this is reference reading
// you consult WHILE working, so it slides in beside the canvas instead of
// blocking it, and every section is collapsed by default — a list of five
// labels, not five essays. Only the section you opened it on expands.
//
// **This module owns the content, not just the drawer.** `AboutAccordion` and
// `AboutContact` are exported so the MOBILE screen (`App.tsx`'s
// `DesktopOnlyNotice`, the only thing that renders below `md`) can show the
// same sections. A phone visitor can't use the workspace — but "what is this"
// is exactly what they came for, and it used to be locked behind a burger
// button that only exists in the desktop shell. One array, two surfaces: the
// copy can't drift between them.

export type AboutSection = 'platform' | 'tokens' | 'plugin' | 'docs' | 'legal'

/** The creator's contact details — the one place they're defined. The public
 *  "contact" block leads with LinkedIn and X; `email` is kept only as the
 *  target for Docs' FAQ "report a bug" CTA (a prefilled mail draft), not shown
 *  as a raw address anywhere. Any of these set to null just drops its row. */
export const CONTACT = {
  email: 'duscenko@gmail.com',
  site: 'duscenko.com',
  linkedin: 'https://www.linkedin.com/in/cesar-durango/' as string | null,
  x: 'https://x.com/duscenko' as string | null,
}

const COPYRIGHT_YEAR = 2026

/** Shown in the footer bar AND at the foot of About, so the one legal
 *  line can't drift. Matches LICENSE: Cesar Durango (Duscenko). */
export const COPYRIGHT_LINE = `© ${COPYRIGHT_YEAR} Cesar Durango (Duscenko)`

/** ease-out-quint — the SAME curve `AboutAccordion`'s own height animation
 *  already uses below. One easing across this file, not a bouncier one for
 *  the new hero and a different one for the accordion. */
const EASE = [0.22, 1, 0.36, 1] as const

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden
      className={`flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

/** Inline code chip — same treatment FigmaDownloadView uses for `manifest.json`. */
function C({ children }: { children: ReactNode }) {
  return <code className="text-caption px-1 py-0.5 rounded bg-elevated text-fg-muted font-mono">{children}</code>
}

function P({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('text-body leading-relaxed text-fg-muted', className)}>{children}</p>
}

/** A token tier: name, the chain step it aliases, one honest example. */
function Tier({ n, name, detail, example }: { n: number; name: string; detail: string; example: string }) {
  return (
    <div className="flex gap-3">
      <span className="flex-shrink-0 w-4 text-caption font-mono tabular-nums text-fg-faint pt-[3px]">{n}</span>
      <div className="min-w-0 flex flex-col gap-0.5">
        <span className="text-body font-medium text-fg">{name}</span>
        <span className="text-body leading-relaxed text-fg-muted">{detail}</span>
        <span className="text-caption font-mono text-fg-faint break-all">{example}</span>
      </div>
    </div>
  )
}

/** The five About sections.
 *
 *  **A HOOK, not a const array — that change is what made this page
 *  translatable at all.** It used to be a module-level `SECTIONS` const whose
 *  bodies were English JSX literals, so no `t()` could ever reach them: the
 *  chrome around the accordion spoke three languages while every word of the
 *  actual reading material stayed English. A hook runs inside a component, so
 *  it can call `useI18n`. Both consumers (`AboutAccordion` here, and
 *  `AboutScaffold`'s mobile/`/about` callers through it) are components, so
 *  nothing had to move to accommodate it. */
export function useAboutSections(): {
  key: AboutSection; label: string; hint: string; body: ReactNode
}[] {
  const { t } = useI18n()
  return [
  {
    key: 'platform',
    label: t('What Escala is'),
    hint: t('The short version'),
    body: (
      <div className="flex flex-col gap-3">
        <P>
          {t('A configurator for design token systems. You define a palette, type scale, spacing, radius and the rest once; Escala derives the full scales, keeps light and dark in step, and ships the result as')}{' '}
          <C>tokens.json</C>, <C>variables.css</C>{' '}
          {t('and a README, plus a Figma plugin that imports all of it as real Variables.')}
        </P>
        <P>
          {t('The point is')} <span className="text-fg">{t('no bloat')}</span>
          {t(": you export the tokens you actually chose, not a framework's opinion of a design system. Everything on screen derives from one payload, so the preview, the export and what lands in Figma can't disagree.")}
        </P>
        <P>
          {t('That same payload is also queryable')}{' '}
          <span className="text-fg">{t('live, by AI coding agents')}</span>{' '}
          {t('such as Cursor, Claude Code and Copilot, through a Model Context Protocol (MCP) server this project publishes. Instead of guessing a hex or a spacing value, your agent looks the real token up.')}
        </P>
      </div>
    ),
  },
  {
    key: 'tokens',
    label: t('How the tokens work'),
    hint: t('Three tiers, one chain'),
    body: (
      <div className="flex flex-col gap-3.5">
        <P>
          {t('Every value resolves down a chain. Nothing holds a copy of anything above it, so retinting one family repaints everything that references it.')}
        </P>
        <div className="flex flex-col gap-3">
          <Tier
            n={1}
            name={t('Primitives')}
            detail={t("Radix's model: each family is a 1–12 scale where the step means a role, not a lightness. Tone 9 is the anchor: your input hex, verbatim. Every family ships a light ramp and a dark twin.")}
            example="accent-9 · neutral-dark-3 · error-11"
          />
          <Tier
            n={2}
            name={t('Semantics')}
            detail={t('Named roles that point AT a primitive tone, per theme. A theme is a reading of the primitives; it stores which family fills each slot, never a hex of its own.')}
            example="text-primary → neutral-12"
          />
          <Tier
            n={3}
            name={t('Components')}
            detail={t('Created by the plugin in Figma: one variable per component property, aliasing its semantic role. Retheming a button is a one-variable change, and the whole chain stays inspectable.')}
            example="button/bg → action/primary → accent-9"
          />
        </div>
        {/* This paragraph used to advertise FOUR semantic architectures —
            Flat, Categorical, Vibrancy (Apple HIG) and Tonal (Material 3).
            Three of those no longer exist: the picker was cut to Categorical
            alone in store v50 and the projections were deleted outright in
            v57, leaving `SemanticArchitecture = 'flat' | 'categorical'`. The
            page was promising a choice the app cannot offer, and Docs · FAQ
            already answered "Why is there only one architecture?" two clicks
            away — the app contradicting itself. The role count is READ from
            the table (`categoricalRoleCount()`), never restated, because the
            other place that restated it had drifted to 39 against a real 64. */}
        <P>
          {t('The semantic layer is projected into one shape:')}{' '}
          <span className="text-fg">{t('Categorical')}</span>{' '}
          {t('— a grouped DTCG tree of {count} roles across Content, Action, Surface, Status and Border. One architecture, not a choice: every consumer (Figma, CSS, an AI agent) has to agree on what a role means. Contrast for text tones is solved against the page, targeting WCAG AA.', { count: categoricalRoleCount() })}
        </P>
      </div>
    ),
  },
  {
    key: 'plugin',
    label: t('How the Figma plugin works'),
    hint: t('Import and live sync'),
    body: (
      <div className="flex flex-col gap-3">
        <P>
          {t('The plugin reads the same')} <C>tokens.json</C>{' '}
          {t('this app exports (contract')}{' '}
          <span className="text-fg">{t('schema v{version}', { version: TOKEN_SCHEMA_VERSION })}</span>
          {t(') and builds real Figma Variable collections: Color Primitives, Color Semantics with a mode per theme, Typography, Spacing, Radius, and a Components collection whose variables alias the semantic roles.')}
        </P>
        <ol className="flex flex-col gap-1.5 text-body leading-relaxed text-fg-muted list-decimal pl-4">
          <li>{t('Download the plugin and unzip it.')}</li>
          <li>{t('Figma desktop →')} <span className="text-fg">{t('Plugins → Development → Import plugin from manifest…')}</span></li>
          <li>{t('Pick the unzipped')} <C>manifest.json</C>, {t('then run')} <span className="text-fg">Escala DS</span>.</li>
          <li>{t('Choose what to import: variables, styles, components, documentation.')}</li>
        </ol>
        <P>
          {t("It can also pull live: the plugin's Live Sync tab polls this project's endpoint, so publishing from here updates Figma without re-importing a file. Each design system publishes to its own scoped URL, so systems never overwrite each other.")}
        </P>
        <a
          href={FIGMA_PLUGIN_ZIP}
          download
          className="inline-flex items-center gap-1.5 self-start text-body font-semibold text-accent-ui hover:underline"
        >
          <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M7 1.5v8M3.5 6.5 7 10l3.5-3.5" />
            <path d="M1.5 10.5v1.5a.5.5 0 0 0 .5.5h10a.5.5 0 0 0 .5-.5v-1.5" />
          </svg>
          {t('Download the plugin (.zip)')}
        </a>
      </div>
    ),
  },
  {
    key: 'docs',
    label: t('What the documentation is based on'),
    hint: t('Sources of truth'),
    body: (
      <div className="flex flex-col gap-3">
        <P>
          <span className="text-fg">{t('The Figma plugin is the source of truth for the catalogue.')}</span>{' '}
          {t("Each of the {count} components mirrors a plugin entry: its key is the plugin's gate, its variant axes mirror the plugin's spec matrix, and its category mirrors the plugin's divider pages. When the plugin changes, the catalogue follows, never the reverse.", { count: COMPONENT_KEYS.length })}
        </P>
        <P>
          {t("Docs pages are generated from that catalogue plus the live specimen registry, so the preview you interact with is the same renderer the docs embed; it reads your tokens, not a screenshot. Components not yet in the Figma library say so explicitly rather than implying a set that doesn't exist.")}
        </P>
        {/* "and Apple HIG / Material 3 for the two alternative semantic
            architectures" was cut here for the same reason as above: those two
            architectures are gone, so the sentence credited standards this app
            no longer implements. */}
        <P>
          {t('The standards behind the defaults:')} <span className="text-fg">Radix Colors</span>{' '}
          {t('for the 12-step scale model,')} <span className="text-fg">W3C Design Tokens (DTCG)</span>{' '}
          {t('for the interchange format, and')} <span className="text-fg">WCAG</span>{' '}
          {t('for contrast targets.')}
        </P>
      </div>
    ),
  },
  {
    key: 'legal',
    label: t('Legal & data'),
    hint: t('Ownership and storage'),
    body: (
      <div className="flex flex-col gap-3">
        <P>
          {COPYRIGHT_LINE}.{' '}
          {t('Escala Tokens and its source are the work of Cesar Durango. The design systems you build with it are')}{' '}
          <span className="text-fg">{t('yours')}</span>.{' '}
          {t('The tokens, scales and exported files carry no licence or attribution requirement from this tool.')}
        </P>
        <P>
          <span className="text-fg">{t('Where your work lives:')}</span>{' '}
          {t("your system is stored in your own browser (localStorage); there are no accounts and no server-side profile. Tokens leave the browser only when you ask: publishing for Figma live-sync uploads the token payload to this project's endpoint, and connecting GitHub pushes files to the repo you pick. A GitHub token you provide stays in your browser and is never sent anywhere but GitHub.")}
        </P>
        {/* Material Design and Apple HIG were dropped from this disclaimer
            with the architectures that referenced them — a trademark notice
            should name what the project actually leans on, and after v57 that
            is Figma, Radix and W3C. */}
        <P className="text-fg-faint">
          {t('Figma is a trademark of Figma, Inc. Radix Colors and the W3C Design Tokens format are referenced as public standards; this project is not affiliated with, endorsed by, or sponsored by any of them.')}
        </P>
      </div>
    ),
  },
  ]
}

function MailIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m2 7 10 6 10-6" />
    </svg>
  )
}

function GlobeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" />
    </svg>
  )
}

function LinkedInIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6.94 5a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM7 8.48H3V21h4V8.48Zm6.32 0H9.34V21h3.94v-6.57c0-3.66 4.77-4 4.77 0V21H22v-7.93c0-6.17-7.06-5.94-8.68-2.91V8.48Z" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  )
}

/** Contact row — a link with its glyph, kept flat (no card) so the block reads
 *  as a signature rather than a promo panel. */
function ContactRow({ icon, label, href }: { icon: ReactNode; label: string; href: string }) {
  return (
    <a
      href={href}
      target={href.startsWith('mailto:') ? undefined : '_blank'}
      rel={href.startsWith('mailto:') ? undefined : 'noreferrer'}
      className="flex items-center gap-2.5 px-2 h-8 -mx-2 rounded-lg text-body text-fg-muted hover:text-fg hover:bg-elevated/60 transition-colors"
    >
      <span className="text-fg-faint flex-shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </a>
  )
}

/** One glyph per section, in the exact fixed order `SECTIONS` renders them —
 *  a plain object literal keyed by `AboutSection` so a missing entry is a
 *  TypeScript error, not a silently blank icon. Hand-drawn inline, same
 *  weight/size as `MailIcon`/`GlobeIcon` above: no icon package pulled in for
 *  five glyphs already this cheap to draw. */
function InfoGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.5v.01" />
    </svg>
  )
}
function LayersGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 3 3 8l9 5 9-5-9-5Z" />
      <path d="M3 12l9 5 9-5M3 16l9 5 9-5" />
    </svg>
  )
}
function DocGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M7 2.5h7l4 4V21H7z" />
      <path d="M14 2.5V7h4M9.5 12h6M9.5 16h6" />
    </svg>
  )
}
function ScaleGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 3v18M7 21h10M5 7h6M13 7h6" />
      <path d="M5 7 2.5 12a2.5 2.5 0 0 0 5 0L5 7ZM19 7l-2.5 5a2.5 2.5 0 0 0 5 0L19 7Z" />
    </svg>
  )
}
const SECTION_ICONS: Record<AboutSection, ComponentType<{ className?: string }>> = {
  platform: InfoGlyph,
  tokens: LayersGlyph,
  plugin: FigmaGlyph,
  docs: DocGlyph,
  legal: ScaleGlyph,
}

/** The five collapsible sections, on Radix's own `Accordion` primitive
 *  (`ui/accordion.tsx`) instead of a hand-rolled `motion.div` height
 *  animation. Shared by the About tab, the `/about` route and the mobile
 *  screen, so none of them can carry a stale copy of another's wording —
 *  `pad` is the one thing that differs per caller: the drawer sits flush
 *  inside a 440px sheet, the mobile page needs the same gutter its own
 *  header uses, and the About tab passes `px-0` because its own band already
 *  has one.
 *
 *  A leading icon per section (`SECTION_ICONS`) replaced an earlier
 *  monospace `01…06` index — same slot, a glyph instead of a number.
 *  The body used to cap at 500px measured width so paragraphs didn't run
 *  the full band's ~780px — reverted for the About tab specifically (see
 *  `bleed`), which is wide enough that the cap read as unused whitespace
 *  rather than a readability aid; the other two callers are already
 *  narrower than 500px in practice, so nothing there was relying on it. */
export function AboutAccordion({
  section, onSectionChange, pad = 'px-5', bleed,
}: {
  section: AboutSection | null
  onSectionChange: (s: AboutSection | null) => void
  pad?: string
  /** The About tab's own band already carries the horizontal gutter
   *  (`px-6` wrapping this whole component), so that caller passes
   *  `pad="px-0"` — but a trigger with zero horizontal padding means its
   *  hover fill hugs the label with no breathing room on either side,
   *  reading as cramped rather than a real list-row hover. `bleed` cancels
   *  the wrapper's own gutter with a negative margin and re-applies it as
   *  the trigger's OWN padding, so the hover fill spans edge-to-edge of the
   *  section instead of stopping at the text. Also drops the row divider —
   *  with a full-bleed hover already marking each row's bounds, an
   *  always-on hairline between them was a redundant second boundary. */
  bleed?: boolean
}) {
  const sections = useAboutSections()
  return (
    <Accordion
      type="single"
      collapsible
      value={section ?? ''}
      onValueChange={(v) => onSectionChange((v || null) as AboutSection | null)}
    >
      {sections.map((s) => {
        const Icon = SECTION_ICONS[s.key]
        return (
          <AccordionItem key={s.key} value={s.key} data-section={s.key} className={bleed ? 'border-b-0' : undefined}>
            <AccordionTrigger className={`${bleed ? '-mx-6 px-6' : pad} hover:bg-elevated/40`}>
              <Icon className="h-4 w-4 flex-shrink-0 mt-0.5 text-fg-faint" />
              <span className="flex-1 min-w-0">
                <span className="block text-ui font-medium text-fg leading-tight">{s.label}</span>
                <span className="block text-caption text-fg-faint leading-tight mt-1">{s.hint}</span>
              </span>
            </AccordionTrigger>
            <AccordionContent className={bleed ? '-mx-6 px-6' : pad}>
              {s.body}
            </AccordionContent>
          </AccordionItem>
        )
      })}
    </Accordion>
  )
}

/** Contact — always open. It's four lines, and hiding the author behind a
 *  disclosure in an "about" menu would be perverse.
 *
 *  `card` wraps it in the SAME bordered-rounded treatment `FeatureCard`
 *  (above) already uses — opt-in, defaulting off, so the drawer and
 *  `AboutScaffold`'s two callers (mobile notice, `/about`) keep the flat
 *  "signature, not a promo panel" look this component originally shipped
 *  with. Only `AboutHome` passes it: sitting at the foot of a page that's
 *  otherwise all cards (stats, Figma/Code/AI), a flat block read as
 *  unfinished rather than deliberately quiet. */
export function AboutContact({ pad = 'px-5', card = false }: { pad?: string; card?: boolean }) {
  const { t } = useI18n()
  const body = (
    <>
      <span className="text-caption font-semibold uppercase tracking-widest text-fg-faint">{t('Contact')}</span>
      <P>
        {t('Built and maintained by')} <span className="text-fg">Cesar Durango</span>,{' '}
        {t('design systems and design engineering.')}
      </P>
      <div className="flex flex-col mt-0.5">
        {CONTACT.linkedin && (
          <ContactRow icon={<LinkedInIcon />} label="LinkedIn" href={CONTACT.linkedin} />
        )}
        {CONTACT.x && (
          <ContactRow icon={<XIcon />} label="X" href={CONTACT.x} />
        )}
        <ContactRow icon={<GlobeIcon />} label={CONTACT.site} href={`https://${CONTACT.site}`} />
      </div>
    </>
  )

  if (card) {
    return (
      <div className={`${pad} py-6`}>
        <div className="flex flex-col gap-2 p-5 rounded-2xl border border-line bg-elevated/20">
          {body}
        </div>
      </div>
    )
  }

  return (
    <div className={`${pad} py-4 flex flex-col gap-2`}>
      {body}
    </div>
  )
}

/** A dashed-outline empty box — where a real screenshot goes once the user
 *  drops one in. Deliberately not generated art: swap the contents of this
 *  element for a real `<img src="…" className="w-full h-full object-cover
 *  rounded-2xl" />` (same className on the wrapper minus the dashed border)
 *  when the screenshot is ready. */
function ImagePlaceholder({ label, className }: { label: string; className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong bg-elevated/30 text-fg-faint',
        className,
      )}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="m21 15-5-5L5 21" />
      </svg>
      <span className="text-caption font-medium text-center px-4">{label}</span>
    </div>
  )
}

/** One number in the stats row, real counts, imported/derived, never typed
 *  by hand (see the callers below). `NumberTicker` (magicui) drives the
 *  count-up itself; `delay` staggers it roughly in step with the parent's
 *  own `statsContainer` stagger, so the digits and the fade/rise motion read
 *  as one movement, not two unrelated animations layered on top of each
 *  other. Falls back to the plain final value under reduced motion, and
 *  still lifts a couple px on hover, the same "this responds to you" cue
 *  the CTA button and the feature cards give — a real number shouldn't be
 *  the one inert thing on an otherwise interactive page. */
function Stat({ value, label, delay = 0 }: { value: number; label: string; delay?: number }) {
  const reduceMotion = useReducedMotion() ?? false
  return (
    <motion.div
      variants={statsItem}
      whileHover={reduceMotion ? undefined : { y: -2, transition: { duration: 0.15, ease: EASE } }}
      className="flex flex-col gap-0.5"
    >
      <span className="text-display font-semibold text-fg tabular-nums inline-flex items-baseline">
        {reduceMotion ? (
          value
        ) : (
          <NumberTicker value={value} delay={delay} className="text-display font-semibold text-fg tabular-nums" />
        )}
        +
      </span>
      <span className="text-caption text-fg-muted leading-snug">{label}</span>
    </motion.div>
  )
}

/** One tile in the differentiator's bento grid (`BentoGrid` from
 *  `ui/bento-grid` supplies the grid mechanics; this is a from-scratch tile,
 *  NOT that file's own `BentoCard` — `BentoCard` styles itself with plain
 *  shadcn tokens (`bg-background`, `text-neutral-700`…) that this project
 *  never defines, since the whole chrome runs on its own `bg-app`/`text-fg`
 *  scale instead. Rather than bolt a second, undefined palette onto the
 *  page, this reuses the SAME hover contract `DestinationRow` (Docs → Get
 *  started) and the plain `FeatureCard` this replaced already used: border,
 *  not shadow/scale theatrics. `span` carries the grid placement so the
 *  featured tile (AI agents) can run wider/taller than the other two — a
 *  cell's SIZE reflecting how much it actually has to say, not decoration
 *  for its own sake.
 *
 *  The oversized corner-watermark rendering of `Icon` (removed) was the
 *  reason `overflow-hidden` and `relative`/`z-10` existed on this component;
 *  both stay harmless no-ops now (z-10 has nothing to sit above, overflow
 *  has nothing left to clip) rather than being ripped out along with it —
 *  cutting them is a separate, purely-cosmetic cleanup, not required for
 *  this fix. */
function FeatureCard({
  title, Icon, span = '', children,
}: {
  title: string
  Icon: ComponentType<{ className?: string }>
  span?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'group relative flex flex-col gap-2.5 p-4 rounded-2xl border border-line bg-elevated/20 overflow-hidden transition-colors hover:border-line-strong hover:bg-elevated/40',
        span,
      )}
    >
      <span className="relative z-10 flex items-center gap-1.5 text-ui font-semibold text-fg">
        <Icon className="h-3.5 w-3.5 text-fg-faint" aria-hidden />
        {title}
      </span>
      <div className="relative z-10 flex flex-col gap-2.5 text-body leading-relaxed text-fg-muted">
        {children}
      </div>
    </div>
  )
}

/** `</>` — the "Code" tile's mark. Kept local (matches `MailIcon`/`GlobeIcon`
 *  above): one glyph, no reason to pull in an icon package for it. */
function CodeGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M9 8 4 12l5 4M15 8l5 4-5 4" />
    </svg>
  )
}

/** Hero stagger — the ONE choreographed moment this page gets (see the
 *  `animate` note on `AboutHome` below): mark → eyebrow → headline → CTA,
 *  each fading/rising in ~70ms after the last. `hidden`/`show` are picked up
 *  automatically by any `motion.*` child that doesn't declare its own
 *  initial/animate, so nothing but the outer container needs to know about
 *  reduced motion. */
const heroContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.02 } },
}
const heroItem = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
}

/** The stats row's own small stagger — starts while the hero's is still
 *  settling (`delayChildren`), so the two read as one continuous beat
 *  rather than a second, disconnected animation kicking in after a pause. */
const statsContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.25 } },
}
const statsItem = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } },
}

/** The About TAB's canvas — the workspace's landing surface for new visitors
 *  (see `Configurator.tsx`'s `hasOnboarded()` gate). Embedded in the
 *  flex-1/min-h-0 center column like any other tab's body, so it owns its own
 *  scroll region and a read-width column rather than reusing
 *  `AboutScaffold`'s `min-h-screen` page wrapper. Its CTA is an in-app action
 *  (`onStart` → `selectFoundation('color')`), not a link — unlike the mobile
 *  screen or `/about`, there's no "back to the app" to link to; this IS the
 *  app. Same `SECTIONS`/`AboutAccordion`/`AboutContact` as every other
 *  surface, so the pitch can't drift between them.
 *
 *  The hero copy is deliberately byte-identical to `/about`'s
 *  (`App.tsx`'s `AboutPage`) — one pitch, not two. It used to say a generic
 *  "Welcome to Escala Tokens" here, which is how the app ended up with a
 *  landing surface that never once said "AI": the real differentiator (a
 *  live MCP server so a coding agent stops inventing hex/spacing) was only
 *  ever a click away behind "Sync"/"Export", never stated up front. The
 *  eyebrow line above the headline, the stats row, and the differentiator
 *  block below all exist to fix exactly that gap — see the note above
 *  `SECTIONS.platform`'s body for the same fix applied to the shared
 *  accordion content `/about` and the mobile notice also render. */
export function AboutHome({
  onStart, onLearnAI, foundationCount,
}: {
  onStart: () => void
  /** Opens Docs → Get started → "Use in code" — the real guide, not a second
   *  one. That page absorbed the former "Use with AI" (its Connect section);
   *  `Configurator.tsx` wires this to `openDocs(GUIDE_CODE_KEY)`. */
  onLearnAI: () => void
  /** `FOUNDATIONS.length` from `Configurator.tsx` — that array is local
   *  there, so this is a prop rather than a duplicated constant. */
  foundationCount: number
}) {
  const { t } = useI18n()
  const [section, setSection] = useState<AboutSection | null>('platform')
  const reduceMotion = useReducedMotion() ?? false

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[880px] mx-auto flex flex-col">
        {/* ── Hero — the one staggered entrance this page gets. Runs once on
            tab mount (About remounts each time you switch back to it), never
            again — a landing that re-plays its own intro every render would
            wear out fast for a returning user. */}
        <motion.div
          initial={reduceMotion ? false : 'hidden'}
          animate="show"
          variants={heroContainer}
          className="flex flex-col items-center gap-3 px-6 pt-14 pb-10 text-center"
        >
          <motion.div variants={heroItem}>
            <BrandMark />
          </motion.div>
          <motion.span
            variants={heroItem}
            className="text-caption font-semibold uppercase tracking-widest text-fg-faint mt-1"
          >
            {t('For Figma, code, and your AI agent')}
          </motion.span>
          <motion.div variants={heroItem} className="flex flex-col gap-2 max-w-[520px]">
            <h1>
              {/* SUPERSEDES the earlier version of this headline, which kept
                  "Define your foundations before you" static and cycled only
                  the last word through 3 destinations on a repeating loop.
                  Replaced with a single, ONE-TIME reveal across the whole
                  sentence (`text` is a plain string here, not an array —
                  `isMulti` is false, so `repeat`/`fixedWidth` and everything
                  those existed to fix no longer apply: there is no width
                  tween between strings and no repeat cycle to go invisible
                  on, because there is only one string and it plays once).
                  This is a genuinely simpler animation, not a smaller version
                  of the old one — it plays on mount like the rest of the
                  hero's stagger, then settles and stays. */}
              <DiaTextReveal
                text={t('Define your foundations before you prompt.')}
                textColor="var(--fg)"
                colors={['#22d3ee', '#818cf8', '#f472b6', '#34d399']}
                className="text-[22px] font-semibold leading-snug"
              />
            </h1>
            <p className="text-ui leading-relaxed text-fg-muted">
              {t('Escala is where you set your design tokens once, then hand them to Figma, your code and any AI agent as one contract, so nothing invents its own colors, spacing or radius.')}
            </p>
          </motion.div>
          {/* Same RainbowButton chrome as `AIContextButton`'s "Copy context to
              Agents" (Docs) — one CTA treatment for the app's primary
              calls-to-action, not a one-off style invented for this page. */}
          <motion.div variants={heroItem} className="mt-2">
            <RainbowButton
              type="button"
              onClick={onStart}
              className="h-10 px-5 rounded-[13px] gap-1.5 text-ui font-semibold"
            >
              {t('Start building')}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </RainbowButton>
          </motion.div>
        </motion.div>

        {/* Workspace demo. NOT 16:9 despite 1280x720 pixel dimensions — the
            file carries a non-square sample aspect ratio (display_aspect_ratio
            762:539, measured via ffprobe and confirmed by the browser's own
            videoWidth/videoHeight, 1280x905), so the frame is sized to that
            real ratio rather than the placeholder's old 16:9 guess. Autoplay
            requires muted + playsInline (Safari/iOS policy); no native
            controls — this reads as a passive hero demo, not something a
            visitor operates. */}
        <div className="px-6">
          <video
            src="/video/escala-tokens-demo-lr.mp4"
            className="w-full h-auto rounded-2xl object-cover mb-14"
            style={{ aspectRatio: '762 / 539' }}
            autoPlay
            muted
            loop
            playsInline
            aria-label={t('Escala Tokens workspace demo')}
          />
        </div>

        {/* ── Stats — real counts, not marketing round numbers ── */}
        <motion.div
          initial={reduceMotion ? false : 'hidden'}
          animate="show"
          variants={statsContainer}
          className="grid grid-cols-2 sm:grid-cols-4 gap-6 px-6 pb-14 border-b border-line"
        >
          <Stat value={foundationCount} label={t('Foundations you configure')} delay={0} />
          <Stat value={COMPONENT_KEYS.length} label={t('Components in the catalogue')} delay={0.08} />
          <Stat value={ALL_ROLES.length} label={t('Semantic roles')} delay={0.16} />
          <Stat value={TOOL_SPECS.length} label={t('MCP tools your agent can call')} delay={0.24} />
        </motion.div>

        {/* ── The differentiator — the point of this whole page ── */}
        <div className="flex flex-col gap-6 px-6 py-14 border-b border-line">
          <div className="flex flex-col gap-2 max-w-[560px]">
            <span className="text-caption font-semibold uppercase tracking-widest text-accent-ui">
              {t('Built for the age of AI agents')}
            </span>
            <h2 className="text-[18px] font-semibold text-fg">
              {t('Your AI is guessing your colors right now.')}
            </h2>
            <p className="text-ui leading-relaxed text-fg-muted">
              {t('Ask Cursor, Claude Code or Copilot to build a button and it invents a hex, a spacing value, a radius, because it has never seen your system. Escala publishes a live, queryable contract instead: a Model Context Protocol (MCP) server your agent can call directly, plus a one-command install.')}
            </p>
          </div>

          {/* Bento: AI agents is the featured tile (2 cols × 2 rows, and
              first in DOM so the grid's default auto-flow places Figma/Code
              into the remaining right column on their own) — its cell is
              bigger because it has more to say, not for decoration's sake.
              `BentoGrid` (magicui) supplies only the grid mechanics here;
              see `FeatureCard`'s own note for why its sibling `BentoCard`
              isn't used. */}
          {/* `minmax(126px, auto)`, not a flat row height. A flat
              `auto-rows-*` caps a tile at that height, and these tiles carry
              `overflow-hidden` (they need it to clip the corner watermark),
              so copy that outgrows the row gets silently cut with nothing on
              screen saying so. It was already binding, if only just: allowing
              the rows to grow moved the Code tile 126px → 129px, i.e. its
              copy had been pressed 3px past its own bottom padding. The floor
              keeps the bento's proportions while the copy is short; `auto`
              means the next edit to that copy grows the row instead of
              vanishing into the clip.
              (What this does NOT fix, because it was never broken: the
              watermark hangs 18px below each tile by design — `-bottom-4` —
              so `scrollHeight - clientHeight === 18` on every tile is the
              decoration being clipped as intended, not lost text. Measure the
              last flow child against the padding box, not scrollHeight, or
              you will chase that 18px forever.)
              126px is written in px on purpose: `:root` is 18px here, so the
              `7rem` this replaced silently meant 126px anyway (see CLAUDE.md's
              root-font-size note) — same number, now stated honestly. */}
          <BentoGrid className="grid-cols-3 auto-rows-[minmax(126px,auto)] gap-4">
            <FeatureCard title={t('AI agents')} Icon={SparkleCircleIcon} span="col-span-2 row-span-2">
              <p>
                {t('A live MCP server with')} <C>resolve_token</C>, <C>check_contrast</C>,{' '}
                <C>list_components</C> {t('and more. Pick your editor, then run the steps or hand the whole setup to the agent:')}
              </p>

              {/* The real "Connect your agent" widget: client logos + an
                  MCP/PROMPT switch, rather than a second, drifting copy of it.
                  Same component Docs and the Export wizard use, every string
                  from `agentInstall.ts`. `variant="about"` trims it to the tabs,
                  the toggle and the first step; the rest is one click away. */}
              <AgentInstallPanel variant="about" />

              <button
                type="button"
                onClick={onLearnAI}
                className="self-start inline-flex items-center gap-1 rounded text-body font-semibold text-accent-ui hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg"
              >
                {t('Full steps, CSS, other tools and a repo in Docs')}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
            </FeatureCard>
            <FeatureCard title="Figma" Icon={FigmaGlyph}>
              <p>{t('Plugin + Live Sync. Variables land in the file you already design in.')}</p>
            </FeatureCard>
            <FeatureCard title={t('Code')} Icon={CodeGlyph}>
              <p>
                <C>variables.css</C>, W3C JSON, {t('or a GitHub push; code binds to roles, never a hex on a button.')}
              </p>
            </FeatureCard>
          </BentoGrid>
        </div>

        {/* ── Reference accordion — FULL WIDTH, same gutter as every band
            above (hero/stats/bento all run edge-to-edge of the 828px content
            box). This SUPERSEDES an earlier version that capped it at 640px
            for reading comfort: on screen that read as cut off — a section
            that visibly stopped ~190px short of where the bento cards above
            it ended, like a second, narrower page stapled under the first.
            Consistent width across every band beats a line-length rule that
            only this one section followed; the body copy is still short
            per-paragraph, not full-bleed walls of text, so the wider
            measure reads fine in practice.
            No footer here: Configurator.tsx's own Row 3 (the fixed hairline
            under every tab) already prints {COPYRIGHT_LINE} — repeating it
            here was the same line twice on screen at once. */}
        <div className="px-6 pb-8">
          <AboutAccordion section={section} onSectionChange={setSection} bleed />
          <AboutContact pad="px-0" card />
        </div>
      </div>
    </div>
  )
}

/** Full-page rendering of the same five sections — no drawer, no burger button.
 *  Used by App.tsx for two surfaces that both need the ENTIRE "what is this"
 *  story with no workspace behind it: the mobile screen (there's no adaptive
 *  layout to fall back to) and the `/about` route (a real, shareable,
 *  crawlable URL — the drawer has neither). One scaffold, one content array;
 *  only the lead text and outer visibility differ per caller. */
export function AboutScaffold({
  heading, subheading, wrapperClassName, ctaHref, ctaLabel,
}: {
  heading: string
  subheading: string
  /** e.g. `md:hidden` for the mobile-only caller; omitted = always visible. */
  wrapperClassName?: string
  /** Optional way back into the app — only meaningful when there IS an app to
   *  return to (the mobile notice has nowhere useful to send you). */
  ctaHref?: string
  ctaLabel?: string
}) {
  const { t } = useI18n()
  const [section, setSection] = useState<AboutSection | null>(null)

  return (
    <div className={cn('min-h-screen flex flex-col bg-app text-fg', wrapperClassName)}>
      <header className="flex flex-col items-center gap-4 px-6 pt-12 pb-8 text-center">
        <BrandMark />
        <div className="flex flex-col gap-1.5 max-w-[420px]">
          <h1 className="text-[15px] font-semibold text-fg">{heading}</h1>
          <p className="text-ui leading-relaxed text-fg-muted">{subheading}</p>
        </div>
        {ctaHref && (
          <a
            href={ctaHref}
            className="inline-flex items-center gap-1.5 mt-1 text-body font-semibold text-accent-ui hover:underline"
          >
            {ctaLabel ?? t('Open the configurator')}
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </a>
        )}
      </header>

      <div className="border-t border-line">
        <div className="px-5 pt-5 pb-1">
          <span className="text-caption font-semibold uppercase tracking-widest text-fg-faint">
            About
          </span>
          <p className="text-caption text-fg-faint mt-0.5">
            Design token infrastructure · schema v{TOKEN_SCHEMA_VERSION}
          </p>
        </div>
        <div className="mt-3 border-t border-line">
          <AboutAccordion section={section} onSectionChange={setSection} />
          <AboutContact />
        </div>
      </div>

      <footer className="mt-auto px-5 py-4 border-t border-line">
        <p className="text-caption text-fg-faint">
          {COPYRIGHT_LINE} · {t('Figma is a trademark of Figma, Inc.')}
        </p>
      </footer>
    </div>
  )
}

export default function AboutMenu({
  section,
  onSectionChange,
  onClose,
}: {
  /** The expanded section, or null for "all collapsed". Owned by the shell so
   *  a future entry point can open this drawer straight at a given section. */
  section: AboutSection | null
  onSectionChange: (s: AboutSection | null) => void
  onClose: () => void
}) {
  const { t } = useI18n()
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Opening straight at a section must SHOW that section, not just expand it
  // below the fold — Legal & data is the last of five rows.
  useEffect(() => {
    if (!section || !bodyRef.current) return
    const el = bodyRef.current.querySelector(`[data-section="${section}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [section])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onMouseDown={onClose}
      className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={t('About Escala Tokens')}
    >
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.24, ease: EASE }}
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-[440px] h-full flex flex-col bg-app border-l border-line shadow-2xl"
      >
        {/* Header — matches the shell's own brand row, so the drawer reads
            as an extension of the chrome rather than a floating sheet. */}
        <div
          className="flex items-center justify-between gap-3 px-4 flex-shrink-0 border-b border-line"
          style={{ height: TOP_NAV_H }}
        >
          <div className="min-w-0 truncate text-ui font-semibold text-fg">Escala Tokens</div>
          <button
            onClick={onClose}
            aria-label={t('Close menu')}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-fg-faint hover:text-fg hover:bg-elevated/60 transition-colors flex-shrink-0"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div ref={bodyRef} className="flex-1 min-h-0 overflow-y-auto">
          <AboutAccordion section={section} onSectionChange={onSectionChange} />
          <AboutContact />
        </div>

        <div className="flex-shrink-0 px-5 py-3 border-t border-line flex items-center justify-between gap-3">
          <p className="text-caption text-fg-faint truncate">
            {COPYRIGHT_LINE} · {t('Figma is a trademark of Figma, Inc.')}
          </p>
          {/* The one shareable link to this content — the drawer itself has no
              URL, so anyone asked "what is this?" gets /about instead. */}
          <a
            href="/about"
            target="_blank"
            rel="noreferrer"
            className="flex-shrink-0 text-caption font-semibold text-accent-ui hover:underline"
          >
            {t('Full page')} ↗
          </a>
        </div>
      </motion.aside>
    </motion.div>
  )
}
