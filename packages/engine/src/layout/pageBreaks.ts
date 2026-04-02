/**
 * Heuristic page break detection — no AI required.
 * Estimates where page breaks should go based on content structure.
 */
export function detectPageBreaks(html: string): string[] {
  const breakSelectors: string[] = []

  // Break between major sections
  const sectionPatterns = [
    /<\/section>/gi,
    /<\/article>/gi,
    /<hr\s*\/?>/gi,
  ]

  for (const pattern of sectionPatterns) {
    if (pattern.test(html)) {
      const tag = pattern.source.replace(/[\\/<>]/g, '').replace('s*?', '')
      breakSelectors.push(tag)
    }
  }

  return breakSelectors
}

/**
 * Generates CSS rules for heuristic page breaks.
 */
export function pageBreakCss(selectors: string[]): string {
  if (selectors.length === 0) return ''
  return selectors
    .map((s) => `${s} { break-after: page; }`)
    .join('\n')
}
