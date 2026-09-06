// Get started articles — destinations, not file formats.
// Create UI's docs shape (what you get → where it lands) without their CLI.
// Install (Cursor / Claude Code / VS Code / Figma Make, MCP steps or one pasted prompt)
// is `AgentInstallPanel` — the same component the Export wizard shows on step 3, so the
// two cannot drift.

import { type ReactNode } from 'react'
import { useDesignStore } from '../../../store/useDesignStore'
import { useI18n } from '../../../lib/i18n'
import { withAgentEnvelope } from '../../../lib/aiContext'
import {
  cliMcpInitCommand,
  cliSkillCommand,
  mcpCursorConfig,
  skillFolderName,
  skillInstallPath,
} from '../../../lib/agentInstall'
import { publishOrigin, syncProjectId, syncUrl } from '../../../lib/figmaSync'
import { AIContextButton } from '../../ui/AIContextButton'
import AgentInstallPanel from '../AgentInstallPanel'
import {
  CodeBlock, DocHeader, DocSection, DocTitle, Pager, type TocEntry,
} from './blocks'
import {
  GET_STARTED_KEY, GUIDE_MCP_KEY, GUIDE_FIGMA_KEY,
  introPager, type DocsExits,
} from './getStarted'

type Translate = (source: string) => string

export function getStartedToc(key: string, t: Translate = (source) => source): TocEntry[] {
  if (key === GUIDE_FIGMA_KEY) {
    return [
      { id: 'description', label: t('Overview') },
      { id: 'plugin', label: t('Install the plugin') },
      { id: 'sync', label: t('Keep Sync on') },
      { id: 'file', label: t('Optional file') },
    ]
  }
  if (key === GUIDE_MCP_KEY) {
    return [
      { id: 'description', label: t('Overview') },
      { id: 'connect', label: t('Connect your agent') },
    ]
  }
  return [
    { id: 'description', label: t('Overview') },
    { id: 'configured', label: t('What you configured') },
    { id: 'start', label: t('Take it somewhere') },
  ]
}

function guideMarkdown(key: string, project: string, origin: string, slug: string): string {
  const folder = skillFolderName(project)
  const cursorPath = skillInstallPath('cursor', project)
  const claudePath = skillInstallPath('claude', project)
  if (key === GUIDE_FIGMA_KEY) {
    return [
      '# Use in Figma',
      '',
      'Install the Escala plugin once. Keep Sync on so Figma reads the same JSON the configurator publishes.',
      '',
      '1. Top bar → Figma mark → Download plugin. Unzip. Figma desktop → Plugins → Development → Import plugin from manifest…',
      '2. Same menu → Sync. Paste the live endpoint. Auto-sync on.',
      '3. Optional file: Export → Escala JSON (the exact payload the plugin imports).',
      '',
      `Sync URL: \`${syncUrl()}\``,
    ].join('\n')
  }
  if (key === GUIDE_MCP_KEY) {
    return [
      '# MCP',
      '',
      'Connect an agent to Escala’s live token server so it resolves your published system at call time instead of inventing values.',
      '',
      'Live tokens resolve against the published system at call time, so an agent never gets a value the solver has since rejected — the way a stale snapshot can. Publish (Figma → Sync) first, then in the product repo:',
      '',
      '```json',
      mcpCursorConfig(origin),
      '```',
      '',
      `Or: \`${cliMcpInitCommand('cursor', origin)}\``,
      '',
      `Tools that read the published system (\`get_tokens\`, \`resolve_token\`, \`list_icons\`) require \`project\`. This system's slug is \`${slug}\` — the same slug Figma Sync uses.`,
      '',
      'Also install the offline package, so the agent knows your token NAMES with no network — which the connection alone cannot answer, since an agent with only a connection does not know what to ask for:',
      '',
      '```',
      cliSkillCommand(slug, 'cursor', origin),
      '```',
      '',
      `Claude Code: \`${cliSkillCommand(slug, 'claude', origin)}\``,
      '',
      'Or unzip by hand:',
      '',
      `- Cursor: \`${cursorPath}\``,
      `- Claude Code: \`${claudePath}\``,
      '- Figma Make: upload the zip as-is (it cannot hold a live connection).',
      '',
      'Folder name inside the zip:',
      '',
      `\`${folder}\``,
      '',
      'No install at all: **Copy context to Agents** pastes the system into a chat.',
      '',
    ].join('\n')
  }
  return [
    '# Get started',
    '',
    'You configured a token system. Primitives stay hidden; semantics are what designs and code reference. Light and dark are modes of the same roles.',
    '',
    'Take it somewhere:',
    '',
    '- **Figma** — plugin + Sync.',
    '- **Code** — `variables.css` from Save, W3C JSON from Export, a GitHub remote, and the MCP connection an AI agent resolves real values through. All of it lands in the product repo.',
    '',
    'Do not choose between Markdown, Skill, and Agent bundle. Export asks where the system is going.',
  ].join('\n')
}

function ExitButton({
  children, onClick,
}: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="self-start text-body font-medium text-fg border border-line-strong rounded-lg px-3 py-1.5 hover:bg-elevated/60 transition-colors"
    >
      {children}
    </button>
  )
}

function DestinationRow({
  title, hint, onClick,
}: { title: string; hint: string; onClick: () => void }) {
  const { t } = useI18n()
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-baseline justify-between gap-4 w-full text-left px-4 py-3.5 rounded-xl border border-line hover:border-line-strong transition-colors"
    >
      <span className="min-w-0">
        <span className="block text-ui font-medium text-fg">{title}</span>
        <span className="block text-body text-fg-muted mt-0.5 leading-relaxed">{hint}</span>
      </span>
      <span className="flex-shrink-0 text-body text-fg-faint">{t('Read')} →</span>
    </button>
  )
}

function GetStartedLanding({ onOpen }: { onOpen: (key: string) => void }) {
  const { t } = useI18n()
  return (
    <>
      <DocSection
        id="configured"
        title={t('What you configured')}
        description={t('A token system, not a component library. Primitive ramps hold the raw values; semantic roles are what a screen is allowed to name. Light and dark (and any extra theme) are modes of those roles — not a second palette.')}
      >
        <ul className="flex flex-col gap-1.5 text-ui text-fg-muted leading-relaxed pl-4 list-disc">
          <li>{t('Foundations you set in the Variables Generator — color, type, space, radius, size, stroke, grid, icons.')}</li>
          <li>{t('Optional component specs')} (<code className="font-mono text-[0.92em] px-1 py-0.5 rounded bg-elevated/70 border border-line text-fg">atoms</code>) {t('for the Figma plugin. Code still binds to roles, not to a hex on a button.')}</li>
          <li>{t('One payload underneath: the same JSON Figma, CSS, and an agent all read.')}</li>
        </ul>
      </DocSection>

      <DocSection
        id="start"
        title={t('Take it somewhere')}
        description={t('Two places, not three file formats. Figma is a design tool; everything else lands in the product repo.')}
      >
        <div className="flex flex-col gap-2">
          <DestinationRow
            title={t('Use in Figma')}
            hint={t('Install the Escala plugin and keep Sync on. Variables land in the file you already design in.')}
            onClick={() => onOpen(GUIDE_FIGMA_KEY)}
          />
          <DestinationRow
            title={t('MCP')}
            hint={t('Connect an AI agent to the live token server so it resolves your system instead of guessing values.')}
            onClick={() => onOpen(GUIDE_MCP_KEY)}
          />
        </div>
      </DocSection>
    </>
  )
}

function FigmaGuide({ exits }: { exits: DocsExits }) {
  const { t } = useI18n()
  const url = syncUrl()
  return (
    <>
      <DocSection
        id="plugin"
        title={t('Install the plugin')}
        description={t('One-time. Figma desktop, not the browser. After that you never import a JSON by hand unless you want a snapshot.')}
      >
        <ol className="list-decimal pl-4 text-ui text-fg-muted leading-relaxed flex flex-col gap-1 mb-3">
          <li>{t('Download the plugin zip from the Figma menu in the top bar.')}</li>
          <li>{t('Unzip. In Figma:')} <span className="text-fg">Plugins → Development → Import plugin from manifest…</span></li>
          <li>{t('Run')} <span className="text-fg">Plugins → Development → Escala DS</span>.</li>
        </ol>
        <ExitButton onClick={exits.onOpenFigmaDownload}>{t('Open plugin install')}</ExitButton>
      </DocSection>

      <DocSection
        id="sync"
        title={t('Keep Sync on')}
        description={t("The plugin polls this system's published JSON — the same file Export can download. Rename the project and the URL changes; that is expected.")}
      >
        <CodeBlock file={t('Live sync URL')} code={url} />
        <ExitButton onClick={exits.onOpenFigmaSync}>{t('Open Sync')}</ExitButton>
      </DocSection>

      <DocSection
        id="file"
        title={t('Optional file')}
        description={t('If you need a snapshot on disk: Export and pick Escala JSON. That is the exact payload the plugin imports. W3C JSON is for other tools, not this plugin.')}
      >
        <ExitButton onClick={exits.onOpenExport}>{t('Open Export')}</ExitButton>
      </DocSection>
    </>
  )
}

/**
 * MCP is its own operating page: a live contract for agents, rather than a
 * second reference sheet or a code-format chooser.
 */
function McpGuide() {
  const { t } = useI18n()
  return (
    <>
      <DocSection
        id="connect"
        title={t('Connect your agent')}
        description={t('An agent writing this code needs the same rule. Publish (Sync), then connect it so it resolves real values at call time — resolve_token, check_contrast — instead of guessing: a stale snapshot can hand out a tone the solver has since rejected. Step 3 installs the offline package, which teaches it your token names with no network.')}
      >
        <AgentInstallPanel variant="docs" />
        <p className="text-body text-fg-faint leading-relaxed">
          {t('Neither, for a one-off?')} <span className="text-fg-muted">{t('Copy context to Agents')}</span> {t('(the control at the top of this page) pastes the system straight into a chat — no files, no restart. Connect when every chat in the repo should already know the tokens.')}
        </p>
      </DocSection>
    </>
  )
}

const TITLE: Record<string, { title: string; lead: string }> = {
  [GET_STARTED_KEY]: {
    title: 'Get started',
    lead: 'Foundations are set. This page is where the system goes — into Figma, or into your product repo — not a menu of file formats.',
  },
  [GUIDE_FIGMA_KEY]: {
    title: 'Use in Figma',
    lead: 'Install the Escala plugin once. Keep Sync on. The plugin reads the same JSON the configurator publishes — you do not maintain a second set of variables by hand.',
  },
  [GUIDE_MCP_KEY]: {
    title: 'MCP',
    lead: 'Connect your agent to Escala’s live token server so it can resolve the published system instead of guessing values.',
  },
}

export function GetStartedArticle({
  pageKey, onOpen, exits, showPager = true,
}: {
  pageKey: string
  onOpen: (key: string) => void
  exits: DocsExits
  showPager?: boolean
}) {
  const { t } = useI18n()
  const projectName = useDesignStore((s) => s.projectName) || 'Escala'
  const meta = TITLE[pageKey] ?? TITLE[GET_STARTED_KEY]
  const pager = introPager(pageKey)
  const origin = publishOrigin()
  const slug = syncProjectId()

  return (
    <div className="flex flex-col gap-8">
      <DocHeader
        section={t('Docs')}
        kind={t('Get started')}
        title={t(meta.title)}
        actions={
          <AIContextButton
            scope="global"
            markdown={() => withAgentEnvelope('global', t(meta.title), guideMarkdown(pageKey, projectName, origin, slug))}
          />
        }
      />

      <DocTitle title={t(meta.title)} eyebrow={t('Guide')} lead={t(meta.lead)} />

      {pageKey === GUIDE_FIGMA_KEY ? (
        <FigmaGuide exits={exits} />
      ) : pageKey === GUIDE_MCP_KEY ? (
        <McpGuide />
      ) : (
        <GetStartedLanding onOpen={onOpen} />
      )}

      {showPager && <Pager prev={pager.prev} next={pager.next} onOpen={onOpen} />}
    </div>
  )
}
