import { createMiddleware } from 'hono/factory'
import { problemDetails } from '../lib/errors'
import type { Redis } from '../lib/redis'

export function rateLimit(redis: Redis) {
  return createMiddleware(async (c, next) => {
    const apiKey = c.get('apiKey') as { id: string; rateLimitRpm: number }
    const limit = apiKey.rateLimitRpm
    const window = 60 // seconds
    const key = `rl:${apiKey.id}`
    const now = Math.floor(Date.now() / 1000)

    const count = await redis.incr(key)
    if (count === 1) {
      await redis.expire(key, window)
    }

    c.header('X-RateLimit-Limit', String(limit))
    c.header('X-RateLimit-Remaining', String(Math.max(0, limit - count)))
    c.header('X-RateLimit-Reset', String(now + window))

    if (count > limit) {
      return problemDetails(c, 429, {
        type: 'https://typeset.dev/errors/rate-limit',
        title: 'Rate limit exceeded',
        detail: `Rate limit of ${limit} requests per minute exceeded`,
      })
    }

    await next()
  })
}
