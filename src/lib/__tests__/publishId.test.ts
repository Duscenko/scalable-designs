import { describe, expect, it } from 'vitest'
import {
  canonicalizePublishId,
  generatePublishId,
  isPublishId,
  parsePublishRef,
} from '../publishId'

describe('generatePublishId', () => {
  it('mints a canonical, grouped id', () => {
    for (let i = 0; i < 200; i++) {
      const id = generatePublishId()
      expect(id).toMatch(/^esc_[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/)
      expect(isPublishId(id)).toBe(true)
      expect(canonicalizePublishId(id)).toBe(id)
    }
  })

  it('never emits the four ambiguous letters — these ids get re-typed from screenshots', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 500; i++) for (const ch of generatePublishId().slice(4)) seen.add(ch)
    for (const banned of ['I', 'L', 'O', 'U']) expect(seen.has(banned)).toBe(false)
  })

  it('does not collide across a realistic number of systems', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 5000; i++) ids.add(generatePublishId())
    expect(ids.size).toBe(5000)
  })
})

describe('canonicalizePublishId', () => {
  it('accepts the shapes a human actually pastes', () => {
    const want = 'esc_7K2M-9QX4-N3PD'
    expect(canonicalizePublishId('esc_7K2M-9QX4-N3PD')).toBe(want)
    expect(canonicalizePublishId('ESC_7K2M-9QX4-N3PD')).toBe(want)
    expect(canonicalizePublishId('esc_7k2m-9qx4-n3pd')).toBe(want)
    expect(canonicalizePublishId('7K2M-9QX4-N3PD')).toBe(want)         // prefix dropped
    expect(canonicalizePublishId('esc_7K2M9QX4N3PD')).toBe(want)       // ungrouped
    expect(canonicalizePublishId('  esc_7K2M 9QX4 N3PD  ')).toBe(want) // spaces for dashes
  })

  it('rejects a body of the wrong length or alphabet', () => {
    expect(canonicalizePublishId('esc_7K2M-9QX4-N3P')).toBeNull()
    expect(canonicalizePublishId('esc_7K2M-9QX4-N3PDX')).toBeNull()
    expect(canonicalizePublishId('esc_7K2M-9QX4-N3PI')).toBeNull() // banned letter
    expect(canonicalizePublishId('')).toBeNull()
    expect(canonicalizePublishId('escala')).toBeNull()
  })
})

describe('parsePublishRef', () => {
  const ID = 'esc_7K2M-9QX4-N3PD'

  it('reads the id out of every shape the plugin field will be handed', () => {
    for (const input of [
      ID,
      ID.toUpperCase(),
      '  esc_7k2m-9qx4-n3pd ',
      `https://escalatokens.com/api/tokens?project=${ID}`,
      `https://www.escalatokens.com/api/tokens?project=${ID}`,
      `https://escalatokens.com/?project=${ID}&section=color`,
      `http://localhost:3000/api/tokens?project=${ID}`,
      `Connect Figma with ${ID} — paste it in the plugin`,
    ]) {
      expect(parsePublishRef(input)).toEqual({ key: ID, legacy: false })
    }
  })

  it('survives a percent-encoded query value', () => {
    expect(parsePublishRef('https://escalatokens.com/api/tokens?project=esc%5F7K2M-9QX4-N3PD'))
      .toEqual({ key: ID, legacy: false })
  })

  it('keeps LEGACY name slugs working — those blobs still exist and still serve', () => {
    expect(parsePublishRef('https://escalatokens.com/api/tokens?project=escala'))
      .toEqual({ key: 'escala', legacy: true })
    expect(parsePublishRef('escala')).toEqual({ key: 'escala', legacy: true })
    expect(parsePublishRef('My System')).toEqual({ key: 'my-system', legacy: true })
  })

  it('prefers ?project= over an id mentioned elsewhere in the string', () => {
    // The parameter is what the endpoint reads; anything else in the URL is
    // decoration and must not win.
    expect(parsePublishRef(`https://escalatokens.com/${ID}/x?project=escala`))
      .toEqual({ key: 'escala', legacy: true })
  })

  it('rejects a MISTYPED id instead of reading it as a legacy name', () => {
    // These used to canonicalize to nothing, fall through to the slug path and
    // come back as `esc7k2m-9qx4-n3pi` — a key nobody has published, which then
    // 404s with total confidence. A typo in the id is the expected error here.
    expect(parsePublishRef('esc_7K2M-9QX4-N3PI')).toBeNull()  // banned letter
    expect(parsePublishRef('esc_7K2M-9QX4-N3P')).toBeNull()   // one short
    expect(parsePublishRef('esc_7K2M-9QX4-N3PDX')).toBeNull() // one long
    expect(parsePublishRef('ESC_nope')).toBeNull()
    // A legacy slug that merely starts with the same letters is untouched.
    expect(parsePublishRef('escala')).toEqual({ key: 'escala', legacy: true })
    expect(parsePublishRef('escape-hatch')).toEqual({ key: 'escape-hatch', legacy: true })
  })

  it('refuses a URL with no key rather than guessing one from the path', () => {
    expect(parsePublishRef('https://escalatokens.com/api/tokens')).toBeNull()
    expect(parsePublishRef('https://escalatokens.com/')).toBeNull()
    expect(parsePublishRef('')).toBeNull()
    expect(parsePublishRef('   ')).toBeNull()
  })

  it('round-trips a freshly minted id through a sync URL', () => {
    for (let i = 0; i < 100; i++) {
      const id = generatePublishId()
      const ref = parsePublishRef(`https://escalatokens.com/api/tokens?project=${id}`)
      expect(ref).toEqual({ key: id, legacy: false })
    }
  })
})
