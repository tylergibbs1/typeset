import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { requireScope } from '../middleware/auth'
import { problemDetails } from '../lib/errors'
import { safeFetch, SecurityError } from '../lib/security'
import type { Database } from '@typeset/db'

const templateFromDocSchema = z.object({
  document: z.object({
    type: z.enum(['url', 'base64']),
    url: z.string().url().optional(),
    data: z.string().optional(),
    mimeType: z.string().optional(),
  }),
})

export function templateFromDocRoutes(deps: { db: Database }) {
  const app = new Hono()

  app.post(
    '/template-from-doc',
    requireScope('template'),
    zValidator('json', templateFromDocSchema),
    async (c) => {
      const body = c.req.valid('json')

      let documentUrl: string
      if (body.document.type === 'url') {
        if (!body.document.url) {
          return problemDetails(c, 422, {
            type: 'https://typeset.dev/errors/validation',
            title: 'Validation error',
            detail: 'document.url is required when type is "url"',
          })
        }
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
        documentUrl = `data:${body.document.mimeType ?? 'application/pdf'};base64,${body.document.data}`
      }

      try {
        // Step 1: OCR the document with structural annotations
        const { Mistral } = await import('@mistralai/mistralai')
        const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY! })

        const ocrResult = await mistral.ocr.process({
          model: 'mistral-ocr-latest',
          document: { type: 'document_url', documentUrl },
          tableFormat: 'html',
          includeImageBase64: true,
        })

        // Step 2: Use AI to generate a template from OCR structure
        const { generateText } = await import('ai')
        const { openai } = await import('@ai-sdk/openai')

        const { text: template } = await generateText({
          model: openai.responses('gpt-5.4'),
          prompt: `Generate an HTML template with Handlebars placeholders from this document structure.

Page content (markdown):
${ocrResult.pages.map((p: any) => p.markdown).join('\n---PAGE BREAK---\n')}

Requirements:
- Use {{fieldName}} for dynamic text (camelCase names)
- Use {{#each items}} for repeating rows
- Preserve the original layout structure
- Include print-friendly CSS (@media print, page-break rules)
- Use semantic HTML (tables for tabular data, not divs)
- Return ONLY the HTML template, no explanation`,
        })

        // Extract detected fields from the template
        const fieldMatches = template.matchAll(/\{\{(\w+)\}\}/g)
        const detectedFields = [...new Set([...fieldMatches].map((m) => m[1]!))].map((name) => ({
          name,
          type: 'text' as const,
          sampleValue: '',
        }))

        return c.json({
          data: {
            template,
            detectedFields,
          },
        })
      } catch (err) {
        return problemDetails(c, 500, {
          type: 'https://typeset.dev/errors/template-generation-failed',
          title: 'Template generation failed',
          detail: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }
  )

  return app
}
