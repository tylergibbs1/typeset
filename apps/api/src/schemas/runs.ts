import { z } from 'zod'
import { paginationSchema } from './shared'

export const listRunsSchema = paginationSchema.extend({
  status: z.enum(['queued', 'rendering', 'verifying', 'completed', 'failed']).optional(),
  template_id: z.string().optional(),
})
