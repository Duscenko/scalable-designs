import type { VercelRequest, VercelResponse } from '@vercel/node'
import { head } from '@vercel/blob'
import { handleMcpMessage, mcpDiscovery } from '../src/lib/agentAccess/mcp.js'
import type { TokenJSON } from '../src/lib/agentBundle/types.js'
import { tokenBlobKey } from '../src/lib/publishTrust.js'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, MCP-Protocol-Version',
}

function slugifyProject(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const slug = raw.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  return slug || null
}

async function loadTokens(project?: string | null): Promise<TokenJSON | null> {
  const slug = slugifyProject(project)
  if (!slug) return null
  try {
    const url = (await head(tokenBlobKey(slug))).url
    if (!url) return null
    const raw = await fetch(url)
    if (!raw.ok) return null
    return (await raw.json()) as TokenJSON
  } catch {
    return null
  }
}

function applyCors(res: VercelResponse) {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS).end()
    return
  }

  applyCors(res)
  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'HEAD') {
    return res.status(200).end()
  }

  if (req.method === 'GET') {
    const proto = (req.headers['x-forwarded-proto'] as string) || 'https'
    const host = req.headers.host || 'escalatokens.com'
    const origin = `${proto}://${host}`
    return res.status(200).json(mcpDiscovery(origin))
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. POST JSON-RPC 2.0, or GET for discovery.' })
  }

  const body = req.body
  const result = await handleMcpMessage(body, loadTokens)
  if (result === null) {
    res.status(202).end()
    return
  }
  return res.status(200).json(result)
}
