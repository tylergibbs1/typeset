import { z } from 'zod'

export const extractRequestSchema = z.object({
  document: z.object({
    type: z.enum(['url', 'base64']),
    url: z.string().url().optional(),
    data: z.string().optional(),
    mimeType: z.string().optional(),
  }),
  schema: z.record(z.unknown()).optional(),
  options: z.object({
    tableFormat: z.enum(['markdown', 'html']).nullable().default('html'),
    extractHeaders: z.boolean().default(false),
    extractFooters: z.boolean().default(false),
    pages: z.array(z.number().int().positive()).optional(),
  }).default({}),
})
