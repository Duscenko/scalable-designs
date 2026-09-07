// Icon library standard.
//
// Escala embeds ONE set: Phosphor Icons (glyphs pre-built from
// `@phosphor-icons/core`, committed under `src/generated/` — Phosphor is MIT,
// so redistributing them is fine, unlike the Untitled set this replaced). The
// other GitHub repos are AI-context recommendations — not bundled, they don't
// drive the live browser. See `ICON_AI_SOURCES`.

export interface IconLibraryDef {
  key: string
  label: string
  description: string
  npm: string
  site: string
  repo: string
  count: string
  style: string
  license: string
}

export const PHOSPHOR_LIBRARY: IconLibraryDef = {
  key: 'phosphor',
  label: 'Phosphor Icons',
  description: 'A flexible icon family with six weights. The set this system ships and previews.',
  npm: '@phosphor-icons/react',
  site: 'https://phosphoricons.com',
  repo: 'https://github.com/phosphor-icons/react',
  count: '1,500+',
  style: '6 weights · 24px',
  license: 'MIT',
}

/** The only bundled library. `ICON_LIBRARIES` stays as an array so existing callers keep working. */
export const ICON_LIBRARIES: IconLibraryDef[] = [PHOSPHOR_LIBRARY]

export const ICON_LIBRARY_KEYS = ICON_LIBRARIES.map((l) => l.key)

// Old persisted `iconLibrary` values — every one of these resolves to the
// bundled set now. `phosphor` is NOT here: it IS the bundled set.
const LEGACY_ICONIFY_KEYS = new Set(['untitled', 'lucide', 'heroicons', 'radix', 'material'])

/** Any persisted icon-library key resolves to Phosphor — the catalog no longer switches. */
export function getIconLibrary(_key?: string): IconLibraryDef {
  return PHOSPHOR_LIBRARY
}

export function isLegacyIconLibrary(key: string): boolean {
  return LEGACY_ICONIFY_KEYS.has(key)
}

export type IconAiSourceKey = 'phosphor' | 'untitled' | 'mage' | 'tabler' | 'heroicons'

export interface IconAiSource {
  key: IconAiSourceKey
  label: string
  description: string
  npm: string
  repo: string
  /** Extra usage note for generated code (e.g. the props an icon component
   *  takes). Appended to the Skill / README instruction. */
  usage?: string
  default?: boolean
}

/** Repos the Skill / README tell an AI to use when generating UI. Not live catalogs. */
export const ICON_AI_SOURCES: IconAiSource[] = [
  {
    key: 'phosphor',
    label: 'Phosphor Icons',
    description: 'Flexible icon family with six weights. The default for generated UI.',
    npm: '@phosphor-icons/react',
    repo: 'https://github.com/phosphor-icons/react',
    usage: 'Import per-icon (e.g. `import { User } from \'@phosphor-icons/react\'`). Each icon takes `size`, `color`, and `weight` ("thin" | "light" | "regular" | "bold" | "fill" | "duotone") props.',
    default: true,
  },
  {
    key: 'untitled',
    label: 'Untitled UI Icons',
    description: 'The set Escala embeds and previews. Pick this to keep generated UI on the same family.',
    npm: '@untitledui/icons',
    repo: 'https://github.com/untitleduico/icons',
  },
  {
    key: 'mage',
    label: 'Mage Icons',
    description: 'Open-source icon family. Point the AI here if the product already uses Mage.',
    npm: 'mage-icons-react',
    repo: 'https://github.com/Mage-Icons/mage-icons',
  },
  {
    key: 'tabler',
    label: 'Tabler Icons',
    description: 'Stroke icons from Tabler. A common pick for dashboards and admin UIs.',
    npm: '@tabler/icons-react',
    repo: 'https://github.com/tabler/tabler-icons',
  },
  {
    key: 'heroicons',
    label: 'Heroicons',
    description: 'Icons from the Tailwind team. Use when the generated UI is Tailwind-first.',
    npm: '@heroicons/react',
    repo: 'https://github.com/tailwindlabs/heroicons',
  },
]

export const DEFAULT_ICON_AI_SOURCE: IconAiSourceKey = 'phosphor'

export function getIconAiSource(key: string | undefined): IconAiSource {
  return ICON_AI_SOURCES.find((s) => s.key === key) ?? ICON_AI_SOURCES[0]
}

/** If a returning user had Heroicons selected, keep it as their AI source. */
export function aiSourceFromLegacyLibrary(iconLibrary: string | undefined): IconAiSourceKey {
  return iconLibrary === 'heroicons' ? 'heroicons' : DEFAULT_ICON_AI_SOURCE
}

/** Instruction block for Skill / README / Get MD — the repo generated UI must use. */
export function iconAiContext(aiSourceKey?: string): {
  source: IconAiSource
  instruction: string
  markdown: string
} {
  const source = getIconAiSource(aiSourceKey)
  const instruction =
    `When generating UI for this product, use icons from ${source.repo} (${source.label}, \`${source.npm}\`). Do not mix another icon family.`
      + (source.usage ? ` ${source.usage}` : '')
  const markdown = [
    '## Icons',
    '',
    instruction,
    '',
    `- **Set:** ${source.label}`,
    `- **Repo:** ${source.repo}`,
    `- **Package:** \`${source.npm}\``,
    '- Import per-icon from that package. Do not pull glyphs from any other icon set.',
    ...(source.usage ? [`- ${source.usage}`] : []),
  ].join('\n')
  return { source, instruction, markdown }
}

/** Canonical UI concepts → Phosphor **slug** (specimens resolve the regular-weight
 *  glyph body via `phosphorCoreBody`). Must stay in sync with `CORE_SLUGS` in
 *  `scripts/fetch-phosphor-icons.mjs` — a test asserts every value resolves. */
export const PHOSPHOR_CORE: Record<string, string> = {
  star: 'star',
  arrow: 'arrow-right',
  search: 'magnifying-glass',
  eye: 'eye',
  plus: 'plus',
  upload: 'upload-simple',
  info: 'info',
  success: 'check-circle',
  warning: 'warning',
  error: 'x-circle',
  home: 'house',
  box: 'cube',
  grid: 'grid-four',
  image: 'image',
  text: 'text-t',
  settings: 'gear',
  palette: 'palette',
  bookmark: 'bookmark-simple',
  heart: 'heart',
  share: 'share-network',
  user: 'user',
  users: 'users',
  zap: 'lightning',
  check: 'check',
  chevron: 'caret-down',
  close: 'x',
  chat: 'chat-circle',
  mail: 'envelope-simple',
}

/** Canonical UI concepts → Phosphor React component name, for copy snippets
 *  (`import { MagnifyingGlass } from '@phosphor-icons/react'`). */
export const PHOSPHOR_CORE_COMPONENT: Record<string, string> = {
  star: 'Star',
  arrow: 'ArrowRight',
  search: 'MagnifyingGlass',
  eye: 'Eye',
  plus: 'Plus',
  upload: 'UploadSimple',
  info: 'Info',
  success: 'CheckCircle',
  warning: 'Warning',
  error: 'XCircle',
  home: 'House',
  box: 'Cube',
  grid: 'GridFour',
  image: 'Image',
  text: 'TextT',
  settings: 'Gear',
  palette: 'Palette',
  bookmark: 'BookmarkSimple',
  heart: 'Heart',
  share: 'ShareNetwork',
  user: 'User',
  users: 'Users',
  zap: 'Lightning',
  check: 'Check',
  chevron: 'CaretDown',
  close: 'X',
  chat: 'ChatCircle',
  mail: 'EnvelopeSimple',
}

// Generic line glyphs shown as decorative previews — not the Phosphor set.
export const SAMPLE_GLYPHS: { name: string; path: string }[] = [
  { name: 'home', path: 'M3 10.5 12 3l9 7.5M5 9.5V20h4.5v-5.5h5V20H19V9.5' },
  { name: 'search', path: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.35-4.35' },
  { name: 'heart', path: 'M12 21s-7-4.5-9.3-9A5 5 0 0 1 12 6a5 5 0 0 1 9.3 6c-2.3 4.5-9.3 9-9.3 9Z' },
  { name: 'bell', path: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0' },
  { name: 'settings', path: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.7 7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9.5A1.7 1.7 0 0 0 10.6 3V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9.5a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z' },
  { name: 'check', path: 'M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4 12 14l-3-3' },
]
