// The repo consumes its own MCP server. `.mcp.json` at the root is what wires
// it into Claude Code for anyone who clones this project, and its two values —
// the server name and the endpoint — are the SAME two `agentInstall.ts` prints
// to users in Docs (`mcpClaudeAddCommand`, `mcpCursorConfig`, `mcpVscodeConfig`).
//
// They agree today only because a human copied them across, which is precisely
// the kind of coincidence this repo turns into a guarantee elsewhere
// (`useIt.test.ts` for the Figma sets, `no-duplication.test.ts` for the colour
// layer). Without these assertions, moving `DEFAULT_PUBLISH_ORIGIN` would leave
// this repo's own agent pointed at the old host in silence — and a config that
// is one host stale fails at the TLS handshake, before a single JSON-RPC byte,
// so the failure would read as "the MCP is broken" rather than "the config
// drifted".

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  MCP_SERVER_NAME, mcpEndpoint, DEFAULT_PUBLISH_ORIGIN,
} from '../agentInstall'

const CONFIG_PATH = fileURLToPath(new URL('../../../.mcp.json', import.meta.url))

type McpConfig = {
  mcpServers?: Record<string, { type?: string; url?: string }>
}

const config: McpConfig = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))

describe('.mcp.json', () => {
  it('registers the server under the name the product itself publishes', () => {
    expect(Object.keys(config.mcpServers ?? {})).toEqual([MCP_SERVER_NAME])
  })

  it('points at the endpoint `agentInstall` hands users, not a hand-typed copy', () => {
    expect(config.mcpServers?.[MCP_SERVER_NAME]?.url)
      .toBe(mcpEndpoint(DEFAULT_PUBLISH_ORIGIN))
  })

  it('declares the HTTP transport `/api/mcp` actually speaks', () => {
    // Plain streamable HTTP, no auth — see `agentSetupPrompt` in agentInstall.ts.
    // A stdio entry here would need a command to spawn and there isn't one.
    expect(config.mcpServers?.[MCP_SERVER_NAME]?.type).toBe('http')
  })

  it('uses the apex host, because the certificate covers only the apex', () => {
    // `www.escalatokens.com` fails TLS verification for any strict client, and
    // every MCP client verifies. This is the one substitution that looks
    // harmless and kills the connection outright.
    const url = config.mcpServers?.[MCP_SERVER_NAME]?.url ?? ''
    expect(url.startsWith('https://')).toBe(true)
    expect(url).not.toContain('www.')
  })
})
