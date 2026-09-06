// Changelog — moved here from the About accordion (see AboutMenu.tsx): "what
// shipped when" is documentation, not corporate/about copy, so it belongs
// under the Docs destination next to the rest of the token reference rather
// than buried in a drawer six clicks from the workspace.
//
// **Entries are DATA (`ENTRIES`), not JSX.** They used to be hand-written
// `<Entry>` elements with the summary as inline children, which put every word
// of this page outside `t()`'s reach — the page stayed English while its
// chrome spoke three languages. One array, mapped, and the summaries
// translate like everything else.
//
// Dates are release dates read off the project's own git history, never
// invented milestones. When you ship something worth a line here, add it —
// this page sat frozen at 2026-07-29 for five weeks while the alpha layer,
// System Styles, the three radius axes and the theme workspace all landed,
// and a changelog that stops is worse than no changelog: it reads as a dead
// project rather than an undocumented one.

import { COMPONENT_KEYS } from '../../../lib/componentCatalogue'
import { useI18n } from '../../../lib/i18n'
import { DocHeader, DocTitle, Prose, type TocEntry } from './blocks'

export const CHANGELOG_KEY = '__changelog'

type Translate = (source: string, vars?: Record<string, string | number>) => string

export function changelogToc(t: Translate = (source) => source): TocEntry[] {
  return [{ id: 'description', label: t('Overview') }]
}

/** `vars` is only for the handful of entries that quote a live count — the
 *  catalogue size, say — so the number can never drift from the array it
 *  describes the way the About page's role count once did. */
const ENTRIES: { date: string; text: string; vars?: Record<string, string | number> }[] = [
  {
    date: '2026-09-05',
    text: 'Theme-scoped Figma sync: the handshake keys on the file name, and Light/Dark modes travel with it. Figma sync moved into the canvas header; the rail footer became a scoped Reset.',
  },
  {
    date: '2026-09-04',
    text: 'Tokens became searchable and inspectable from the workspace. Dark chrome retuned against measured OKLab lightness. Exports now ship only the primitive families the themes actually reference.',
  },
  {
    date: '2026-09-03',
    text: 'Radius split into three independent axes — Boxes, Fields, Selectors — so rounding a checkbox no longer rounds the card with it. Each System Style gained its own severity seeds and Phosphor icon weight.',
  },
  {
    date: '2026-09-02',
    text: 'Every dark theme got its brand colour back: the solid fill is solved outward from the anchor instead of walking to the near-white end of the ramp, and hover and pressed are distinct states again.',
  },
  {
    date: '2026-08-26',
    text: 'Alpha primitives (`black-a` / `white-a`) landed and now back 16 semantic roles. Contrast gaps across the Categorical roles were audited and closed.',
  },
  {
    date: '2026-08-26',
    text: 'The retired semantic architectures were deleted. Astryx, shadcn/ui, Apple-HIG Vibrancy, Material-3 Tonal and IBM Carbon are gone; `Categorical` is the one architecture, and the whole app is built around it.',
  },
  {
    date: '2026-08-25',
    text: 'Artefacts tab: five composed screens built from your own tokens, at true mobile size. `Ships as` became a live `Use it` block (Figma · Code · AI) that reads real values instead of naming patterns.',
  },
  {
    date: '2026-08-24',
    text: 'About became the first-visit landing tab and gained a shareable `/about` page. Components that are spec-only now say so instead of implying a Figma set that does not exist.',
  },
  {
    date: '2026-07-29',
    text: 'Escala JSON export always ships the full plugin contract. Architecture-aware semantic preview; dark-mode tone inversions fixed across the role catalogue.',
  },
  {
    date: '2026-07-29',
    text: 'Picker Color tab, and the export flow gained system identity: name, save and GitHub status at the payoff step.',
  },
  {
    date: '2026-07-28',
    text: 'Variables-first navigation, guided token creation, sticky category preview.',
  },
  {
    date: '2026-07-27',
    text: 'Radix two-scale primitives: every family ships a light ramp and a dark twin. Editable semantic architectures, the guided export wizard, and the top-nav workspace.',
  },
  {
    date: '2026-07-20',
    text: 'Semantic architecture picker (Flat · Categorical · Vibrancy · Tonal), Save & Share hub, import and new-system flows. Three of those four projections were retired on 2026-08-26.',
  },
  { date: '2026-07-18', text: 'Color became a multi-tab hub; theme-aware brand lockup.' },
  {
    date: '2026-07-16',
    text: 'Dark-appearance neutral ramps, accent-derived gradients, Variables/Styles rail split.',
  },
  { date: '2026-07-13', text: 'Gradients foundation with a full HSV picker.' },
  {
    date: '2026-07-12',
    text: 'Documentation tab; catalogue expanded to {count} components.',
    vars: { count: COMPONENT_KEYS.length },
  },
  {
    date: '2026-07-08',
    text: 'Interactive component playground wired to the plugin contract.',
  },
  {
    date: '2026-07-07',
    text: 'Export normalizes semantics so every token aliases a real primitive.',
  },
  { date: '2026-06-14', text: 'Figma sync pipeline: per-system scoping and theme columns.' },
]

export function ChangelogArticle() {
  const { t } = useI18n()
  return (
    <div className="flex flex-col gap-8">
      <DocHeader section={t('Docs')} kind={t('Get started')} title={t('Changelog')} actions={null} />
      <DocTitle
        title={t('Changelog')}
        eyebrow={t('Reference')}
        lead={t("What shipped, and when — release dates from the project's own history.")}
      />
      <div className="flex flex-col max-w-2xl">
        {ENTRIES.map((entry, i) => (
          <div
            key={`${entry.date}-${i}`}
            className="flex gap-3 py-1.5 border-b border-line last:border-b-0"
          >
            {/* nowrap + room for all 10 chars: at this root font-size an ISO
                date wrapped to "2026-07-" / "29" in a narrower column. */}
            <span className="flex-shrink-0 w-[78px] text-caption font-mono tabular-nums whitespace-nowrap text-fg-faint pt-[2px]">
              {entry.date}
            </span>
            <span className="min-w-0">
              {/* `Prose` so a backticked token name in an entry renders as
                  inline code rather than printing its own backticks. */}
              <Prose text={t(entry.text, entry.vars)} className="text-body leading-relaxed" />
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
