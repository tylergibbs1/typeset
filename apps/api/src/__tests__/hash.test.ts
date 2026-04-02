import { describe, test, expect } from 'bun:test'
import { sha256 } from '../lib/hash'

// Known SHA-256 hash of "hello" (from NIST / standard test vectors)
const HELLO_HASH = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'

describe('sha256', () => {
  test('produces the known SHA-256 hash for "hello"', async () => {
    const result = await sha256('hello')
    expect(result).toBe(HELLO_HASH)
  })

  test('returns a 64-character hex string', async () => {
    const result = await sha256('any input')
    expect(typeof result).toBe('string')
    expect(result.length).toBe(64)
    expect(/^[0-9a-f]+$/.test(result)).toBe(true)
  })

  test('is deterministic — same input produces the same hash', async () => {
    const first = await sha256('deterministic test')
    const second = await sha256('deterministic test')
    expect(first).toBe(second)
  })

  test('different inputs produce different hashes', async () => {
    const a = await sha256('input-a')
    const b = await sha256('input-b')
    expect(a).not.toBe(b)
  })

  test('empty string produces a known hash', async () => {
    // SHA-256 of "" is e3b0c44298fc1c149afb...
    const result = await sha256('')
    expect(result).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })

  test('handles unicode input', async () => {
    const result = await sha256('héllo')
    expect(typeof result).toBe('string')
    expect(result.length).toBe(64)
  })
})
