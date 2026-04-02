import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { renderRequestSchema } from '../schemas/render'
import { requireScope } from '../middleware/auth'
import { trackUsage } from '../middleware/usage'
import { runId } from '../lib/ids'
import { sha256 } from '../lib/hash'
import { problemDetails } from '../lib/errors'
import { injectData, optimizeContentFlow, detectEngine } from '@typeset/engine'
import type { RenderOptions } from '@typeset/engine'
import type { Database } from '@typeset/db'
import type { BrowserPool } from '@typeset/engine'
import type { Storage } from '../lib/storage'

export function renderRoutes(deps: {
  db: Database
  pool: BrowserPool
  storage: Storage
}) {
  const app = new Hono()

  app.post(
    '/render',
    requireScope('render'),
    trackUsage(deps.db, 'render'),
    zValidator('json', renderRequestSchema),
    async (c) => {
      const body = c.req.valid('json')
      const orgId = c.get('orgId') as string
      const apiKeyId = c.get('apiKeyId') as string

      const id = runId()
      c.set('runId', id)

      // Resolve template: either inline HTML or template ID
      let templateContent: string
      let templateIdRef: string | undefined

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
        templateIdRef = tpl.id
      } else {
        templateContent = body.template
      }

      const [templateHash, dataHash] = await Promise.all([
        sha256(templateContent),
        sha256(JSON.stringify(body.data)),
      ])

      // Determine rendering engine
      const engine =
        body.engine === 'typst' || detectEngine(templateContent) === 'typst'
          ? 'typst' as const
          : 'html' as const

      // Create run record
      const { runs } = await import('@typeset/db/schema')
      await deps.db.insert(runs).values({
        id,
        orgId,
        apiKeyId,
        templateId: templateIdRef,
        templateHash,
        dataHash,
        format: body.format,
        engine,
        options: body.options,
        status: 'rendering',
      })

      try {
        const renderOptions: RenderOptions = {
          pageSize: body.options.pageSize,
          orientation: body.options.orientation,
          margin: body.options.margin,
          locale: body.options.locale,
          smartLayout: body.options.smartLayout,
        }

        let result

        if (engine === 'typst') {
          // Typst path: no browser pool, no sandbox, no layout optimization
          const { renderTypst } = await import('@typeset/engine')
          result = await renderTypst(templateContent, body.data, renderOptions)
        } else {
          // HTML path: existing Playwright rendering
          const html = injectData(templateContent, body.data)

          const { html: optimizedHtml } = await optimizeContentFlow(html, {
            smartLayout: body.options.smartLayout ?? false,
            data: body.data,
          })

          const { renderHtml } = await import('@typeset/engine')
          const { page, context } = await deps.pool.getPage()

          try {
            result = await renderHtml(page, optimizedHtml, renderOptions)
          } finally {
            await deps.pool.releasePage(page, context)
          }
        }

        // Upload to storage
        const storageKey = `${orgId}/${id}.${body.format}`
        await deps.storage.put(storageKey, result.buffer, 'application/pdf')
        const url = await deps.storage.getSignedUrl(storageKey)
        const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString()

        // Update run
        const { eq } = await import('@typeset/db')
        await deps.db
          .update(runs)
          .set({
            status: 'completed',
            storageKey,
            pages: result.pages,
            sizeBytes: result.buffer.length,
            renderTimeMs: result.renderTimeMs,
            verificationStatus: 'skipped',
            completedAt: new Date(),
          })
          .where(eq(runs.id, id))

        return c.json({
          data: {
            runId: id,
            url,
            expiresAt,
            verification: { status: 'skipped' as const, score: 0, issues: [] },
            metadata: {
              pages: result.pages,
              sizeBytes: result.buffer.length,
              renderTimeMs: result.renderTimeMs,
              templateHash,
              dataHash,
            },
          },
        })
      } catch (err) {
        const { eq } = await import('@typeset/db')
        await deps.db
          .update(runs)
          .set({
            status: 'failed',
            errorType: err instanceof Error ? err.name : 'UnknownError',
            errorDetail: err instanceof Error ? err.message : String(err),
            completedAt: new Date(),
          })
          .where(eq(runs.id, id))

        return problemDetails(c, 500, {
          type: 'https://typeset.dev/errors/render-failed',
          title: 'Render failed',
          detail: err instanceof Error ? err.message : 'Unknown error during rendering',
        })
      }
    }
  )

  return app
}
