import { afterEach, describe, expect, it } from 'vitest'
import { publishOrigin, syncPath, syncProjectId } from '../figmaSync'
import { DEFAULT_PUBLISH_ORIGIN } from '../agentInstall'

/** The suite runs in `environment: 'node'`, so there is no `window` unless a
 *  test installs one. That is what lets us drive `publishOrigin` through each
 *  host case without jsdom — it only ever reads `window.location.origin`. */
function withOrigin(origin: string | null) {
  const g = globalThis as { window?: unknown }
  if (origin === null) delete g.window
  else g.window = { location: { origin } }
}

afterEach(() => withOrigin(null))

describe('publishOrigin', () => {
  // Regression: served from vite dev/preview this returned the localhost
  // origin, so the AI-agents panel printed
  // `claude mcp add … http://localhost:4173/api/mcp` — a hard 404, because
  // `api/*.ts` are Vercel functions and Vite serves only the bundle. The
  // command registered a server that could never answer.
  it('resolves a localhost origin to the deployed apex, so a copied MCP command works', () => {
    withOrigin('http://localhost:4173')
    expect(publishOrigin()).toBe(DEFAULT_PUBLISH_ORIGIN)
    withOrigin('http://localhost:5173')
    expect(publishOrigin()).toBe(DEFAULT_PUBLISH_ORIGIN)
    withOrigin('http://127.0.0.1:3000')
    expect(publishOrigin()).toBe(DEFAULT_PUBLISH_ORIGIN)
  })

  it('keeps a real deployed origin, so a preview deployment addresses itself', () => {
    withOrigin('https://escala-tokens-git-branch.vercel.app')
    expect(publishOrigin()).toBe('https://escala-tokens-git-branch.vercel.app')
  })

  it('rewrites www to the apex so MCP and Figma fetch stay on one host', () => {
    withOrigin('https://www.escalatokens.com')
    expect(publishOrigin()).toBe(DEFAULT_PUBLISH_ORIGIN)
  })

  it('falls back to the apex with no window at all (SSR / node)', () => {
    withOrigin(null)
    expect(publishOrigin()).toBe(DEFAULT_PUBLISH_ORIGIN)
  })

  it('never changes where a publish POSTs — that path stays relative', () => {
    // The guard above is display-only. If `publishTokens` ever switched from
    // `syncPath()` to an absolute URL built on `publishOrigin()`, a dev build
    // would start writing to the production Blob; this pins the contract.
    withOrigin('http://localhost:5173')
    expect(syncPath('theme')).toBe('/api/tokens?project=theme')
    expect(syncPath('theme').startsWith('/')).toBe(true)
  })
})

describe('figma sync id', () => {
  it('keys /api/tokens on the file name, not a second project id', () => {
    expect(syncProjectId('theme')).toBe('theme')
    expect(syncProjectId('Nature / Organic')).toBe('nature--organic')
    expect(syncPath('theme')).toBe('/api/tokens?project=theme')
  })

  it('falls back to the editor project when the file name is empty', () => {
    expect(syncProjectId('')).toBe(syncProjectId())
    expect(syncProjectId('   ')).toBe(syncProjectId())
  })
})
