import { createMiddleware } from 'hono/factory'
import { eq, and, sql } from '@typeset/db'
import type { Database } from '@typeset/db'

export function trackUsage(db: Database, type: 'render' | 'extract' | 'verify') {
  return createMiddleware(async (c, next) => {
    await next()

    // Only track successful requests
    if (c.res.status < 200 || c.res.status >= 300) return

    const orgId = c.get('orgId') as string
    const month = new Date().toISOString().slice(0, 7) // '2026-04'

    const { usage } = await import('@typeset/db/schema')
    const column = type === 'render'
      ? usage.renderCount
      : type === 'extract'
        ? usage.extractCount
        : usage.verifyCount

    await db
      .insert(usage)
      .values({ orgId, month, renderCount: 0, extractCount: 0, verifyCount: 0 })
      .onConflictDoUpdate({
        target: [usage.orgId, usage.month],
        set: { [type === 'render' ? 'renderCount' : type === 'extract' ? 'extractCount' : 'verifyCount']: sql`${column} + 1` },
      })
  })
}
