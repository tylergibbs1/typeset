import { describe, test, expect } from 'bun:test'
import { applySandbox, RENDER_SECURITY } from '../render/sandbox'

describe('applySandbox', () => {
  test('injects CSP meta tag into existing <head>', () => {
    const html = '<html><head><title>Test</title></head><body>hello</body></html>'
    const result = applySandbox(html)
    expect(result).toContain('<head>\n<meta http-equiv="Content-Security-Policy"')
    expect(result).toContain(RENDER_SECURITY.csp)
  })

  test('CSP meta tag is placed immediately after <head>', () => {
    const html = '<html><head></head><body></body></html>'
    const result = applySandbox(html)
    // The tag must appear before any other head content
    const headIdx = result.indexOf('<head>')
    const cspIdx = result.indexOf('<meta http-equiv="Content-Security-Policy"')
    expect(cspIdx).toBeGreaterThan(headIdx)
    expect(cspIdx).toBeLessThan(result.indexOf('</head>'))
  })

  test('wraps bare HTML (no <head>) in a full document structure', () => {
    const html = '<p>Just a paragraph</p>'
    const result = applySandbox(html)
    expect(result).toMatch(/^<!DOCTYPE html>/)
    expect(result).toContain('<html>')
    expect(result).toContain('<head>')
    expect(result).toContain('</head>')
    expect(result).toContain('<body>')
    expect(result).toContain('<p>Just a paragraph</p>')
    expect(result).toContain('</body>')
    expect(result).toContain('</html>')
  })

  test('wraps bare HTML and includes the CSP meta tag', () => {
    const html = '<p>content</p>'
    const result = applySandbox(html)
    expect(result).toContain(`<meta http-equiv="Content-Security-Policy" content="${RENDER_SECURITY.csp}">`)
  })

  test('does not double-wrap HTML that already has a <head>', () => {
    const html = '<!DOCTYPE html><html><head></head><body>hi</body></html>'
    const result = applySandbox(html)
    // Only one <html> tag
    expect(result.match(/<html>/g)?.length).toBe(1)
  })
})

describe('RENDER_SECURITY constants', () => {
  test('csp string is a non-empty string', () => {
    expect(typeof RENDER_SECURITY.csp).toBe('string')
    expect(RENDER_SECURITY.csp.length).toBeGreaterThan(0)
  })

  test('csp disallows default-src', () => {
    expect(RENDER_SECURITY.csp).toContain("default-src 'none'")
  })

  test('csp allows inline styles', () => {
    expect(RENDER_SECURITY.csp).toContain("style-src 'unsafe-inline'")
  })

  test('blockedSchemes contains file:, ftp:, gopher:', () => {
    expect(RENDER_SECURITY.blockedSchemes).toContain('file:')
    expect(RENDER_SECURITY.blockedSchemes).toContain('ftp:')
    expect(RENDER_SECURITY.blockedSchemes).toContain('gopher:')
  })

  test('blockedIpRanges covers private network ranges', () => {
    const ranges = RENDER_SECURITY.blockedIpRanges as readonly string[]
    expect(ranges).toContain('10.0.0.0/8')
    expect(ranges).toContain('172.16.0.0/12')
    expect(ranges).toContain('192.168.0.0/16')
    expect(ranges).toContain('127.0.0.0/8')
    expect(ranges).toContain('169.254.0.0/16')
    expect(ranges).toContain('0.0.0.0/8')
  })

  test('maxRenderTimeMs is a positive number', () => {
    expect(RENDER_SECURITY.maxRenderTimeMs).toBeGreaterThan(0)
  })

  test('maxMemoryMb is a positive number', () => {
    expect(RENDER_SECURITY.maxMemoryMb).toBeGreaterThan(0)
  })

  test('maxPageCount is a positive number', () => {
    expect(RENDER_SECURITY.maxPageCount).toBeGreaterThan(0)
  })
})
