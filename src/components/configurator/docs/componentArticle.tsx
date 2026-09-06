// The component article — one canonical page per catalogue component, rendered
// by the docs site beside the foundation pages (`foundationArticle.tsx`).
//
// This is the merge of what used to be two top-level sections: Documentation
// (DocsView + DocArticle) and Components (ComponentDocPane + an inline master
// list). Both rendered the SAME `ComponentDef` from the SAME `SPECIMENS`
// registry through two independent trees, with two search states, two master
// lists, two prop tables, two copy buttons and two active-item states — so
// switching sections lost your place, and each side had capabilities the other
// lacked (docs had Examples/TOC/Copy-Page/Related, the catalogue had the live
// axis controls, icon slots and "Add to system"). All of it survives here.
//
// The HERO is the merge's one structural change: it is the interactive
// playground AND the doc's preview/code block at once, so the snippet you copy
// is the snippet for the variant on screen — which neither half could claim.

import { useState } from 'react'
import {
  COMPONENTS, COMPONENT_KEYS, FIGMA_SAMPLE_KEYS, isInFigmaSample,
  type ComponentDef, type VariantAxis,
} from '../../../lib/componentCatalogue'
import { useI18n } from '../../../lib/i18n'
import { agentContextMarkdown } from '../../../lib/agentContext'
import { PHOSPHOR_LIBRARY } from '../../../lib/iconLibraries'
import { withAlpha } from '../../../lib/colorUtils'
import type { PreviewTokens } from '../../preview/ButtonPreview'
import { SPECIMENS, snippetFor, ICON_SLOTS, PANEL_COMPONENTS, type AxisValues, type IconOpts } from './specimens'
import {
  CopyButton, CopyAgentContextButton, DocHeader, DocTitle, DocSection, SectionHeading, BlockChrome,
  ViewToggle, CodePane, CodeBlock, PreviewCode, ExampleCell, Pager, UseItBlock,
  type TocEntry,
} from './blocks'
import { useItForComponent, useItMarkdown, USE_IT_ID, USE_IT_TITLE, USE_IT_LEAD } from './useIt'

// Categories whose components respond to pointer/keyboard — they get the
// standard keyboard-interaction table in Accessibility.
const INTERACTIVE_CATEGORIES = new Set(['Button & Actions', 'Form Controls', 'Navigation'])

const KEYBOARD_ROWS: { key: string; description: string }[] = [
  { key: 'Tab', description: 'Moves focus to the component (and between its focusable parts).' },
  { key: 'Space', description: 'Activates the focused control.' },
  { key: 'Enter', description: 'Activates the focused control.' },
]

/** First value of each axis = the plugin's default variant. One definition —
 *  the two merged files each carried their own copy of this expression. */
function axisDefaults(def: ComponentDef): AxisValues {
  return Object.fromEntries(def.axes.map((a) => [a.name, a.values[0]]))
}

/** Which combination of the variant matrix `values` is, 1-based, in the same
 *  row-major order the Figma plugin generates the set in. The old catalogue
 *  badge always said "1 of N" no matter what you had selected. */
function variantIndex(def: ComponentDef, values: AxisValues): number {
  return def.axes.reduce((acc, a) => acc * a.values.length + Math.max(0, a.values.indexOf(values[a.name])), 0) + 1
}

function fileNameFor(def: ComponentDef): string {
  return `${def.key.toLowerCase().replace(/\s+/g, '-')}.tsx`
}
// ── Axis controls (the catalogue playground's rail) ──────────────────────────

function AxisControl({ axis, value, onChange }: { axis: VariantAxis; value: string; onChange: (v: string) => void }) {
  // Boolean-shaped axes (True/False) read better as a switch-like pill pair.
  const isBool = axis.values.length === 2 && axis.values.includes('True') && axis.values.includes('False')
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-line last:border-b-0">
      <span className="text-xs text-fg-muted">{axis.name}</span>
      {isBool ? (
        <button
          role="switch"
          aria-checked={value === 'True'}
          aria-label={axis.name}
          onClick={() => onChange(value === 'True' ? 'False' : 'True')}
          className={`relative w-9 h-5 rounded-full transition-colors ${value === 'True' ? 'bg-fg' : 'bg-line-strong'}`}
        >
          <span
            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white dark:bg-app shadow transition-all ${value === 'True' ? 'left-[18px]' : 'left-0.5'}`}
          />
        </button>
      ) : (
        <div className="relative">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-label={axis.name}
            className="appearance-none text-xs font-medium text-fg bg-surface border border-line rounded-lg pl-2.5 pr-7 py-1.5 outline-none focus:border-line-strong cursor-pointer"
          >
            {axis.values.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
          <svg
            width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
            className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-fg-faint"
            aria-hidden
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      )}
    </div>
  )
}

function OptionSwitch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-line last:border-b-0">
      <span className="text-xs text-fg-muted">{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-full transition-colors ${checked ? 'bg-fg' : 'bg-line-strong'}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white dark:bg-app shadow transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </button>
    </div>
  )
}
// ── Hero: the live playground, with the doc block's Preview/Code toggle ──────
//
// `values`/icon toggles and the `snippet` they produce are OWNED by
// `ComponentArticle`, not by this component — see the note there. Hero used
// to hold all of it locally, which is exactly how "the snippet you copy is
// the snippet on screen" stopped being true: `ComponentArticle` had no way to
// reach Hero's internal state, so `heroCode` (the string handed to Usage,
// "Use it", and the "Copy context to Agents" button) was computed from
// `axisDefaults(def)` instead — always Brand/Solid/MD/Default, regardless of
// what the playground actually showed. Verified live: setting Color=Danger,
// Style=Ghost repainted the Preview correctly (measured computed style:
// transparent fill, `#be3a2f` ink) while every one of those three consumers
// kept printing `color="brand" style="solid"`. One shared snippet, computed
// once by the parent and passed down, is what makes that impossible again.
function Hero({
  def, tokens, values, onValuesChange, icons, leadingIcon, onLeadingIconChange, trailingIcon, onTrailingIconChange, snippet,
}: {
  def: ComponentDef
  tokens: PreviewTokens
  values: AxisValues
  onValuesChange: (v: AxisValues) => void
  icons?: IconOpts
  leadingIcon: boolean
  onLeadingIconChange: (v: boolean) => void
  trailingIcon: boolean
  onTrailingIconChange: (v: boolean) => void
  /** Computed once by `ComponentArticle` from these same `values`/`icons` —
   *  Hero never recomputes its own copy. */
  snippet: string
}) {
  const { t } = useI18n()
  const [view, setView] = useState<'preview' | 'code'>('preview')

  const slots = ICON_SLOTS[def.key]
  const Specimen = SPECIMENS[def.key]
  const variantCount = def.axes.reduce((n, a) => n * a.values.length, 1)
  const hasControls = def.axes.length > 0 || Boolean(slots)

  // A colored blob backdrop so the translucent panel treatment (blur + alpha)
  // has something behind it to visibly soften — a flat canvas can't show it.
  // `backgroundColor`/`backgroundImage` (not the `background` shorthand) so
  // toggling the pattern on/off never mixes shorthand and longhand styles.
  const showPattern = tokens.panelBackground === 'translucent' && PANEL_COMPONENTS.has(def.key)
  const canvasStyle = {
    backgroundColor: tokens.surface,
    backgroundImage: showPattern
      ? [
          `radial-gradient(circle at 15% 20%, ${withAlpha(tokens.brandSolid, 0.55)}, transparent 42%)`,
          `radial-gradient(circle at 85% 15%, ${withAlpha(tokens.successColor ?? '#17b26a', 0.5)}, transparent 40%)`,
          `radial-gradient(circle at 75% 85%, ${withAlpha(tokens.warningColor ?? '#f79009', 0.45)}, transparent 45%)`,
          `radial-gradient(circle at 20% 85%, ${withAlpha(tokens.infoColor ?? '#2e90fa', 0.4)}, transparent 40%)`,
        ].join(', ')
      : 'none',
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      <div className="flex-1 min-w-0 rounded-xl border border-line overflow-hidden">
        <BlockChrome
          left={
            <div className="flex items-center gap-2.5 min-w-0">
              <ViewToggle view={view} onChange={setView} />
              <span className="text-caption font-mono text-fg-faint truncate">{fileNameFor(def)}</span>
            </div>
          }
        >
          <CopyButton text={snippet} label={t('Copy snippet')} />
        </BlockChrome>

        {view === 'preview' ? (
          <div
            className="min-h-[300px] flex items-center justify-center p-10 relative overflow-hidden"
            style={canvasStyle}
          >
            {Specimen ? (
              <Specimen t={tokens} v={values} icons={icons} />
            ) : (
              <span className="text-xs text-fg-faint">{t('No live preview for this component yet.')}</span>
            )}
            {variantCount > 1 && (
              <span className="absolute top-3 right-3 text-mini px-2 py-0.5 rounded-full bg-elevated/80 text-fg-faint border border-line">
                {t('{index} of {total} variants', { index: variantIndex(def, values), total: variantCount })}
              </span>
            )}
          </div>
        ) : (
          // The snippet tracks the controls, so "Code" is the code for the
          // variant on screen — the reason the two blocks were worth fusing.
          <CodePane code={snippet} minH={300} />
        )}
      </div>

      {hasControls && (
        <div className="lg:w-60 flex-shrink-0">
          <div className="rounded-xl border border-line bg-surface/40 px-4 py-2">
            {def.axes.map((axis) => (
              <AxisControl
                key={axis.name}
                axis={axis}
                value={values[axis.name]}
                onChange={(v) => onValuesChange({ ...values, [axis.name]: v })}
              />
            ))}
            {slots && (
              <>
                {def.axes.length > 0 && <div className="border-t border-line my-1" />}
                <OptionSwitch label={t('Leading icon')} checked={leadingIcon} onChange={onLeadingIconChange} />
                <OptionSwitch label={t('Trailing icon')} checked={trailingIcon} onChange={onTrailingIconChange} />
              </>
            )}
          </div>
          {slots ? (
            <p className="text-mini text-fg-faint leading-relaxed px-1 pt-2">
              {t('Icons come from')} <span className="font-medium text-fg-muted">{PHOSPHOR_LIBRARY.label}</span>.
            </p>
          ) : (
            <p className="text-mini text-fg-faint leading-relaxed px-1 pt-2">
              {t('Same axes as the Figma variant set the plugin generates.')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
// ── Doc sections ─────────────────────────────────────────────────────────────
function AxisExample({ def, axis, tokens }: { def: ComponentDef; axis: VariantAxis; tokens: PreviewTokens }) {
  const { t } = useI18n()
  const Specimen = SPECIMENS[def.key]
  const defaults = axisDefaults(def)
  const code = axis.values
    .map((value) => snippetFor(def, { ...defaults, [axis.name]: value }))
    .join('\n\n')
  return (
    <div className="flex flex-col gap-2.5">
      <h4 id={`axis-${axis.name.toLowerCase()}`} className="text-sm font-semibold text-fg scroll-mt-4">{axis.name}</h4>
      <p className="text-xs text-fg-muted leading-relaxed">
        <code className="font-mono text-caption">{axis.name}</code>{' '}
        {axis.values.length === 1
          ? t('has {count} option —', { count: axis.values.length })
          : t('has {count} options —', { count: axis.values.length })}{' '}
        {axis.values.join(' · ')}. {t('Defaults to')} <code className="font-mono text-caption">{axis.values[0]}</code>
        {t('; each option maps 1:1 to the Figma variant axis the plugin generates.')}
      </p>
      <PreviewCode surface={tokens.surface} code={code}>
        {Specimen
          ? axis.values.map((value) => (
              <ExampleCell key={value} label={value}>
                {Specimen({ t: tokens, v: { ...defaults, [axis.name]: value } })}
              </ExampleCell>
            ))
          : <span className="text-xs text-fg-faint">{t('No live preview for this component yet.')}</span>}
      </PreviewCode>
    </div>
  )
}

function KeyboardTable() {
  const { t } = useI18n()
  return (
    <div className="rounded-xl border border-line overflow-hidden">
      <div className="grid grid-cols-[100px_1fr] gap-4 px-4 py-2 border-b border-line bg-surface/60 text-mini uppercase tracking-wider text-fg-faint">
        <span>{t('Key')}</span>
        <span>{t('Description')}</span>
      </div>
      <div className="divide-y divide-line">
        {KEYBOARD_ROWS.map((row) => (
          <div key={row.key} className="grid grid-cols-[100px_1fr] gap-4 px-4 py-2.5 items-center">
            <kbd className="justify-self-start text-mini font-mono px-1.5 py-0.5 rounded border border-line-strong bg-elevated text-fg-muted">
              {row.key}
            </kbd>
            <span className="text-xs text-fg-muted leading-relaxed">{t(row.description)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** The one props table. The catalogue's own 2-column variant is gone: same
 *  data, fewer columns, so keeping it only created a place to drift. */
function ApiPropsTable({ def }: { def: ComponentDef }) {
  const { t } = useI18n()
  return (
    <div className="rounded-xl border border-line overflow-hidden">
      <div className="grid grid-cols-[1fr_1fr_1.6fr] gap-4 px-4 py-2 border-b border-line bg-surface/60 text-mini uppercase tracking-wider text-fg-faint">
        <span>{t('Prop')}</span>
        <span>{t('Type')}</span>
        <span>{t('Description')}</span>
      </div>
      <div className="divide-y divide-line">
        {def.props.map((prop) => (
          <div key={prop.name} className="grid grid-cols-[1fr_1fr_1.6fr] gap-4 px-4 py-2.5 items-start">
            <code className="text-xs text-[#5AADFF] font-mono break-all">{prop.name}</code>
            <code className="text-mini text-fg-faint font-mono break-all" title={prop.type}>{prop.type}</code>
            <p className="text-xs text-fg-muted leading-snug">{prop.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function ApiVariantsTable({ def }: { def: ComponentDef }) {
  const { t } = useI18n()
  return (
    <div className="rounded-xl border border-line overflow-hidden">
      <div className="grid grid-cols-[1fr_2fr_1fr] gap-4 px-4 py-2 border-b border-line bg-surface/60 text-mini uppercase tracking-wider text-fg-faint">
        <span>{t('Variant')}</span>
        <span>{t('Options')}</span>
        <span>{t('Default')}</span>
      </div>
      <div className="divide-y divide-line">
        {def.axes.map((axis) => (
          <div key={axis.name} className="grid grid-cols-[1fr_2fr_1fr] gap-4 px-4 py-2.5 items-start">
            <code className="text-xs text-[#5AADFF] font-mono">{axis.name}</code>
            <div className="flex flex-wrap gap-1">
              {axis.values.map((v) => (
                <code key={v} className="text-mini font-mono px-1.5 py-0.5 rounded bg-elevated/80 border border-line text-fg-muted">
                  "{v}"
                </code>
              ))}
            </div>
            <code className="text-mini font-mono text-fg-muted">"{axis.values[0]}"</code>
          </div>
        ))}
      </div>
    </div>
  )
}

export function FigmaShipList({ component }: { component: ComponentDef }) {
  const { t } = useI18n()
  const variantCount = component.axes.reduce((n, a) => n * a.values.length, 1)
  // Every key ships a full spec — props, axes, tokens, accessibility — into
  // tokens.json and the agent bundle regardless of this check. This block is
  // only about whether the LIVE Figma import additionally renders it as a
  // real component node today. See FIGMA_SAMPLE_KEYS in componentCatalogue.ts.
  if (!isInFigmaSample(component.key)) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-surface/40 p-4 flex items-center gap-2.5">
        <FigmaGlyph className="text-fg-faint flex-shrink-0" />
        <p className="text-caption text-fg-faint leading-relaxed">
          {/* Both counts are DERIVED. They were hardcoded "58" and "9" —
              correct on the day they were typed and one catalogue entry away
              from being a lie, which is the same drift that left the About
              page claiming 39 semantic roles against a real 64. */}
          {t("Not rendered in Figma yet — building all {count} specs as real variants locks the file on import, so today this one ships as a full spec (props, tokens, accessibility) in", { count: COMPONENT_KEYS.length })} <code className="font-mono">tokens.json</code> {t("and your coding agent's context, not as a component node in the file.")}
        </p>
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-line bg-surface/40 p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <FigmaGlyph className="text-fg-muted" />
        <p className="text-xs font-semibold text-fg">{t('Ships in Figma')}</p>
        <span className="text-mini text-fg-faint ml-auto">
          {component.figmaSets.length === 1
            ? t('{count} set', { count: component.figmaSets.length })
            : t('{count} sets', { count: component.figmaSets.length })}
          {variantCount > 1 && ` · ${t('{count} variants', { count: variantCount })}`}
        </span>
      </div>
      <p className="text-caption text-fg-faint leading-relaxed">
        {t("One of the {count} components on the '⬡ Components Overview' sample sheet every import builds — every fill, stroke and radius bound to your variables (component → semantic → primitive):", { count: FIGMA_SAMPLE_KEYS.length })}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {component.figmaSets.map((s) => (
          <span key={s} className="text-caption px-2 py-0.5 rounded-md bg-elevated/80 text-fg-muted border border-line">
            {s}
          </span>
        ))}
      </div>
    </div>
  )
}

function FigmaGlyph({ className }: { className?: string }) {
  return (
    <svg width="10" height="14" viewBox="0 0 38 57" fill="currentColor" className={className} aria-hidden>
      <path d="M9.5 57C14.7467 57 19 52.7467 19 47.5V38H9.5C4.25329 38 0 42.2533 0 47.5C0 52.7467 4.25329 57 9.5 57Z" />
      <path d="M0 28.5C0 23.2533 4.25329 19 9.5 19H19V38H9.5C4.25329 38 0 33.7467 0 28.5Z" />
      <path d="M0 9.5C0 4.25329 4.25329 0 9.5 0H19V19H9.5C4.25329 19 0 14.7467 0 9.5Z" />
      <path d="M19 0H28.5C33.7467 0 38 4.25329 38 9.5C38 14.7467 33.7467 19 28.5 19H19V0Z" />
      <path d="M38 28.5C38 33.7467 33.7467 38 28.5 38C23.2533 38 19 33.7467 19 28.5C19 23.2533 23.2533 19 28.5 19C33.7467 19 38 23.2533 38 28.5Z" />
    </svg>
  )
}

function RelatedComponents({ def, onOpen }: { def: ComponentDef; onOpen: (c: ComponentDef) => void }) {
  const { t } = useI18n()
  const related = COMPONENTS.filter((c) => c.category === def.category && c.key !== def.key).slice(0, 4)
  if (!related.length) return null
  return (
    <section className="flex flex-col gap-3">
      <SectionHeading id="related">{t('Related Components')}</SectionHeading>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {related.map((c) => (
          <button
            key={c.key}
            onClick={() => onOpen(c)}
            className="text-left rounded-xl border border-line bg-surface/40 p-4 hover:border-line-strong transition-colors"
          >
            <p className="text-xs font-semibold text-fg">{c.label}</p>
            <p className="text-caption text-fg-faint leading-relaxed mt-1 line-clamp-2">{t(c.description)}</p>
          </button>
        ))}
      </div>
    </section>
  )
}
// ── "On this page" TOC (right rail) ──────────────────────────────────────────

type Translate = (source: string, vars?: Record<string, string | number>) => string

export function componentToc(def: ComponentDef, t: Translate = (s) => s): TocEntry[] {
  const entries: TocEntry[] = [
    { id: 'description', label: t('Description') },
    { id: USE_IT_ID, label: t(USE_IT_TITLE) },
    { id: 'usage', label: t('Usage') },
  ]
  if (def.axes.length) {
    entries.push({ id: 'examples', label: t('Examples') })
    // Axis names are the plugin's own variant-set labels (`Color`, `Size`,
    // `State`) — mirrored from Figma, so they stay verbatim, the same rule
    // component display names follow.
    def.axes.forEach((a) => entries.push({ id: `axis-${a.name.toLowerCase()}`, label: a.name, sub: true }))
  }
  entries.push(
    { id: 'accessibility', label: t('Accessibility') },
    { id: 'figma', label: t('Figma') },
    { id: 'related', label: t('Related Components') },
    { id: 'api', label: t('API Reference') },
  )
  return entries
}
// ── The page ─────────────────────────────────────────────────────────────────

export function ComponentArticle({
  def, tokens, onOpen,
}: { def: ComponentDef; tokens: PreviewTokens; onOpen: (c: ComponentDef) => void }) {
  const { t } = useI18n()
  // The live playground's own selection — OWNED here, not inside `Hero` (see
  // that component's note). This is what makes "the snippet you copy is the
  // snippet on screen" actually true: every downstream consumer of
  // `heroCode` — Usage's import block, "Use it"'s Code tab, and the
  // Copy-context-to-Agents markdown — reads the SAME `values`/`icons` the
  // Preview panel renders from, computed once, below.
  const [values, setValues] = useState<AxisValues>(() => axisDefaults(def))
  const [leadingIcon, setLeadingIcon] = useState(false)
  const [trailingIcon, setTrailingIcon] = useState(false)
  const slots = ICON_SLOTS[def.key]
  const icons = slots
    ? { prefix: PHOSPHOR_LIBRARY.key, leading: leadingIcon, trailing: trailingIcon }
    : undefined

  const heroCode = snippetFor(def, values, icons)
  const usageCode = `import { ${def.key.replace(/\s+/g, '')} } from "@/components/ui/${def.key.toLowerCase().replace(/\s+/g, '-')}"\n\n${heroCode}`
  // ONE descriptor, rendered below AND appended to the agent brief — the
  // second of the three outputs (page · markdown · MCP). Composed here rather
  // than inside `agentContextMarkdown` because that lives in `lib/`, and lib
  // importing a `components/` module would invert the layering.
  const useIt = useItForComponent(def, heroCode)
  const idx = COMPONENTS.findIndex((c) => c.key === def.key)
  const prev = COMPONENTS[idx - 1]
  const next = COMPONENTS[idx + 1]

  return (
    <div className="flex flex-col gap-8">
      <DocHeader
        section={t('Components')}
        kind={t(def.category)}
        title={def.label}
        actions={
          <CopyAgentContextButton
            text={`${agentContextMarkdown(def, heroCode, tokens)}\n\n${useItMarkdown(useIt)}`}
          />
        }
      />

      {/* `def.label` is NOT translated: it is the plugin's own component name
          and the key a designer matches against the Figma variant set. Its
          category and prose are ours, so they are. */}
      <DocTitle title={def.label} eyebrow={t(def.category)} lead={t(def.description)} />

      {/* Hero — live playground + code. Axis/icon state lives in THIS
          component now (see above), reset per component the same way every
          other piece of this page's state already is: `ComponentsView` keys
          its wrapping `motion.div` on `def.key`, remounting the whole
          article — no separate key needed here any more. */}
      <Hero
        def={def}
        tokens={tokens}
        values={values}
        onValuesChange={setValues}
        icons={icons}
        leadingIcon={leadingIcon}
        onLeadingIconChange={setLeadingIcon}
        trailingIcon={trailingIcon}
        onTrailingIconChange={setTrailingIcon}
        snippet={heroCode}
      />

      {/* Use it — the same Figma · Code · AI block every foundation page
          carries, so the two page kinds answer "how do I consume this" the
          same way. Sits before Usage for the reason Create UI puts
          Installation there: you reach for it before the prose. */}
      <DocSection id={USE_IT_ID} title={t(USE_IT_TITLE)} description={t(USE_IT_LEAD)}>
        <UseItBlock useIt={useIt} />
      </DocSection>

      {/* Usage — the "when to use" prose the catalogue showed in a card, plus
          the import snippet Documentation showed. Same section, one place. */}
      <DocSection id="usage" title={t('Usage')} description={t(def.usage)}>
        <CodeBlock file={fileNameFor(def)} code={usageCode} />
      </DocSection>

      {/* Examples — one block per variant axis */}
      {def.axes.length > 0 && (
        <section className="flex flex-col gap-5">
          <SectionHeading id="examples">{t('Examples')}</SectionHeading>
          {def.axes.map((axis) => (
            <AxisExample key={axis.name} def={def} axis={axis} tokens={tokens} />
          ))}
        </section>
      )}

      {/* Accessibility */}
      <section className="flex flex-col gap-2.5">
        <SectionHeading id="accessibility">{t('Accessibility')}</SectionHeading>
        {INTERACTIVE_CATEGORIES.has(def.category) && <KeyboardTable />}
        <p className="text-ui text-fg-muted leading-relaxed">{t(def.accessibility)}</p>
      </section>

      {/* Ships in Figma */}
      <section className="flex flex-col gap-2.5">
        <SectionHeading id="figma">{t('Figma')}</SectionHeading>
        <FigmaShipList component={def} />
      </section>

      {/* Related */}
      <RelatedComponents def={def} onOpen={onOpen} />

      {/* API Reference */}
      <section className="flex flex-col gap-3">
        <SectionHeading id="api">{t('API Reference')}</SectionHeading>
        {def.props.length > 0 && (
          <>
            <p className="text-caption uppercase tracking-wider text-fg-faint">{t('Props')}</p>
            <ApiPropsTable def={def} />
          </>
        )}
        {def.axes.length > 0 && (
          <>
            <p className="text-caption uppercase tracking-wider text-fg-faint mt-1">{t('Variants')}</p>
            <ApiVariantsTable def={def} />
          </>
        )}
      </section>

      <Pager
        prev={prev && { key: prev.key, label: prev.label }}
        next={next && { key: next.key, label: next.label }}
        onOpen={(key) => { const c = COMPONENTS.find((x) => x.key === key); if (c) onOpen(c) }}
      />
    </div>
  )
}
