import { describe, test, expect } from 'bun:test'
import { isPrivateIp, SecurityError } from '../lib/security'

describe('isPrivateIp', () => {
  describe('returns true for private/reserved IP ranges', () => {
    test('10.x.x.x — RFC 1918 Class A', () => {
      expect(isPrivateIp('10.0.0.0')).toBe(true)
      expect(isPrivateIp('10.0.0.1')).toBe(true)
      expect(isPrivateIp('10.255.255.255')).toBe(true)
    })

    test('172.16.x.x through 172.31.x.x — RFC 1918 Class B', () => {
      expect(isPrivateIp('172.16.0.0')).toBe(true)
      expect(isPrivateIp('172.16.0.1')).toBe(true)
      expect(isPrivateIp('172.20.1.1')).toBe(true)
      expect(isPrivateIp('172.31.255.255')).toBe(true)
    })

    test('192.168.x.x — RFC 1918 Class C', () => {
      expect(isPrivateIp('192.168.0.0')).toBe(true)
      expect(isPrivateIp('192.168.1.1')).toBe(true)
      expect(isPrivateIp('192.168.255.255')).toBe(true)
    })

    test('127.x.x.x — loopback', () => {
      expect(isPrivateIp('127.0.0.0')).toBe(true)
      expect(isPrivateIp('127.0.0.1')).toBe(true)
      expect(isPrivateIp('127.255.255.255')).toBe(true)
    })

    test('169.254.x.x — link-local', () => {
      expect(isPrivateIp('169.254.0.0')).toBe(true)
      expect(isPrivateIp('169.254.1.1')).toBe(true)
      expect(isPrivateIp('169.254.169.254')).toBe(true) // AWS metadata endpoint
    })

    test('0.x.x.x — unspecified/current network', () => {
      expect(isPrivateIp('0.0.0.0')).toBe(true)
      expect(isPrivateIp('0.0.0.1')).toBe(true)
      expect(isPrivateIp('0.255.255.255')).toBe(true)
    })
  })

  describe('returns false for public IPs', () => {
    test('8.8.8.8 — Google DNS', () => {
      expect(isPrivateIp('8.8.8.8')).toBe(false)
    })

    test('1.1.1.1 — Cloudflare DNS', () => {
      expect(isPrivateIp('1.1.1.1')).toBe(false)
    })

    test('172.32.0.0 — just outside RFC 1918 Class B range', () => {
      expect(isPrivateIp('172.32.0.0')).toBe(false)
    })

    test('172.15.0.0 — just below RFC 1918 Class B range', () => {
      expect(isPrivateIp('172.15.0.0')).toBe(false)
    })

    test('11.0.0.1 — public range above 10.x', () => {
      expect(isPrivateIp('11.0.0.1')).toBe(false)
    })

    test('192.169.0.1 — just above 192.168.x.x', () => {
      expect(isPrivateIp('192.169.0.1')).toBe(false)
    })

    test('192.167.0.1 — just below 192.168.x.x', () => {
      expect(isPrivateIp('192.167.0.1')).toBe(false)
    })
  })
})

describe('SecurityError', () => {
  test('extends Error', () => {
    const err = new SecurityError('blocked')
    expect(err instanceof Error).toBe(true)
  })

  test('name is SecurityError', () => {
    const err = new SecurityError('test message')
    expect(err.name).toBe('SecurityError')
  })

  test('message is set correctly', () => {
    const err = new SecurityError('Blocked scheme: file:')
    expect(err.message).toBe('Blocked scheme: file:')
  })

  test('can be caught as an Error', () => {
    let caught: unknown
    try {
      throw new SecurityError('ssrf attempt')
    } catch (e) {
      caught = e
    }
    expect(caught instanceof Error).toBe(true)
    expect((caught as SecurityError).name).toBe('SecurityError')
  })
})
