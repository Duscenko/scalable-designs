/**
 * The STABLE identity of a published system.
 *
 * `/api/tokens?project=<key>` used to be keyed by `slugify(<Figma file name>)`,
 * and that file name defaults to the first theme's display label — so renaming
 * a theme silently moved the publish target to a new key. Measured on the live
 * deployment: the `green` slug served a system whose themes were `red::*`,
 * while `escala` served the green one, and a freshly-copied URL answered 404
 * because nothing had ever been published under the new name. A design system's
 * identity cannot be a label the designer is expected to keep editing.
 *
 * A publish id is minted once, travels inside `DesignSnapshot` (so a saved kit
 * and a `.escala/system.json` carry it), and never changes when anything is
 * renamed.
 *
 * DOM-free and dependency-free on purpose: the store, the publish path and the
 * migration all import it, and `crypto` is reached through a guarded global so
 * a non-browser caller (a test, a Node script) still works.
 */

export const PUBLISH_ID_PREFIX = 'esc'

/**
 * Crockford base32 minus the ambiguous letters (no I, L, O, U). 32 symbols, so
 * every character is exactly 5 bits and the alphabet survives being read aloud
 * or re-typed from a screenshot — which is how these actually travel.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/** 12 symbols x 5 bits = 60 bits. */
const ID_LENGTH = 12
const GROUP = 4

/**
 * DELIBERATELY NOT a short numeric code. `?list=1` was frozen to a non-answer
 * specifically so the token store is not a directory, and GET stays public and
 * unauthenticated — whoever holds the key reads the system. A counter-shaped id
 * turns "guess a slug" into "count", which is strictly worse than the English
 * word it replaces. 60 bits is not guessable at any request rate this endpoint
 * will ever serve.
 */
export function generatePublishId(): string {
  const bytes = new Uint8Array(ID_LENGTH)
  const cryptoObj = (globalThis as { crypto?: Crypto }).crypto
  if (cryptoObj?.getRandomValues) {
    cryptoObj.getRandomValues(bytes)
  } else {
    // Never reached in the app (every browser and Node >= 19 has webcrypto). A
    // throw here would break `makeDesignDefaults()` at import time in some
    // exotic runner, which is a worse failure than a weaker id in a context
    // that is not publishing anything.
    for (let i = 0; i < ID_LENGTH; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  let out = ''
  for (let i = 0; i < ID_LENGTH; i++) {
    if (i > 0 && i % GROUP === 0) out += '-'
    // Modulo bias over a 256-value byte into 32 symbols is exactly zero:
    // 256 is a whole multiple of 32.
    out += ALPHABET[bytes[i]! % ALPHABET.length]
  }
  return `${PUBLISH_ID_PREFIX}_${out}`
}

const ID_BODY = `[${ALPHABET}]{${GROUP}}(?:-[${ALPHABET}]{${GROUP}}){${ID_LENGTH / GROUP - 1}}`
const ID_RE = new RegExp(`^${PUBLISH_ID_PREFIX}_${ID_BODY}$`)
/** Same shape, un-anchored, for pulling an id out of a pasted URL. */
const ID_IN_TEXT_RE = new RegExp(`${PUBLISH_ID_PREFIX}_${ID_BODY}`, 'i')

export function isPublishId(value: unknown): value is string {
  return typeof value === 'string' && ID_RE.test(value.trim().toUpperCase().replace(/^ESC_/, 'esc_'))
}

/**
 * Canonical casing: the prefix stays lowercase, the body uppercase. Anything
 * pasted back — from a terminal, a Figma text layer, a chat message — normalizes
 * to one string, so a case difference can never read as a different system.
 */
export function canonicalizePublishId(raw: string): string | null {
  const compact = raw.trim().replace(/\s+/g, '')
  if (!compact) return null
  const withPrefix = compact.toLowerCase().startsWith(`${PUBLISH_ID_PREFIX}_`)
    ? compact.slice(PUBLISH_ID_PREFIX.length + 1)
    : compact
  const symbols = withPrefix.replace(/-/g, '').toUpperCase()
  if (symbols.length !== ID_LENGTH) return null
  for (const ch of symbols) if (!ALPHABET.includes(ch)) return null
  const grouped = symbols.match(new RegExp(`.{1,${GROUP}}`, 'g'))!.join('-')
  return `${PUBLISH_ID_PREFIX}_${grouped}`
}

/**
 * What the plugin's ONE connection field accepts. The alternative shape — a
 * "page URL" box beside an "ID" box — spends a second input on a value that is
 * the same constant almost every time, and hands the plugin the job of
 * composing an endpoint out of two user-supplied halves: one more place for a
 * trailing slash or a hand-typed `/api/tokens` to break the link. So: take
 * whatever the user has in the clipboard and find the key in it.
 *
 * Accepted, in order of how likely someone is to paste it:
 *   esc_7K2M-9QX4-N3PD                                  the id itself
 *   https://escalatokens.com/api/tokens?project=esc_…   the sync endpoint
 *   https://escalatokens.com/?project=esc_…             the workspace page
 *   https://escalatokens.com/api/tokens?project=escala  a LEGACY name slug
 *   escala                                              a legacy slug, bare
 *
 * Returns null only when there is nothing key-shaped at all. A legacy slug is
 * returned verbatim (`legacy: true`) rather than rejected: those blobs still
 * exist and still serve, and refusing them would break every file connected
 * before ids existed.
 */
export interface PublishRef {
  key: string
  legacy: boolean
}

export function parsePublishRef(input: string): PublishRef | null {
  const raw = (input ?? '').trim()
  if (!raw) return null

  // A MISTYPED id must not be reinterpreted as a legacy name. `esc_7K2M-9QX4-N3PI`
  // (banned letter) used to fall through to `legacySlug()` and come back as the
  // key `esc7k2m-9qx4-n3pi`, which then 404s with total confidence against a
  // string nobody has ever published. Typing an id wrong is THE expected error
  // here, so it gets rejected as one.
  if (/^esc_/i.test(raw) && !canonicalizePublishId(raw)) return null

  // A URL with an explicit ?project= wins over anything else in the string:
  // it is the parameter the endpoint actually reads.
  const fromQuery = /[?&]project=([^&#\s]+)/i.exec(raw)
  if (fromQuery) {
    let value = fromQuery[1]!
    try { value = decodeURIComponent(value) } catch { /* keep the raw form */ }
    const id = canonicalizePublishId(value)
    if (id) return { key: id, legacy: false }
    const slug = legacySlug(value)
    return slug ? { key: slug, legacy: true } : null
  }

  // A bare id, or one embedded in text that has no query string (a chat
  // message, a Figma layer name, the last path segment of a share link).
  const embedded = ID_IN_TEXT_RE.exec(raw)
  if (embedded) {
    const id = canonicalizePublishId(embedded[0])
    if (id) return { key: id, legacy: false }
  }
  const direct = canonicalizePublishId(raw)
  if (direct) return { key: direct, legacy: false }

  // A bare legacy slug. Rejected when it looks like a URL, because a URL with
  // no ?project= carries no key at all and guessing one from the path would
  // silently connect the plugin to the wrong system.
  if (/^https?:\/\//i.test(raw) || raw.includes('/')) return null
  const slug = legacySlug(raw)
  return slug ? { key: slug, legacy: true } : null
}

/** The pre-id key shape: `slugify()` from utils, kept local so this module
 *  stays importable from anywhere without dragging in DOM helpers. */
function legacySlug(value: string): string | null {
  const slug = value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  return slug || null
}
