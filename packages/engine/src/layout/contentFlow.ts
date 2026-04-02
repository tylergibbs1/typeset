import type { LayoutDecision } from './types'
import { analyzeLayout } from './analyze'
import { applyLayoutDecisions } from './apply'
import { detectLargeTables, tableSplitCss } from './tableSplit'
import { orphanWidowCss } from './orphanWidow'

export interface ContentFlowOptions {
  smartLayout: boolean
  data: Record<string, unknown>
}

/**
 * Orchestrates the full layout optimization pipeline.
 *
 * When smartLayout is true: runs AI analysis + heuristic fallbacks
 * When smartLayout is false: applies only CSS heuristics (no AI, no cost)
 */
export async function optimizeContentFlow(
  html: string,
  options: ContentFlowOptions
): Promise<{ html: string; decisions: LayoutDecision | null }> {
  // Always apply baseline orphan/widow CSS
  const baselineCss = orphanWidowCss()

  // Detect large tables for heuristic handling
  const largeTables = detectLargeTables(html)
  const tablesCss = tableSplitCss(largeTables)

  // Inject baseline styles
  const baselineStyle = `<style data-typeset-baseline>\n@media print {\n${baselineCss}\n${tablesCss}\n}\n</style>`
  let optimizedHtml = html.includes('</head>')
    ? html.replace('</head>', `${baselineStyle}\n</head>`)
    : `${baselineStyle}\n${html}`

  // AI layout analysis (when enabled and API key is available)
  let decisions: LayoutDecision | null = null

  if (options.smartLayout && process.env.OPENAI_API_KEY) {
    decisions = await analyzeLayout(optimizedHtml, options.data)

    if (decisions) {
      optimizedHtml = applyLayoutDecisions(optimizedHtml, decisions)
    }
  }

  return { html: optimizedHtml, decisions }
}
