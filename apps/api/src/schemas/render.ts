import { z } from 'zod'
import { pageSizeSchema, orientationSchema, formatSchema, marginSchema } from './shared'

export const renderOptionsSchema = z.object({
  pageSize: pageSizeSchema,
  orientation: orientationSchema,
  margin: marginSchema.default({}),
  locale: z.string().optional(),
  smartLayout: z.boolean().default(true),
  verify: z.boolean().default(false),
})

export const engineSchema = z.enum(['html', 'typst']).default('html')

export const renderRequestSchema = z.object({
  template: z.string().min(1).max(2 * 1024 * 1024), // 2MB max template
  data: z.record(z.unknown()).default({}),
  format: formatSchema,
  engine: engineSchema,
  options: renderOptionsSchema.default({}),
})

export const asyncRenderRequestSchema = renderRequestSchema.extend({
  webhook: z.object({
    url: z.string().url(),
    headers: z.record(z.string()).optional(),
    secret: z.string().optional(),
  }).optional(),
})
