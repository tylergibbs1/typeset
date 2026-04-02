import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { extractRequestSchema } from '../schemas/extract'
import { requireScope } from '../middleware/auth'
import { trackUsage } from '../middleware/usage'
import { problemDetails } from '../lib/errors'
import { safeFetch, SecurityError } from '../lib/security'
import type { Database } from '@typeset/db'

export function extractRoutes(deps: { db: Database }) {
  const app = new Hono()

  app.post(
    '/extract',
    requireScope('extract'),
    trackUsage(deps.db, 'extract'),
    zValidator('json', extractRequestSchema),
    async (c) => {
      const body = c.req.valid('json')

      let documentUrl: string
      let documentBase64: string | undefined

      if (body.document.type === 'url') {
        if (!body.document.url) {
          return problemDetails(c, 422, {
            type: 'https://typeset.dev/errors/validation',
            title: 'Validation error',
            detail: 'document.url is required when type is "url"',
          })
        }
        // Validate URL is safe (SSRF protection)
        try {
          await safeFetch(body.document.url)
        } catch (err) {
          if (err instanceof SecurityError) {
            return problemDetails(c, 422, {
              type: 'https://typeset.dev/errors/ssrf-blocked',
              title: 'Blocked URL',
              detail: err.message,
            })
          }
          throw err
        }
        documentUrl = body.document.url
      } else {
        if (!body.document.data) {
          return problemDetails(c, 422, {
            type: 'https://typeset.dev/errors/validation',
            title: 'Validation error',
            detail: 'document.data is required when type is "base64"',
          })
        }
        documentBase64 = body.document.data
        documentUrl = `data:${body.document.mimeType ?? 'application/pdf'};base64,${documentBase64}`
      }

      try {
        const { Mistral } = await import('@mistralai/mistralai')
        const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY! })

        const ocrResult = await mistral.ocr.process({
          model: 'mistral-ocr-latest',
          document: { type: 'document_url', documentUrl },
          tableFormat: body.options.tableFormat ?? 'html',
          includeImageBase64: false,
        })

        return c.json({
          data: {
            pages: ocrResult.pages.map((p: any, i: number) => {
              // Inline table content into markdown — Mistral returns [tbl-N.html] references
              let markdown = p.markdown as string
              const tables: Array<{ id: string; content: string; format: string }> = []

              if (p.tables) {
                for (const table of p.tables) {
                  const id = table.id ?? `tbl-${tables.length}`
                  tables.push({
                    id,
                    content: table.content ?? table.html ?? '',
                    format: body.options.tableFormat ?? 'html',
                  })
                  // Replace the reference with actual content
                  markdown = markdown.replace(
                    `[${id}.html](${id}.html)`,
                    table.content ?? table.html ?? ''
                  )
                }
              }

              return {
                index: i,
                markdown,
                images: p.images ?? [],
                tables,
              }
            }),
            annotation: ocrResult.documentAnnotation
              ? JSON.parse(ocrResult.documentAnnotation)
              : null,
            usage: ocrResult.usageInfo ?? { pagesProcessed: ocrResult.pages.length, docSizeBytes: 0 },
          },
        })
      } catch (err) {
        return problemDetails(c, 500, {
          type: 'https://typeset.dev/errors/extraction-failed',
          title: 'Extraction failed',
          detail: err instanceof Error ? err.message : 'Unknown error during extraction',
        })
      }
    }
  )

  return app
}
