import { z } from 'zod'

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
})

export const pageSizeSchema = z.enum(['a4', 'letter', 'legal']).default('a4')
export const orientationSchema = z.enum(['portrait', 'landscape']).default('portrait')
export const formatSchema = z.enum(['pdf', 'docx', 'html']).default('pdf')

export const marginSchema = z.object({
  top: z.string().default('20mm'),
  right: z.string().default('15mm'),
  bottom: z.string().default('20mm'),
  left: z.string().default('15mm'),
})
