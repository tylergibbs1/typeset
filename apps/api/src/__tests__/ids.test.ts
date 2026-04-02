import { describe, test, expect } from 'bun:test'
import { nanoid, runId, templateId } from '../lib/ids'

const ALPHANUMERIC_RE = /^[0-9a-z]+$/

describe('nanoid', () => {
  test('returns a string of default length 16', () => {
    const id = nanoid()
    expect(typeof id).toBe('string')
    expect(id.length).toBe(16)
  })

  test('returns a string of custom length 8', () => {
    const id = nanoid(8)
    expect(id.length).toBe(8)
  })

  test('returns a string of custom length 32', () => {
    const id = nanoid(32)
    expect(id.length).toBe(32)
  })

  test('contains only lowercase alphanumeric characters', () => {
    const id = nanoid(64)
    expect(ALPHANUMERIC_RE.test(id)).toBe(true)
  })

  test('two calls produce different IDs', () => {
    const a = nanoid()
    const b = nanoid()
    expect(a).not.toBe(b)
  })
})

describe('runId', () => {
  test('starts with run_', () => {
    const id = runId()
    expect(id.startsWith('run_')).toBe(true)
  })

  test('the part after run_ is 16 alphanumeric characters', () => {
    const id = runId()
    const suffix = id.slice('run_'.length)
    expect(suffix.length).toBe(16)
    expect(ALPHANUMERIC_RE.test(suffix)).toBe(true)
  })

  test('two calls produce different IDs', () => {
    const a = runId()
    const b = runId()
    expect(a).not.toBe(b)
  })
})

describe('templateId', () => {
  test('starts with tpl_', () => {
    const id = templateId()
    expect(id.startsWith('tpl_')).toBe(true)
  })

  test('the part after tpl_ is 16 alphanumeric characters', () => {
    const id = templateId()
    const suffix = id.slice('tpl_'.length)
    expect(suffix.length).toBe(16)
    expect(ALPHANUMERIC_RE.test(suffix)).toBe(true)
  })

  test('two calls produce different IDs', () => {
    const a = templateId()
    const b = templateId()
    expect(a).not.toBe(b)
  })
})
