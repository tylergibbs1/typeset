import { createMiddleware } from 'hono/factory'

const CURRENT_VERSION = '2026-04-01'

export const version = createMiddleware(async (c, next) => {
  const requested = c.req.header('Typeset-Version') ?? CURRENT_VERSION
  c.header('Typeset-Version', requested)
  await next()
})
