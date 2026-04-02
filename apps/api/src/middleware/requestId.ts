import { createMiddleware } from 'hono/factory'
import { nanoid } from '../lib/ids'

export const requestId = createMiddleware(async (c, next) => {
  const id = c.req.header('X-Request-Id') ?? `req_${nanoid()}`
  c.set('requestId', id)
  c.header('X-Request-Id', id)
  await next()
})
