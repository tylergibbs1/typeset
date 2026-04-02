import { createMiddleware } from 'hono/factory'
import type { Redis } from '../lib/redis'

export function idempotency(redis: Redis) {
  return createMiddleware(async (c, next) => {
    if (c.req.method !== 'POST') {
      return await next()
    }

    const key = c.req.header('Idempotency-Key')
    if (!key) {
      return await next()
    }

    const apiKeyId = c.get('apiKeyId') as string
    const cacheKey = `idem:${apiKeyId}:${key}`
    const cached = await redis.get(cacheKey)

    if (cached) {
      const record = (typeof cached === 'string' ? JSON.parse(cached) : cached) as {
        status: number
        body: unknown
      }
      return c.json(record.body, record.status as 200)
    }

    await next()

    // Cache successful responses
    if (c.res.status >= 200 && c.res.status < 300) {
      // Clone the response to read the body without consuming it
      const cloned = c.res.clone()
      const body = await cloned.json()
      await redis.set(
        cacheKey,
        JSON.stringify({ status: c.res.status, body }),
        { ex: 86400 }
      )
    }
  })
}
