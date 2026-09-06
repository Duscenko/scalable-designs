// Install recipes for a generated system — Cursor / Claude / MCP JSON.
// Pure: no store, no React. `AgentInstallPanel` (wizard + Docs → Use with AI)
// and `@escala/cli` call these so a path printed in Docs cannot drift from
// the zip's `skillName()`, from `/api/mcp`, or from the CLI that writes them.

import { skillName } from './agentBundle/names'
import { MCP_SERVER_NAME } from './agentAccess/mcp'

export { MCP_SERVER_NAME }

export type SkillAgent = 'cursor' | 'claude'
export type McpClient = 'cursor' | 'claude' | 'vscode'

export const CLI_PACKAGE = '@escala/cli'
/**
 * Public site. Vercel is only the host — never put *.vercel.app in user-facing copy.
 *
 * APEX, not `www.` — MCP recipes stay on one host. Both `escalatokens.com`
 * and `www.escalatokens.com` have valid certificates now; a 307 on POST is
 * still only followed by some clients, so generated MCP configs never point
 * at `www`. Both hosts are in `publishTrust.KNOWN_HOSTS`.
 */
export const DEFAULT_PUBLISH_ORIGIN = 'https://escalatokens.com'

/**
 * Host that MCP clients should open. `www` is rewritten to the apex so a
 * generated config never depends on a redirect. Preview hosts and the apex
 * pass through unchanged.
 */
export function mcpOrigin(origin: string): string {
  const raw = (origin || '').trim()
  if (!raw) return DEFAULT_PUBLISH_ORIGIN
  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  try {
    const u = new URL(withProto)
    if (u.hostname === 'www.escalatokens.com') return DEFAULT_PUBLISH_ORIGIN
    return `${u.protocol}//${u.host}`
  } catch {
    return DEFAULT_PUBLISH_ORIGIN
  }
}

export function mcpEndpoint(origin: string): string {
  return `${mcpOrigin(origin)}/api/mcp`
}

/** Cursor / Claude Desktop project file: `.cursor/mcp.json`. */
export function mcpCursorConfig(origin: string): string {
  return JSON.stringify(
    { mcpServers: { [MCP_SERVER_NAME]: { url: mcpEndpoint(origin), type: 'http' } } },
    null,
    2,
  )
}

/** VS Code Copilot MCP: `.vscode/mcp.json`. */
export function mcpVscodeConfig(origin: string): string {
  return JSON.stringify(
    { servers: { [MCP_SERVER_NAME]: { url: mcpEndpoint(origin), type: 'http' } } },
    null,
    2,
  )
}

/** Anthropic's CLI — not an Escala installer.
 *  `--scope project` writes `.mcp.json` in the product repo (flags before name). */
export function mcpClaudeAddCommand(origin: string): string {
  return `claude mcp add --transport http --scope project ${MCP_SERVER_NAME} ${mcpEndpoint(origin)}`
}

export function skillInstallPath(agent: SkillAgent, project: string): string {
  const name = skillName(project)
  return agent === 'cursor' ? `.cursor/skills/${name}/` : `.claude/skills/${name}/`
}

export function skillFolderName(project: string): string {
  return skillName(project)
}

export function mcpConfigPath(client: McpClient): string {
  if (client === 'vscode') return '.vscode/mcp.json'
  if (client === 'claude') return '.mcp.json'
  return '.cursor/mcp.json'
}

export function cliSkillCommand(
  slug: string,
  client: SkillAgent = 'cursor',
  origin: string = DEFAULT_PUBLISH_ORIGIN,
): string {
  const base = `npx ${CLI_PACKAGE} skill --from ${slug} --client ${client}`
  const host = origin.replace(/\/$/, '') || DEFAULT_PUBLISH_ORIGIN
  return host === DEFAULT_PUBLISH_ORIGIN ? base : `${base} --host ${host}`
}

export function cliMcpInitCommand(
  client: McpClient = 'cursor',
  origin: string = DEFAULT_PUBLISH_ORIGIN,
): string {
  return `npx ${CLI_PACKAGE} mcp init --client ${client} --url ${mcpEndpoint(origin)}`
}

/**
 * The "paste this to your agent" alternative to the numbered steps — one
 * message that connects the server and then PROVES it connected.
 *
 * Every claim is checked against something real: the endpoint is `mcpEndpoint`
 * (apex, never www), the transport is what `/api/mcp` actually speaks (plain
 * streamable HTTP, no auth — do NOT add a sign-in line), and the tool names
 * plus required `project` match `agentAccess/types.ts`. A vague "use whichever
 * config my editor expects" let agents invent `www.` or the wrong JSON key
 * (`mcpServers` vs `servers`) — so step 1 names the exact file or CLI command.
 */
export function agentSetupPrompt(
  origin: string = DEFAULT_PUBLISH_ORIGIN,
  slug?: string,
  client?: McpClient,
): string {
  const url = mcpEndpoint(origin)
  const project = slug?.trim() || 'YOUR_PUBLISHED_SLUG'
  return [
    'Set up my Escala design system in this repo.',
    `1. Add the MCP server named ${MCP_SERVER_NAME}. ${clientAddInstructions(client, origin, url)} The endpoint is streamable HTTP with no auth. Use the apex URL, not www.escalatokens.com — MCP recipes stay on one host. Restart the editor after adding.`,
    `2. Call get_tokens with project "${project}". If the tool says nothing is published, tell me to Sync from the configurator. Do not invent tokens.`,
    `3. From now on every colour, size and radius goes through resolve_token with the same project "${project}" — never a hex or a px. resolve_token requires project. Then run check_contrast on the resolved hexes before pairing an ink with a fill.`,
  ].join('\n')
}

function clientAddInstructions(
  client: McpClient | undefined,
  origin: string,
  url: string,
): string {
  if (client === 'claude') {
    return `Run \`${mcpClaudeAddCommand(origin)}\`.`
  }
  if (client === 'vscode') {
    return `Write \`.vscode/mcp.json\` — the key is "servers", not "mcpServers":\n${mcpVscodeConfig(origin)}`
  }
  if (client === 'cursor') {
    return `Write \`.cursor/mcp.json\`:\n${mcpCursorConfig(origin)}`
  }
  return `Use the config this editor expects. Cursor: \`.cursor/mcp.json\` with mcpServers.${MCP_SERVER_NAME}.url = ${url}. Claude Code: \`${mcpClaudeAddCommand(origin)}\`. VS Code: \`.vscode/mcp.json\` with servers.${MCP_SERVER_NAME} = { "url": "${url}", "type": "http" }.`
}

/** Claude web chat. Query is the same prompt Docs' PROMPT pane copies —
 *  connect MCP, then prove it. Never the catalog: URL length, and a pasted
 *  snapshot can go stale the way Live exists to prevent. */
export function claudeChatUrl(prompt: string): string {
  return `https://claude.ai/new?q=${encodeURIComponent(prompt)}`
}

/** Cursor prompt deeplink (web → app). Same prompt as Claude. */
export function cursorPromptUrl(prompt: string): string {
  const url = new URL('https://cursor.com/link/prompt')
  url.searchParams.set('text', prompt)
  return url.toString()
}

/** Figma Make has no query-handoff and no MCP. Open the Make surface; the
 *  clipboard carries the Skill. Variables still sync through the plugin. */
export const FIGMA_MAKE_URL = 'https://www.figma.com/make'

/** Lead-in pasted above SKILL.md for Figma Make / Figma Agent. */
export function figmaAgentLead(project: string): string {
  const name = project.trim() || 'Design system'
  return [
    `Use the Escala skill for ${name} in Figma Make.`,
    'Load figma-use before any use_figma call. Bind paints to semantic Figma names only (Action/primary/default), never a hex.',
    'Figma Make cannot hold a live MCP connection. Token names and bindings are in the skill below. Figma variables still sync through the Escala plugin.',
    '',
  ].join('\n')
}
