import { z } from 'zod'

export const PageBreakDecision = z.object({
  afterElement: z.string().describe('CSS selector identifying the element after which to break'),
  reason: z.string().describe('Why this break point was chosen'),
})

export const TableSplitDecision = z.object({
  tableSelector: z.string().describe('CSS selector identifying the table'),
  splitAfterRow: z.number().describe('Zero-based row index after which to insert a page break'),
  repeatHeaders: z.boolean().describe('Whether to repeat thead on the next page'),
  keepGrouped: z.array(z.number()).nullable().describe('Row indices that must stay on the same page'),
})

export const OrphanWarning = z.object({
  element: z.string().describe('CSS selector of the problematic element'),
  issue: z.enum([
    'orphaned_header',
    'widowed_row',
    'split_caption',
    'isolated_summary',
  ]).describe('Type of layout issue detected'),
  fix: z.string().describe('CSS or HTML fix to apply'),
})

export const LayoutDecision = z.object({
  pageBreaks: z.array(PageBreakDecision).describe('Where to insert page breaks'),
  tableSplits: z.array(TableSplitDecision).describe('How to split large tables across pages'),
  orphanWarnings: z.array(OrphanWarning).describe('Layout issues that need fixing'),
})

export type LayoutDecision = z.infer<typeof LayoutDecision>
export type PageBreakDecision = z.infer<typeof PageBreakDecision>
export type TableSplitDecision = z.infer<typeof TableSplitDecision>
export type OrphanWarning = z.infer<typeof OrphanWarning>
