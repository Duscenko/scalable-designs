// One install recipe for a generated system — the Export wizard's payoff step
// and Docs → Use in code → Connect your agent.
//
// Shape: a CLIENT tab row (Cursor · Claude Code · VS Code · Figma Make) with an
// MCP/PROMPT toggle on the right, over numbered steps — each row is
// `[nn] [what + why] | [the command, with Copy]`. That replaced a stack of
// prose blocks and two `<details>` disclosures where the actual commands were
// the smallest thing on screen and half of them were hidden behind a summary
// you had to know to open. The numbers are the point: connecting an agent is a
// PROCEDURE, and a procedure that doesn't say how many steps it has reads as
// open-ended.
//
// Two rules this file exists to keep:
//  1. **Every string comes from `lib/agentInstall.ts`.** Nothing here composes a
//     command inline, so a path printed in Docs cannot drift from the zip's
//     `skillName()`, from `/api/mcp`, or from what the CLI parses.
//  2. **A client only gets a step it can actually run.** VS Code has no skills
//     folder, so it has no offline-package step; Figma Make consumes an
//     uploaded zip and cannot hold a connection, so it has no MCP mode at all
//     (and its toggle is not rendered — a disabled control would still be
//     claiming the mode exists).

import { useState, type ReactNode } from 'react'
import { useDesignStore } from '../../store/useDesignStore'
import {
  agentSetupPrompt,
  cliMcpInitCommand,
  cliSkillCommand,
  mcpClaudeAddCommand,
  mcpCursorConfig,
  mcpVscodeConfig,
  skillFolderName,
  skillInstallPath,
} from '../../lib/agentInstall'
import { publishOrigin, syncProjectId } from '../../lib/figmaSync'
import { CopyButton } from './docs/blocks'

export type InstallClient = 'cursor' | 'claude' | 'vscode' | 'make'
type Mode = 'mcp' | 'prompt'

const TABS: { id: InstallClient; label: string; logo: string }[] = [
  { id: 'cursor', label: 'Cursor', logo: 'cursor' },
  { id: 'claude', label: 'Claude Code', logo: 'claudecode' },
  { id: 'vscode', label: 'VS Code', logo: 'vs' },
  // Figma Make is a Figma product; it carries the Figma mark.
  { id: 'make', label: 'Figma Make', logo: 'figma' },
]

/** One numbered row. `code` is the command; `pane` is for a step whose payload
 *  isn't a single line (a JSON config), so it renders in the same slot without
 *  pretending to be a shell command. */
type Step = {
  title: string
  body: ReactNode
  code?: string
  /** Filename shown above a multi-line payload — omit for a shell command. */
  file?: string
}

export default function AgentInstallPanel({
  initialClient = 'cursor',
  variant = 'docs',
}: {
  initialClient?: InstallClient
  /** `export` is the wizard payoff (you already have the zip). `docs` includes
   *  the publish step. `about` is the teaser on the About page: the tabs +
   *  toggle + ONLY the first step, since a "More in Docs" link right below it
   *  carries the full procedure. */
  variant?: 'export' | 'docs' | 'about'
}) {
  const [tab, setTab] = useState<InstallClient>(initialClient)
  const [mode, setMode] = useState<Mode>('mcp')
  const projectName = useDesignStore((s) => s.projectName) || 'Escala'
  const origin = publishOrigin()
  const slug = syncProjectId()
  const inWizard = variant === 'export'
  const teaser = variant === 'about'

  // Make has no live mode; force the panel back to its one real view rather
  // than rendering an empty MCP pane if it was left on that tab.
  const effectiveMode: Mode = tab === 'make' ? 'mcp' : mode
  const allSteps = stepsFor(tab, origin, slug, projectName)
  // About shows just the first row ("Add the server" — or Make's "Export the
  // zip"); the alternative-config and offline-package rows live in Docs.
  const steps = teaser ? allSteps.slice(0, 1) : allSteps

  return (
    <div className="rounded-xl border border-line bg-surface/50 overflow-hidden">
      {inWizard && (
        <div className="px-4 pt-3.5 pb-1 flex flex-col gap-1">
          <span className="text-ui font-medium text-fg">Connect your agent</span>
          <p className="text-body text-fg-muted leading-relaxed">
            Publish this system (Sync), then connect it below so the agent resolves real values instead of
            guessing. Run everything in the <strong className="font-medium text-fg">product</strong> repo: the
            app you are building, not Escala.
          </p>
        </div>
      )}

      {/* Client row + mode toggle. One line, the way the thing you're
          configuring and the thing you're configuring it with belong together. */}
      <div className="flex items-center gap-3 px-3 pt-3 pb-3 border-b border-line">
        <div className="flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto">
          {TABS.map(({ id, label, logo }) => (
            <button
              key={id}
              type="button"
              aria-pressed={tab === id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-body font-medium whitespace-nowrap transition-colors ${
                tab === id ? 'bg-elevated text-fg shadow-sm' : 'text-fg-faint hover:text-fg'
              }`}
            >
              <ClientLogo name={logo} active={tab === id} />
              {label}
            </button>
          ))}
        </div>
        {tab !== 'make' && (
          <div
            className="flex flex-shrink-0 rounded-lg border border-line overflow-hidden"
            role="group"
            aria-label="Setup method"
          >
            {(['mcp', 'prompt'] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={effectiveMode === m}
                onClick={() => setMode(m)}
                title={m === 'mcp' ? 'Run the steps yourself' : 'Hand the whole setup to the agent'}
                className={`px-2.5 py-1 text-mini font-semibold uppercase tracking-wider font-mono transition-colors ${
                  effectiveMode === m ? 'bg-fg text-app' : 'bg-surface text-fg-faint hover:text-fg'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </div>

      {effectiveMode === 'prompt' ? (
        <PromptPane
          prompt={agentSetupPrompt(
            origin,
            slug,
            tab === 'vscode' || tab === 'claude' || tab === 'cursor' ? tab : undefined,
          )}
        />
      ) : (
        <>
          {!inWizard && !teaser && tab !== 'make' && (
            <p className="px-4 pt-3 text-body text-fg-faint leading-relaxed">
              Publish this system first (Figma → Sync). The server resolves against the published
              system, so there has to be one. Run these in the{' '}
              <strong className="font-medium text-fg-muted">product</strong> repo.
            </p>
          )}
          <ol className="flex flex-col">
            {steps.map((step, i) => (
              <StepRow key={step.title} n={i + 1} step={step} last={i === steps.length - 1} />
            ))}
          </ol>
        </>
      )}
    </div>
  )
}

/** The steps for one client. Ordered connect → alternative → package, so the
 *  first row is always the one thing you must do. */
function stepsFor(tab: InstallClient, origin: string, slug: string, projectName: string): Step[] {
  const folder = skillFolderName(projectName)

  if (tab === 'make') {
    return [
      {
        title: 'Export the zip',
        body: (
          <>
            In Export pick <Mono>AI assistant</Mono>, then check{' '}
            <Mono>Figma Make only</Mono> for the smaller package.
          </>
        ),
      },
      {
        title: 'Upload it as-is',
        body: (
          <>
            Figma Make reads an uploaded zip. It cannot hold a live connection, so there is no
            server to add here. This does not replace Figma variables; Sync still does that.
          </>
        ),
      },
    ]
  }

  if (tab === 'vscode') {
    return [
      {
        title: 'Add the server',
        body: (
          <>
            Paste this into <Mono>.vscode/mcp.json</Mono>. The key is <Mono>servers</Mono>, not{' '}
            <Mono>mcpServers</Mono>. Reload the window after.
          </>
        ),
        code: mcpVscodeConfig(origin),
        file: '.vscode/mcp.json',
      },
      {
        title: 'Or let the CLI write it',
        body: <>Same file, written by the installer. Paste the JSON above if you would rather not run npx.</>,
        code: cliMcpInitCommand('vscode', origin),
      },
      // Deliberately no offline-package step: `SkillAgent` is cursor|claude,
      // and Copilot has no skills folder to install one into.
      {
        title: 'Ask it for a token',
        body: (
          <>
            Copilot can now call <Mono>resolve_token</Mono> and <Mono>check_contrast</Mono>. Token
            tools require <Mono>project</Mono> — this system is <Mono>{slug}</Mono>, the same slug
            Figma Sync uses.
          </>
        ),
      },
    ]
  }

  if (tab === 'claude') {
    return [
      {
        title: 'Add the server',
        body: (
          <>
            Anthropic&apos;s own CLI, not Escala&apos;s. <Mono>--scope project</Mono> writes{' '}
            <Mono>.mcp.json</Mono> in this repo. Restart Claude Code after.
          </>
        ),
        code: mcpClaudeAddCommand(origin),
      },
      {
        title: 'Or write the project file',
        body: (
          <>
            Same <Mono>.mcp.json</Mono> the CLI writes. Paste this if you would rather not run a
            command.
          </>
        ),
        code: mcpCursorConfig(origin),
        file: '.mcp.json',
      },
      {
        title: 'Install the offline package',
        body: (
          <>
            Your token names, usage prose and the component catalogue with no network. It's what Live
            can&apos;t answer, since an agent with only a connection doesn&apos;t know what to ask
            for. Lands in <Mono>{skillInstallPath('claude', projectName)}</Mono>.
          </>
        ),
        code: cliSkillCommand(slug, 'claude', origin),
      },
    ]
  }

  return [
    {
      title: 'Add the server',
      body: (
        <>
          Paste this into <Mono>.cursor/mcp.json</Mono> for this project, or{' '}
          <Mono>~/.cursor/mcp.json</Mono> for all of them. Restart Cursor after.
        </>
      ),
      code: mcpCursorConfig(origin),
      file: '.cursor/mcp.json',
    },
    {
      title: 'Or let the CLI write it',
      body: <>Same file, written by the installer. Paste the JSON above if you would rather not run npx.</>,
      code: cliMcpInitCommand('cursor', origin),
    },
    {
      title: 'Install the offline package',
      body: (
        <>
          Your token names, usage prose and the component catalogue with no network. It's what Live
          can&apos;t answer, since an agent with only a connection doesn&apos;t know what to ask
          for. Lands in <Mono>{`.cursor/skills/${folder}/`}</Mono>.
        </>
      ),
      code: cliSkillCommand(slug, 'cursor', origin),
    },
  ]
}

/** `[nn] [title + why] | [command]`. The two-column split is what makes the
 *  command scannable — it's the thing you came for, so it gets its own column
 *  rather than sitting at the end of a paragraph. Collapses to one column
 *  below `md`, where two would leave ~130px per side. */
function StepRow({ n, step, last }: { n: number; step: Step; last: boolean }) {
  // A step with no command (Figma Make's two, VS Code's "ask it for a token")
  // takes the whole row instead of keeping a 42% column and leaving 58% blank
  // beside it — the column split exists to give the COMMAND its own space, so
  // with no command there's nothing for it to do.
  const split = !!step.code
  return (
    <li className={`flex flex-col md:flex-row md:items-start gap-3 px-4 py-3.5 ${last ? '' : 'border-b border-line'}`}>
      <div className={`flex items-start gap-2.5 min-w-0 ${split ? 'md:w-[42%] flex-shrink-0' : 'flex-1'}`}>
        <span className="text-mini font-mono tabular-nums text-fg-faint pt-0.5 flex-shrink-0">
          {String(n).padStart(2, '0')}
        </span>
        <div className="min-w-0">
          <span className="block text-ui font-medium text-fg">{step.title}</span>
          <p className="text-caption text-fg-faint leading-relaxed mt-0.5">{step.body}</p>
        </div>
      </div>
      {step.code && (
        <div className="flex-1 min-w-0">
          <CommandPane code={step.code} file={step.file} />
        </div>
      )}
    </li>
  )
}

/** A command in the step's right column. A shell command renders with a `$`
 *  and no chrome bar — a one-liner does not need a filename strip above it —
 *  while a config payload gets its filename, because WHERE it goes is half the
 *  instruction. */
function CommandPane({ code, file }: { code: string; file?: string }) {
  return (
    <div className="rounded-lg border border-line bg-app overflow-hidden">
      {file && (
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-line bg-elevated/40">
          <span className="text-mini font-mono text-fg-faint truncate">{file}</span>
          <CopyButton text={code} />
        </div>
      )}
      <div className="flex items-start gap-2 px-3 py-2.5">
        {!file && <span className="text-caption font-mono text-fg-faint select-none flex-shrink-0">$</span>}
        <pre className="flex-1 min-w-0 text-caption font-mono text-fg leading-relaxed whitespace-pre-wrap break-all m-0">
          {code}
        </pre>
        {!file && (
          <span className="flex-shrink-0 -mt-0.5">
            <CopyButton text={code} />
          </span>
        )}
      </div>
    </div>
  )
}

/** The one-paste alternative. Same two-column split as a step row, so switching
 *  modes doesn't re-flow the panel into a different shape. */
function PromptPane({ prompt }: { prompt: string }) {
  return (
    <div className="flex flex-col md:flex-row md:items-start gap-3 px-4 py-4">
      <div className="md:w-[42%] flex-shrink-0 min-w-0">
        <span className="block text-ui font-medium text-fg">Paste this to your agent</span>
        <p className="text-caption text-fg-faint leading-relaxed mt-0.5">
          It adds the server, proves the connection by reading your system back, and tells the agent
          to resolve tokens instead of inventing values. Publish first (Sync). There has to be a
          published system to read.
        </p>
      </div>
      <div className="flex-1 min-w-0">
        <div className="rounded-lg border border-line bg-app overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-line bg-elevated/40">
            <span className="text-mini font-mono text-fg-faint">prompt</span>
            <CopyButton text={prompt} />
          </div>
          <pre className="px-3 py-2.5 text-caption font-mono text-fg leading-relaxed whitespace-pre-wrap break-words m-0">
            {prompt}
          </pre>
        </div>
      </div>
    </div>
  )
}

function Mono({ children }: { children: ReactNode }) {
  return (
    <code className="font-mono text-[0.92em] px-1 py-0.5 rounded bg-elevated/70 border border-line text-fg-muted">
      {children}
    </code>
  )
}

// ── Client logos ────────────────────────────────────────────────────────────
// Real vendor marks now (`public/ide-logos/`), a deliberate reversal of the
// earlier hand-drawn-glyphs decision — a real logo tells the four options
// apart faster than an abstraction of one.
//
// Each mark ships as two files with a hardcoded fill: `<name>-dark.svg` is
// BLACK (for light mode), `<name>-light.svg` is WHITE (for dark mode). They're
// `<img>` from `public/`, not inline SVG, so `currentColor` never touches them
// — hence the two-file swap on the `.dark` class instead. The active/inactive
// distinction is opacity only (a logo shouldn't change colour between tab
// states, just dim when it's not the one selected).
function ClientLogo({ name, active }: { name: string; active: boolean }) {
  return (
    <span className={`flex-shrink-0 ${active ? 'opacity-100' : 'opacity-55'}`}>
      <img
        src={`/ide-logos/${name}-dark.svg`}
        alt=""
        aria-hidden
        className="w-3.5 h-3.5 dark:hidden"
      />
      <img
        src={`/ide-logos/${name}-light.svg`}
        alt=""
        aria-hidden
        className="w-3.5 h-3.5 hidden dark:block"
      />
    </span>
  )
}
