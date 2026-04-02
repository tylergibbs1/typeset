import { createMiddleware } from 'hono/factory'
import { eq } from '@typeset/db'
import type { Database } from '@typeset/db'
import { problemDetails } from '../lib/errors'

export function auth(db: Database) {
  return createMiddleware(async (c, next) => {
    const header = c.req.header('Authorization')
    if (!header?.startsWith('Bearer ')) {
      return problemDetails(c, 401, {
        type: 'https://typeset.dev/errors/unauthorized',
        title: 'Unauthorized',
        detail: 'Missing or malformed Authorization header. Use: Bearer ts_...',
      })
    }

    const token = header.slice(7)
    if (!token.startsWith('ts_')) {
      return problemDetails(c, 401, {
        type: 'https://typeset.dev/errors/unauthorized',
        title: 'Unauthorized',
        detail: 'Invalid API key format',
      })
    }

    const encoder = new TextEncoder()
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(token))
    const keyHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    const { apiKeys } = await import('@typeset/db/schema')
    const [key] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash)).limit(1)

    if (!key || key.revokedAt) {
      return problemDetails(c, 401, {
        type: 'https://typeset.dev/errors/unauthorized',
        title: 'Unauthorized',
        detail: key?.revokedAt ? 'API key has been revoked' : 'Invalid API key',
      })
    }

    c.set('apiKey', key)
    c.set('apiKeyId', key.id)
    c.set('orgId', key.orgId)
    await next()
  })
}

type KeyScope = 'render' | 'extract' | 'template' | 'admin' | 'full'

export function requireScope(scope: KeyScope) {
  return createMiddleware(async (c, next) => {
    const key = c.get('apiKey') as { scopes: string[] }
    if (!key.scopes.includes(scope) && !key.scopes.includes('full')) {
      return problemDetails(c, 403, {
        type: 'https://typeset.dev/errors/insufficient-scope',
        title: 'Insufficient permissions',
        detail: `This API key does not have the "${scope}" scope`,
      })
    }
    await next()
  })
}
