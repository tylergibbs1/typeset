export const RENDER_SECURITY = {
  csp: "default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data: https:",
  blockedSchemes: ['file:', 'ftp:', 'gopher:'] as const,
  blockedIpRanges: [
    '10.0.0.0/8',
    '172.16.0.0/12',
    '192.168.0.0/16',
    '127.0.0.0/8',
    '169.254.0.0/16',
    '0.0.0.0/8',
  ] as const,
  maxRenderTimeMs: 30_000,
  maxMemoryMb: 512,
  maxPageCount: 500,
} as const

export function applySandbox(html: string): string {
  const cspMeta = `<meta http-equiv="Content-Security-Policy" content="${RENDER_SECURITY.csp}">`
  if (html.includes('<head>')) {
    return html.replace('<head>', `<head>\n${cspMeta}`)
  }
  return `<!DOCTYPE html><html><head>${cspMeta}</head><body>${html}</body></html>`
}
