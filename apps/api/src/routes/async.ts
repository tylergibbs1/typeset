import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { tasks } from '@trigger.dev/sdk'
import { asyncRenderRequestSchema } from '../schemas/render'
import { requireScope } from '../middleware/auth'
import { runId } from '../lib/ids'
import { sha256 } from '../lib/hash'
import { problemDetails } from '../lib/errors'
import type { Database } from '@typeset/db'

export function asyncRenderRoutes(deps: { db: Database }) {
  const app = new Hono()

  app.post(
    '/render/async',
    requireScope('render'),
    zValidator('json', asyncRenderRequestSchema),
    async (c) => {
      const body = c.req.valid('json')
      const orgId = c.get('orgId') as string
      const apiKeyId = c.get('apiKeyId') as string

      const id = runId()
      c.set('runId', id)

      // Resolve template content
      let templateContent: string
      if (body.template.startsWith('tpl_')) {
        const { templates } = await import('@typeset/db/schema')
        const { eq, and } = await import('@typeset/db')
        const [tpl] = await deps.db
          .select()
          .from(templates)
          .where(and(eq(templates.id, body.template), eq(templates.orgId, orgId)))
          .limit(1)

        if (!tpl) {
          return problemDetails(c, 404, {
            type: 'https://typeset.dev/errors/not-found',
            title: 'Template not found',
            detail: `Template ${body.template} not found`,
          })
        }
        templateContent = tpl.content
      } else {
        templateContent = body.template
      }

      const [templateHash, dataHash] = await Promise.all([
        sha256(templateContent),
        sha256(JSON.stringify(body.data)),
      ])

      const { runs } = await import('@typeset/db/schema')
      await deps.db.insert(runs).values({
        id,
        orgId,
        apiKeyId,
        templateHash,
        dataHash,
        format: body.format,
        options: body.options,
        status: 'queued',
        webhookUrl: body.webhook?.url,
      })

      // Trigger the render task via Trigger.dev
      await tasks.trigger('document-render', {
        runId: id,
        orgId,
        template: templateContent,
        data: body.data,
        format: body.format,
        options: body.options,
        webhookUrl: body.webhook?.url,
        webhookSecret: body.webhook?.secret,
        webhookHeaders: body.webhook?.headers,
      })

      return c.json(
        {
          data: {
            runId: id,
            status: 'queued' as const,
            estimatedSeconds: 30,
            links: {
              self: `/v1/runs/${id}`,
              cancel: `/v1/runs/${id}`,
            },
          },
        },
        201
      )
    }
  )

  return app
}
