// "Use it" — the one contract behind every element's three destinations.
//
// This is the evolution of what `ShipsAs` used to be. That block answered
// "what does this BECOME" as three hand-written naming patterns; this one
// answers "how do I CONSUME this", with the user's own resolved values, in
// the three places this platform actually ships to: Figma · Code · AI.
//
// Two rules it exists to keep:
//
// 1. **Derived, never enumerated.** There are ~58 components and 9
//    foundations. Nothing here may be authored per element — every string
//    below composes a builder that already exists (`buildSectionExport`,
//    `snippetFor`, `syncProjectId`, the catalogue's own `figmaSets`). If
//    `buildCSS` renames a variable, this block renames with it.
//
// 2. **One contract, three outputs.** The rendered block (`UseItBlock` in
//    `blocks.tsx`), the "Copy Page" markdown, and the MCP reply all read
//    THIS module, so a page can never claim something the export or the
//    agent would contradict — the same rule the export wizard already
//    follows ("everything derives from ONE generateTokenJSON() call").

import { buildSectionExport, cssExcerpt, type SectionKey } from '../../../lib/sectionExport'
import { syncProjectId } from '../../../lib/figmaSync'
import type { ComponentDef } from '../../../lib/componentCatalogue'
import type { FoundationDoc } from './foundationDocs'

export type UseItDestId = 'figma' | 'code' | 'ai'

export interface UseItDest {
  id: UseItDestId
  label: string
  /** The snippet shown in the pane — and copied VERBATIM. Never a summary of
   *  something longer that the copy button would silently expand. */
  code: string
  /** One line under the pane: the naming convention, or the precondition.
   *  Rendered through `t(note, noteVars)`, so it must be a STABLE source
   *  string — any live value goes in `noteVars` as a `{placeholder}`, never
   *  interpolated into the string itself, or every distinct value would be a
   *  separate dictionary key that no translation could ever match. */
  note?: string
  noteVars?: Record<string, string | number>
}

export interface UseIt {
  destinations: UseItDest[]
}

export const USE_IT_ID = 'use-it'
export const USE_IT_TITLE = 'Use it'
export const USE_IT_LEAD =
  'The same element in the three places this system ships to. Every value here is read from your own tokens by the same resolvers the export uses, so what you copy is what lands.'

/** The AI destination is the only one that needs the published system, so it
 *  is the only one that carries a precondition. Points at the guide that
 *  already exists rather than re-explaining install here. */
const AI_NOTE =
  'Needs the system published (Sync) and the MCP server connected — see Docs → Use in code.'

// ── Foundations ──────────────────────────────────────────────────────────────

/** A foundation key IS a `SectionKey` — the two lists are identical
 *  (color · typography · radius · spacing · shadow · grid · sizes · stroke ·
 *  icons). Narrowed here rather than cast at each call site so a future
 *  foundation that has no export section fails loudly instead of emitting an
 *  empty pane. */
function sectionKeyFor(doc: FoundationDoc): SectionKey | null {
  const keys: SectionKey[] = [
    'color', 'typography', 'radius', 'spacing', 'shadow', 'grid', 'sizes', 'stroke', 'icons',
  ]
  return keys.find((k) => k === doc.key) ?? null
}

export function useItForFoundation(doc: FoundationDoc): UseIt {
  const project = syncProjectId()
  const section = sectionKeyFor(doc)

  // Real, resolved, live: `buildSectionExport` reads the store itself, so
  // retinting the accent moves this pane in the same frame it moves the table.
  const css = section
    ? cssExcerpt(buildSectionExport(section, 'css'))
    : doc.usageCode

  return {
    destinations: [
      {
        id: 'figma',
        label: 'Figma',
        code: doc.ships.figma,
        note: 'Created by the Escala plugin on import, then kept current by Live Sync.',
      },
      {
        id: 'code',
        label: 'Code',
        code: css,
        note: 'variables.css: {css}   ·   tokens.json: {json}',
        noteVars: { css: doc.ships.css, json: doc.ships.json },
      },
      {
        id: 'ai',
        label: 'AI',
        // `doc.ships.json` already names this foundation's path in the
        // payload, so the "then read" hint is derived, not authored twice.
        code: [
          '# Your agent reads the published system instead of guessing a value.',
          `get_tokens    { "project": "${project}" }   # → ${doc.ships.json}`,
          `resolve_token { "project": "${project}", "token": "<role or primitive>" }`,
        ].join('\n'),
        note: AI_NOTE,
      },
    ],
  }
}

// ── Components ───────────────────────────────────────────────────────────────

/** `snippet` is the hero's own code — passed in rather than recomputed so the
 *  block can never show a different variant than the playground above it.
 *  Same reason `agentContextMarkdown` already takes it. */
export function useItForComponent(def: ComponentDef, snippet: string): UseIt {
  const project = syncProjectId()

  // A catalogue-first entry has no Figma set yet, and says so — the rule the
  // catalogue already follows everywhere else ("not in the Figma library
  // yet"). Never name a set that does not exist.
  const figma = def.figmaSets.length
    ? def.figmaSets.join('\n')
    : `${def.label} is not in the Figma library yet — it documents and exports here, and\nits component set lands once the plugin ships a gate for it.`

  return {
    destinations: [
      {
        id: 'figma',
        label: 'Figma',
        code: figma,
        note: def.figmaSets.length
          ? def.figmaSets.length === 1
            ? 'Component set the plugin unlocks for this key.'
            : 'Component sets the plugin unlocks for this key.'
          : 'The plugin is the source of truth for the catalogue — this entry is spec-only for now.',
      },
      {
        id: 'code',
        label: 'Code',
        code: snippet,
        note: 'Styled from your semantic roles — no hardcoded values. Catalogue key: {key}',
        noteVars: { key: def.key },
      },
      {
        id: 'ai',
        label: 'AI',
        code: [
          '# The catalogue, live — your agent never invents a component or a prop.',
          `get_component   { "key": "${def.key}" }`,
          `list_components { "category": "${def.category}" }`,
          `get_tokens      { "project": "${project}" }`,
        ].join('\n'),
        note: AI_NOTE,
      },
    ],
  }
}

// ── Markdown (the second of the three outputs) ───────────────────────────────

/** Serialised for "Copy Page" / the agent envelope. Same descriptor as the
 *  rendered block, so the two cannot drift. */
export function useItMarkdown(useIt: UseIt): string {
  const body = useIt.destinations
    .map((d) => [`### ${d.label}`, '', '```', d.code, '```', ...(d.note ? ['', `_${d.note}_`] : [])].join('\n'))
    .join('\n\n')
  return [`## ${USE_IT_TITLE}`, '', USE_IT_LEAD, '', body].join('\n')
}
