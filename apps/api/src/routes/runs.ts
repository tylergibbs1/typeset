import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { listRunsSchema } from '../schemas/runs'
import { problemDetails } from '../lib/errors'
import { eq, and, desc } from '@typeset/db'
import type { Database } from '@typeset/db'

export function runRoutes(deps: { db: Database }) {
  const app = new Hono()

  app.get('/runs/:id', async (c) => {
    const id = c.req.param('id')
    const orgId = c.get('orgId') as string

    const { runs } = await import('@typeset/db/schema')
    const [run] = await deps.db
      .select()
      .from(runs)
      .where(and(eq(runs.id, id), eq(runs.orgId, orgId)))
      .limit(1)

    if (!run) {
      return problemDetails(c, 404, {
        type: 'https://typeset.dev/errors/not-found',
        title: 'Run not found',
        detail: `Run ${id} not found`,
      })
    }

    return c.json({ data: run })
  })

  app.get('/runs', zValidator('query', listRunsSchema), async (c) => {
    const query = c.req.valid('query')
    const orgId = c.get('orgId') as string

    const { runs } = await import('@typeset/db/schema')
    const conditions = [eq(runs.orgId, orgId)]
    if (query.status) conditions.push(eq(runs.status, query.status))
    if (query.template_id) conditions.push(eq(runs.templateId, query.template_id))

    const results = await deps.db
      .select()
      .from(runs)
      .where(and(...conditions))
      .orderBy(desc(runs.createdAt))
      .limit(query.limit + 1)

    const hasMore = results.length > query.limit
    const data = hasMore ? results.slice(0, -1) : results
    const cursor = hasMore ? data[data.length - 1]!.id : null

    return c.json({
      data,
      pagination: { cursor, hasMore },
    })
  })

  return app
}
