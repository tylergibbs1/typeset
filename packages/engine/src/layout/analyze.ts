import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { LayoutDecision } from './types'
import type { LayoutDecision as LayoutDecisionType } from './types'

/**
 * Analyzes HTML content and determines optimal page break positions,
 * table splitting strategy, and orphan/widow fixes for PDF output.
 *
 * Uses OpenAI via Vercel AI SDK generateObject for structured output.
 * Returns null if analysis fails (caller should proceed without layout optimization).
 */
export async function analyzeLayout(
  html: string,
  data: Record<string, unknown>
): Promise<LayoutDecisionType | null> {
  const arrayFields = Object.entries(data)
    .filter(([_, v]) => Array.isArray(v))
    .map(([k, v]) => ({ field: k, rows: (v as unknown[]).length }))

  const dataKeys = Object.keys(data)

  try {
    const { object } = await generateObject({
      model: openai('gpt-5.4'),
      schema: LayoutDecision,
      prompt: `You are a document layout engine. Analyze this HTML template and determine the optimal page break positions and table splitting strategy for PDF rendering.

Template HTML:
${html.slice(0, 15000)}

Data shape:
- Fields: ${JSON.stringify(dataKeys)}
- Arrays: ${JSON.stringify(arrayFields)}

Analyze the template and return layout decisions following these rules:

PAGE BREAKS:
- Insert breaks between major sections (after closing tags of logical blocks)
- Never break immediately after a heading (h1-h6) — keep heading with its content
- Prefer breaking after complete paragraphs or after table/figure blocks
- Use CSS selectors that match elements in the HTML above

TABLE SPLITS:
- Only split tables with more than 15 rows
- Always repeat headers when splitting
- Keep related rows together (e.g., subtotal rows with their group)
- Use CSS selectors that match tables in the HTML

ORPHAN/WIDOW PREVENTION:
- Flag any heading (h1-h6) that could end up at the bottom of a page alone
- Flag any single summary/total row that could be isolated on a new page
- Flag any figure/image caption that could be separated from its figure
- Provide a CSS fix for each issue (e.g., "break-inside: avoid" or "break-after: avoid")

If the document is simple (single section, small table), return empty arrays — don't over-optimize.`,
    })

    return object
  } catch (err) {
    console.warn('[layout] AI analysis failed, proceeding without optimization:', err)
    return null
  }
}
