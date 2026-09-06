import { describe, expect, it } from 'vitest'
import { skillName } from '../agentBundle/names'
import { MCP_SERVER_NAME } from '../agentAccess/mcp'
import {
  CLI_PACKAGE,
  DEFAULT_PUBLISH_ORIGIN,
  FIGMA_MAKE_URL,
  agentSetupPrompt,
  claudeChatUrl,
  cliMcpInitCommand,
  cliSkillCommand,
  cursorPromptUrl,
  figmaAgentLead,
  mcpClaudeAddCommand,
  mcpConfigPath,
  mcpCursorConfig,
  mcpEndpoint,
  mcpVscodeConfig,
  skillFolderName,
  skillInstallPath,
} from '../agentInstall'
import {
  CLI_USAGE,
  isPublishedTokens,
  mergeMcpConfig,
  originFromMcpUrl,
  parseCliArgs,
  planSkillInstall,
  runCli,
  tokensUrl,
} from '../cliInstall'
import type { TokenJSON } from '../agentBundle'

const FIXTURE: TokenJSON = {
  project: 'Acme App',
  colors: {
    primitive: { 'accent-6': '#7f56d9' },
    themeOrder: ['light'],
    architecture: { kind: 'categorical', tokens: {} },
  },
  typography: { fontFamily: 'Inter', sizes: { 'text-md': '16px' }, weights: { medium: 500 } },
  spacing: { '4': '16px' },
  radius: { md: '8px' },
}

describe('agentInstall recipes', () => {
  // The apex is not a style choice: the served certificate carries a single SAN
  // (`DNS:escalatokens.com`), so every strict TLS client — which is every MCP
  // client — fails the handshake on `www.` before any JSON-RPC. This test used
  // to assert `www.` and was therefore pinning a config that could not connect.
  it('defaults the public origin to the apex host, not www and not a Vercel preview host', () => {
    expect(DEFAULT_PUBLISH_ORIGIN).toBe('https://escalatokens.com')
    expect(mcpEndpoint(DEFAULT_PUBLISH_ORIGIN)).toBe('https://escalatokens.com/api/mcp')
    expect(DEFAULT_PUBLISH_ORIGIN).not.toMatch(/vercel\.app/)
    expect(DEFAULT_PUBLISH_ORIGIN).not.toMatch(/\/\/www\./)
  })

  it('points MCP at /api/mcp on the given origin', () => {
    expect(mcpEndpoint('https://escalatokens.com')).toBe('https://escalatokens.com/api/mcp')
    expect(mcpEndpoint('https://escalatokens.com/')).toBe('https://escalatokens.com/api/mcp')
  })

  it('rewrites www to the apex — that host fails TLS on every MCP client', () => {
    expect(mcpEndpoint('https://www.escalatokens.com')).toBe('https://escalatokens.com/api/mcp')
    expect(mcpEndpoint('https://www.escalatokens.com/')).toBe('https://escalatokens.com/api/mcp')
    expect(originFromMcpUrl('https://www.escalatokens.com/api/mcp')).toBe('https://escalatokens.com')
  })

  it('builds Cursor mcp.json with the server name the endpoint advertises', () => {
    const json = JSON.parse(mcpCursorConfig('https://escalatokens.com'))
    expect(json).toEqual({
      mcpServers: { 'escala-tokens': { url: 'https://escalatokens.com/api/mcp', type: 'http' } },
    })
  })

  it('builds VS Code mcp.json as type http', () => {
    const json = JSON.parse(mcpVscodeConfig('https://preview.example'))
    expect(json.servers['escala-tokens']).toEqual({
      url: 'https://preview.example/api/mcp',
      type: 'http',
    })
  })

  it('points Claude CLI at the same MCP URL as Cursor mcp.json', () => {
    const origin = 'https://escalatokens.com'
    const json = JSON.parse(mcpCursorConfig(origin))
    expect(mcpClaudeAddCommand(origin)).toBe(
      `claude mcp add --transport http --scope project ${MCP_SERVER_NAME} ${json.mcpServers[MCP_SERVER_NAME].url}`,
    )
    // Claude's project file is the same payload Cursor writes — only the path differs.
    expect(mcpConfigPath('claude')).toBe('.mcp.json')
    expect(JSON.parse(mcpCursorConfig(origin)).mcpServers[MCP_SERVER_NAME]).toEqual({
      url: 'https://escalatokens.com/api/mcp',
      type: 'http',
    })
  })

  it('installs the skill under the zip folder name', () => {
    const project = 'Acme App'
    expect(skillFolderName(project)).toBe(skillName(project))
    expect(skillInstallPath('cursor', project)).toBe(`.cursor/skills/${skillName(project)}/`)
    expect(skillInstallPath('claude', project)).toBe(`.claude/skills/${skillName(project)}/`)
  })

  it('prints npx commands that match the parser', () => {
    const slug = 'acme-app'
    expect(cliSkillCommand(slug, 'cursor')).toBe(`npx ${CLI_PACKAGE} skill --from acme-app --client cursor`)
    expect(parseCliArgs(['skill', '--from', 'acme-app', '--client', 'cursor'])).toMatchObject({
      kind: 'skill',
      slug: 'acme-app',
      client: 'cursor',
      origin: DEFAULT_PUBLISH_ORIGIN,
    })
    expect(cliSkillCommand(slug, 'claude', 'https://preview.example')).toBe(
      `npx ${CLI_PACKAGE} skill --from acme-app --client claude --host https://preview.example`,
    )
    const mcp = cliMcpInitCommand('cursor', 'https://escalatokens.com')
    expect(mcp).toBe(`npx ${CLI_PACKAGE} mcp init --client cursor --url https://escalatokens.com/api/mcp`)
    expect(parseCliArgs(mcp.replace(`npx ${CLI_PACKAGE} `, '').split(' '))).toMatchObject({
      kind: 'mcp',
      client: 'cursor',
      origin: 'https://escalatokens.com',
    })
  })

  it('names MCP config files per client', () => {
    expect(mcpConfigPath('cursor')).toBe('.cursor/mcp.json')
    expect(mcpConfigPath('claude')).toBe('.mcp.json')
    expect(mcpConfigPath('vscode')).toBe('.vscode/mcp.json')
  })

  it('Get code Open-in URLs carry the same MCP setup prompt, not a catalog dump', () => {
    const prompt = agentSetupPrompt('https://escalatokens.com', 'hola')
    expect(prompt).toContain('https://escalatokens.com/api/mcp')
    expect(prompt).toContain('get_tokens with project "hola"')
    expect(prompt).toContain('resolve_token with the same project "hola"')
    expect(prompt).toContain('Never use www.escalatokens.com')
    expect(prompt).not.toContain('www.escalatokens.com/api')
    const claude = claudeChatUrl(prompt)
    expect(claude.startsWith('https://claude.ai/new?q=')).toBe(true)
    expect(new URL(claude).searchParams.get('q')).toBe(prompt)
    const cursor = cursorPromptUrl(prompt)
    expect(cursor.startsWith('https://cursor.com/link/prompt?')).toBe(true)
    expect(new URL(cursor).searchParams.get('text')).toBe(prompt)
  })

  it('PROMPT names the exact add path for the selected client', () => {
    const claude = agentSetupPrompt('https://escalatokens.com', 'hola', 'claude')
    expect(claude).toContain(mcpClaudeAddCommand('https://escalatokens.com'))
    expect(claude).toContain('resolve_token with the same project "hola"')
    const cursor = agentSetupPrompt('https://www.escalatokens.com', 'hola', 'cursor')
    expect(cursor).toContain('.cursor/mcp.json')
    expect(cursor).toContain('https://escalatokens.com/api/mcp')
    expect(cursor).not.toContain('www.escalatokens.com/api')
    const vscode = agentSetupPrompt('https://escalatokens.com', 'hola', 'vscode')
    expect(vscode).toContain('"servers"')
    expect(vscode).toContain('.vscode/mcp.json')
  })

  it('Figma Agent lead is Make + skill, never a live MCP add', () => {
    expect(FIGMA_MAKE_URL).toBe('https://www.figma.com/make')
    const lead = figmaAgentLead('Acme App')
    expect(lead).toContain('Acme App')
    expect(lead).toContain('figma-use')
    expect(lead).toContain('Action/primary/default')
    expect(lead).toMatch(/cannot hold a live MCP/i)
    expect(lead).not.toMatch(/mcp add|\/api\/mcp/)
  })
})

describe('cliInstall', () => {
  it('normalizes --url to the publish origin', () => {
    expect(originFromMcpUrl('https://escalatokens.com/api/mcp')).toBe('https://escalatokens.com')
    expect(originFromMcpUrl('https://escalatokens.com/api/mcp/')).toBe('https://escalatokens.com')
    expect(originFromMcpUrl('https://preview.example')).toBe('https://preview.example')
  })

  it('points token fetch at the frozen /api/tokens contract', () => {
    expect(tokensUrl('https://escalatokens.com', 'acme-app')).toBe(
      'https://escalatokens.com/api/tokens?project=acme-app',
    )
  })

  it('slugifies --from the same way Figma Sync does', () => {
    const parsed = parseCliArgs(['skill', '--from', 'Acme App'])
    expect(parsed).toMatchObject({ kind: 'skill', slug: 'acme-app' })
  })

  it('rejects unknown skill clients and missing --from', () => {
    expect(parseCliArgs(['skill'])).toMatchObject({ kind: 'error' })
    expect(parseCliArgs(['skill', '--from', 'acme', '--client', 'make'])).toMatchObject({ kind: 'error' })
    expect(parseCliArgs(['wat'])).toMatchObject({ kind: 'error' })
    expect(parseCliArgs(['--help'])).toEqual({ kind: 'help' })
  })

  it('merges MCP JSON without dropping other servers', () => {
    const merged = mergeMcpConfig(
      { mcpServers: { other: { url: 'https://example' } } },
      'cursor',
      'https://escalatokens.com',
    )
    expect(merged.mcpServers).toEqual({
      other: { url: 'https://example' },
      [MCP_SERVER_NAME]: { url: 'https://escalatokens.com/api/mcp', type: 'http' },
    })
    const vscode = mergeMcpConfig({}, 'vscode', 'https://preview.example')
    expect(vscode.servers).toEqual({
      [MCP_SERVER_NAME]: { url: 'https://preview.example/api/mcp', type: 'http' },
    })
  })

  it('plans skill files under the same folder the zip uses', () => {
    const { relativeDir, files } = planSkillInstall(FIXTURE, 'cursor')
    expect(relativeDir).toBe(skillInstallPath('cursor', 'Acme App').replace(/\/$/, ''))
    expect(files.some((f) => f.path === 'SKILL.md')).toBe(true)
    expect(files.some((f) => f.path === 'AGENTS.md')).toBe(true)
  })

  it('rejects payloads that are not published tokens', () => {
    expect(isPublishedTokens({ error: 'No tokens published yet.' })).toBe(false)
    expect(isPublishedTokens(FIXTURE)).toBe(true)
  })

  it('writes skill files from a fetched payload', async () => {
    const written = new Map<string, string>()
    const code = await runCli(['skill', '--from', 'acme-app', '--client', 'cursor'], {
      cwd: '/repo',
      fetch: async (url) => {
        expect(url).toBe(tokensUrl(DEFAULT_PUBLISH_ORIGIN, 'acme-app'))
        return { ok: true, status: 200, json: async () => FIXTURE }
      },
      readFile: () => null,
      writeFile: (path, text) => { written.set(path, text) },
      mkdirp: () => {},
      log: () => {},
      error: () => {},
    })
    expect(code).toBe(0)
    const skillMd = [...written.keys()].find((p) => p.endsWith('SKILL.md'))
    expect(skillMd).toBe(`/repo/${skillInstallPath('cursor', 'Acme App')}SKILL.md`)
    expect(written.get(skillMd!)?.startsWith('---')).toBe(true)
  })

  it('merges into an existing Cursor mcp.json', async () => {
    const written = new Map<string, string>()
    const code = await runCli(['mcp', 'init', '--client', 'cursor'], {
      cwd: '/repo',
      fetch: async () => ({ ok: false, status: 500, json: async () => ({}) }),
      readFile: (path) => path === '/repo/.cursor/mcp.json'
        ? JSON.stringify({ mcpServers: { kept: { url: 'https://kept' } } })
        : null,
      writeFile: (path, text) => { written.set(path, text) },
      mkdirp: () => {},
      log: () => {},
      error: () => {},
    })
    expect(code).toBe(0)
    const json = JSON.parse(written.get('/repo/.cursor/mcp.json')!)
    expect(json.mcpServers.kept).toEqual({ url: 'https://kept' })
    expect(json.mcpServers[MCP_SERVER_NAME].url).toBe(`${DEFAULT_PUBLISH_ORIGIN}/api/mcp`)
  })

  it('returns 1 when the blob is missing', async () => {
    let err = ''
    const code = await runCli(['skill', '--from', 'missing'], {
      cwd: '.',
      fetch: async () => ({ ok: false, status: 404, json: async () => ({ error: 'No tokens published yet.' }) }),
      readFile: () => null,
      writeFile: () => {},
      mkdirp: () => {},
      log: () => {},
      error: (msg) => { err = msg },
    })
    expect(code).toBe(1)
    expect(err).toContain('/api/tokens?project=missing')
    expect(err).toContain('unzip')
  })

  it('prints usage on --help', async () => {
    let out = ''
    const code = await runCli(['--help'], {
      cwd: '.',
      fetch: async () => ({ ok: false, status: 0, json: async () => ({}) }),
      readFile: () => null,
      writeFile: () => {},
      mkdirp: () => {},
      log: (msg) => { out = msg },
      error: () => {},
    })
    expect(code).toBe(0)
    expect(out).toBe(CLI_USAGE)
  })
})
