import type { LayoutDecision } from './types'

/**
 * Applies AI layout decisions to HTML by injecting CSS rules.
 *
 * This approach uses CSS-only modifications (no DOM restructuring)
 * to keep the transformation predictable and reversible.
 */
export function applyLayoutDecisions(html: string, decisions: LayoutDecision): string {
  const cssRules: string[] = []

  // Apply page breaks
  for (const pb of decisions.pageBreaks) {
    cssRules.push(`${pb.afterElement} { break-after: page; }`)
  }

  // Apply table split rules
  for (const ts of decisions.tableSplits) {
    if (ts.repeatHeaders) {
      cssRules.push(`${ts.tableSelector} thead { display: table-header-group; }`)
    }
    cssRules.push(`${ts.tableSelector} tr { break-inside: avoid; }`)

    // Keep grouped rows together
    if (ts.keepGrouped && ts.keepGrouped.length > 0) {
      for (const rowIdx of ts.keepGrouped) {
        cssRules.push(
          `${ts.tableSelector} tr:nth-child(${rowIdx + 1}) { break-before: avoid; break-after: avoid; }`
        )
      }
    }

    // Insert break after the specified row
    if (ts.splitAfterRow >= 0) {
      cssRules.push(
        `${ts.tableSelector} tr:nth-child(${ts.splitAfterRow + 1}) { break-after: page; }`
      )
    }
  }

  // Apply orphan/widow fixes
  for (const warning of decisions.orphanWarnings) {
    cssRules.push(`${warning.element} { ${warning.fix}; }`)
  }

  if (cssRules.length === 0) return html

  const layoutStyle = `<style data-typeset-layout>\n@media print {\n  ${cssRules.join('\n  ')}\n}\n</style>`

  // Inject before </head> if it exists, otherwise before </body> or at the end
  if (html.includes('</head>')) {
    return html.replace('</head>', `${layoutStyle}\n</head>`)
  }
  if (html.includes('</body>')) {
    return html.replace('</body>', `${layoutStyle}\n</body>`)
  }
  return html + layoutStyle
}
