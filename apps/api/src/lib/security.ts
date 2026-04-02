const PRIVATE_RANGES = [
  { prefix: '10.', bits: 8 },
  { prefix: '172.16.', bits: 12 },
  { prefix: '172.17.', bits: 12 },
  { prefix: '172.18.', bits: 12 },
  { prefix: '172.19.', bits: 12 },
  { prefix: '172.20.', bits: 12 },
  { prefix: '172.21.', bits: 12 },
  { prefix: '172.22.', bits: 12 },
  { prefix: '172.23.', bits: 12 },
  { prefix: '172.24.', bits: 12 },
  { prefix: '172.25.', bits: 12 },
  { prefix: '172.26.', bits: 12 },
  { prefix: '172.27.', bits: 12 },
  { prefix: '172.28.', bits: 12 },
  { prefix: '172.29.', bits: 12 },
  { prefix: '172.30.', bits: 12 },
  { prefix: '172.31.', bits: 12 },
  { prefix: '192.168.', bits: 16 },
  { prefix: '127.', bits: 8 },
  { prefix: '169.254.', bits: 16 },
  { prefix: '0.', bits: 8 },
] as const

export function isPrivateIp(ip: string): boolean {
  return PRIVATE_RANGES.some((range) => ip.startsWith(range.prefix))
}

export class SecurityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SecurityError'
  }
}

export async function safeFetch(url: string): Promise<Response> {
  const parsed = new URL(url)

  // Block dangerous schemes
  const blockedSchemes = ['file:', 'ftp:', 'gopher:']
  if (blockedSchemes.includes(parsed.protocol)) {
    throw new SecurityError(`Blocked scheme: ${parsed.protocol}`)
  }

  // Resolve DNS and check IP — use standard DNS resolution
  const resolver = new (await import('node:dns')).promises.Resolver()
  const addresses = await resolver.resolve4(parsed.hostname)
  for (const addr of addresses) {
    if (isPrivateIp(addr)) {
      throw new SecurityError(`Blocked: ${parsed.hostname} resolves to private IP ${addr}`)
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)

  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: 'error',
    })
  } finally {
    clearTimeout(timeout)
  }
}
