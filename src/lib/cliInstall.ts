// `@escala/cli` — thin installer over published Blob + `buildAgentProductFiles`.
// Pure: injected IO. The Node entry (`src/cli/main.ts`) is the only fs/process adapter.
// Do not generate tokens here. Do not invent a second skill builder.

import { buildAgentProductFiles, type AgentBundleFile, type TokenJSON } from './agentBundle'
import { slugify } from './utils'
import {
  DEFAULT_PUBLISH_ORIGIN,
  MCP_SERVER_NAME,
  mcpConfigPath,
  mcpEndpoint,
  mcpOrigin,
  skillInstallPath,
  type McpClient,
  type SkillAgent,
} from './agentInstall'

export const CLI_USAGE = `Usage:
  npx @escala/cli skill --from <slug> [--client cursor|claude] [--host <origin>]
  npx @escala/cli mcp init [--client cursor|claude|vscode] [--url <mcp-url>]

Installs THIS published system into the product repo (not Escala).
skill  writes the agent guide (same files as Export → AI assistant).
mcp    writes the live-token connection (same JSON as Docs → Use with AI).

The system must already be published (Escala → Figma → Sync).
Unzip the AI assistant zip by hand if it is not published yet.`

export type CliParseResult =
  | { kind: 'help' }
  | { kind: 'error'; message: string }
  | {
      kind: 'skill'
      slug: string
      client: SkillAgent
      origin: string
      cwd: string
    }
  | {
      kind: 'mcp'
      client: McpClient
      origin: string
      cwd: string
    }

export interface CliIo {
  cwd: string
  fetch: (url: string) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>
  readFile: (path: string) => string | null
  writeFile: (path: string, text: string) => void
  mkdirp: (path: string) => void
  log: (msg: string) => void
  error: (msg: string) => void
}

export function originFromMcpUrl(urlOrOrigin: string): string {
  const trimmed = urlOrOrigin.trim().replace(/\/$/, '')
  const stripped = trimmed.endsWith('/api/mcp')
    ? trimmed.slice(0, -'/api/mcp'.length)
    : trimmed
  return mcpOrigin(stripped || DEFAULT_PUBLISH_ORIGIN)
}

export function tokensUrl(origin: string, slug: string): string {
  const host = origin.replace(/\/$/, '') || DEFAULT_PUBLISH_ORIGIN
  return `${host}/api/tokens?project=${encodeURIComponent(slug)}`
}

export function isPublishedTokens(data: unknown): data is TokenJSON {
  if (!data || typeof data !== 'object') return false
  const colors = (data as { colors?: unknown }).colors
  return typeof colors === 'object' && colors !== null
}

export function planSkillInstall(json: TokenJSON, client: SkillAgent): {
  relativeDir: string
  files: AgentBundleFile[]
} {
  const { files } = buildAgentProductFiles(json)
  const project = json.project?.trim() || 'Design system'
  return {
    relativeDir: skillInstallPath(client, project).replace(/\/$/, ''),
    files,
  }
}

export function mergeMcpConfig(existing: unknown, client: McpClient, origin: string): Record<string, unknown> {
  const url = mcpEndpoint(origin)
  const base = existing && typeof existing === 'object' && !Array.isArray(existing)
    ? { ...(existing as Record<string, unknown>) }
    : {}
  if (client === 'vscode') {
    const servers = isPlain(base.servers) ? { ...base.servers } : {}
    return { ...base, servers: { ...servers, [MCP_SERVER_NAME]: { url, type: 'http' } } }
  }
  const servers = isPlain(base.mcpServers) ? { ...base.mcpServers } : {}
  return { ...base, mcpServers: { ...servers, [MCP_SERVER_NAME]: { url, type: 'http' } } }
}

function isPlain(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseCliArgs(argv: string[], opts: { cwd?: string } = {}): CliParseResult {
  const cwd = opts.cwd ?? '.'
  if (argv.length === 0 || argv[0] === 'help' || argv.includes('--help') || argv.includes('-h')) {
    return { kind: 'help' }
  }

  const command = argv[0]
  const rest = argv.slice(1)

  if (command === 'skill') {
    const flags = readFlags(rest)
    if (!flags.ok) return { kind: 'error', message: flags.message }
    const from = flags.values.from
    if (!from) return { kind: 'error', message: 'skill requires --from <published-slug>.' }
    const slug = slugify(from) || from
    const client = parseSkillClient(flags.values.client)
    if (!client) return { kind: 'error', message: '--client must be cursor or claude.' }
    const origin = originFromMcpUrl(flags.values.host ?? flags.values.url ?? DEFAULT_PUBLISH_ORIGIN)
    return { kind: 'skill', slug, client, origin, cwd: flags.values.cwd ?? cwd }
  }

  if (command === 'mcp') {
    if (rest[0] !== 'init') {
      return { kind: 'error', message: 'Usage: npx @escala/cli mcp init [--client cursor|claude|vscode]' }
    }
    const flags = readFlags(rest.slice(1))
    if (!flags.ok) return { kind: 'error', message: flags.message }
    const client = parseMcpClient(flags.values.client)
    if (!client) return { kind: 'error', message: '--client must be cursor, claude, or vscode.' }
    const origin = originFromMcpUrl(flags.values.url ?? flags.values.host ?? DEFAULT_PUBLISH_ORIGIN)
    return { kind: 'mcp', client, origin, cwd: flags.values.cwd ?? cwd }
  }

  return { kind: 'error', message: `Unknown command "${command}".\n\n${CLI_USAGE}` }
}

function parseSkillClient(raw: string | undefined): SkillAgent | null {
  if (raw === undefined || raw === 'cursor') return 'cursor'
  if (raw === 'claude') return 'claude'
  return null
}

function parseMcpClient(raw: string | undefined): McpClient | null {
  if (raw === undefined || raw === 'cursor') return 'cursor'
  if (raw === 'claude' || raw === 'vscode') return raw
  return null
}

function readFlags(argv: string[]): { ok: true; values: Record<string, string> } | { ok: false; message: string } {
  const values: Record<string, string> = {}
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!
    if (!token.startsWith('--')) {
      return { ok: false, message: `Unexpected argument "${token}".` }
    }
    const eq = token.indexOf('=')
    if (eq !== -1) {
      values[token.slice(2, eq)] = token.slice(eq + 1)
      continue
    }
    const key = token.slice(2)
    const next = argv[i + 1]
    if (!next || next.startsWith('--')) {
      return { ok: false, message: `--${key} needs a value.` }
    }
    values[key] = next
    i += 1
  }
  return { ok: true, values }
}

function joinPath(...parts: string[]): string {
  const absolute = parts[0]?.startsWith('/') === true
  const segs = parts
    .flatMap((p) => p.split(/[\\/]/))
    .filter((p) => p && p !== '.')
  return `${absolute ? '/' : ''}${segs.join('/')}`
}

function parentDir(filePath: string): string {
  const idx = filePath.lastIndexOf('/')
  return idx <= 0 ? '.' : filePath.slice(0, idx)
}

export async function runCli(argv: string[], io: CliIo): Promise<number> {
  const cmd = parseCliArgs(argv, { cwd: io.cwd })
  if (cmd.kind === 'help') {
    io.log(CLI_USAGE)
    return 0
  }
  if (cmd.kind === 'error') {
    io.error(cmd.message)
    return 1
  }

  if (cmd.kind === 'skill') {
    const url = tokensUrl(cmd.origin, cmd.slug)
    let data: unknown
    try {
      const res = await io.fetch(url)
      if (!res.ok) {
        io.error(`No published system at ${url} (${res.status}).\nPublish from Escala (Figma → Sync), then retry. Or unzip the AI assistant zip by hand.`)
        return 1
      }
      data = await res.json()
    } catch {
      io.error(`Could not fetch ${url}. Check the host and that the system is published.`)
      return 1
    }
    if (!isPublishedTokens(data)) {
      io.error(`Response at ${url} is not an Escala token payload.`)
      return 1
    }
    const { relativeDir, files } = planSkillInstall(data, cmd.client)
    for (const file of files) {
      const dest = joinPath(cmd.cwd, relativeDir, file.path)
      io.mkdirp(parentDir(dest))
      io.writeFile(dest, file.text)
    }
    io.log(`Installed ${files.length} files → ${relativeDir}/`)
    return 0
  }

  const relative = mcpConfigPath(cmd.client)
  const dest = joinPath(cmd.cwd, relative)
  const raw = io.readFile(dest)
  let existing: unknown
  if (raw !== null) {
    try {
      existing = JSON.parse(raw)
    } catch {
      io.error(`${relative} is not valid JSON. Fix or delete it, then retry.`)
      return 1
    }
  }
  const next = mergeMcpConfig(existing, cmd.client, cmd.origin)
  io.mkdirp(parentDir(dest))
  io.writeFile(dest, `${JSON.stringify(next, null, 2)}\n`)
  io.log(`Wrote ${relative}`)
  return 0
}
