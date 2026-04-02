import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { requireScope } from '../middleware/auth'
import { templateId } from '../lib/ids'
import { sha256 } from '../lib/hash'
import { problemDetails } from '../lib/errors'
import { eq, and, desc } from '@typeset/db'
import type { Database } from '@typeset/db'

const createTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  content: z.string().min(1).max(2 * 1024 * 1024),
  description: z.string().max(1000).optional(),
})

const listTemplatesSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
})

export function templateRoutes(deps: { db: Database }) {
  const app = new Hono()

  app.post(
    '/templates',
    requireScope('template'),
    zValidator('json', createTemplateSchema),
    async (c) => {
      const body = c.req.valid('json')
      const orgId = c.get('orgId') as string

      const id = templateId()
      const contentHash = await sha256(body.content)

      const { templates } = await import('@typeset/db/schema')
      const [tpl] = await deps.db
        .insert(templates)
        .values({
          id,
          orgId,
          name: body.name,
          content: body.content,
          contentHash,
          description: body.description,
          version: 1,
        })
        .returning()

      return c.json({ data: { id: tpl!.id, version: tpl!.version, hash: contentHash, createdAt: tpl!.createdAt } }, 201)
    }
  )

  app.get('/templates', requireScope('template'), zValidator('query', listTemplatesSchema), async (c) => {
    const query = c.req.valid('query')
    const orgId = c.get('orgId') as string

    const { templates } = await import('@typeset/db/schema')
    const results = await deps.db
      .select({
        id: templates.id,
        name: templates.name,
        version: templates.version,
        createdAt: templates.createdAt,
      })
      .from(templates)
      .where(eq(templates.orgId, orgId))
      .orderBy(desc(templates.createdAt))
      .limit(query.limit + 1)

    const hasMore = results.length > query.limit
    const data = hasMore ? results.slice(0, -1) : results
    const cursor = hasMore ? data[data.length - 1]!.id : null

    return c.json({ data, pagination: { cursor, hasMore } })
  })

  app.get('/templates/:id', requireScope('template'), async (c) => {
    const id = c.req.param('id')
    const orgId = c.get('orgId') as string

    const { templates } = await import('@typeset/db/schema')
    const [tpl] = await deps.db
      .select()
      .from(templates)
      .where(and(eq(templates.id, id), eq(templates.orgId, orgId)))
      .limit(1)

    if (!tpl) {
      return problemDetails(c, 404, {
        type: 'https://typeset.dev/errors/not-found',
        title: 'Template not found',
        detail: `Template ${id} not found`,
      })
    }

    return c.json({ data: tpl })
  })

  return app
}
