/**
 * Analyzes HTML for tables that likely need splitting.
 * Returns selectors for tables exceeding the row threshold.
 */
export function detectLargeTables(
  html: string,
  maxRowsPerPage = 25
): Array<{ selector: string; estimatedRows: number }> {
  const tables: Array<{ selector: string; estimatedRows: number }> = []

  // Count <tr> tags within each <table>
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi
  let match: RegExpExecArray | null
  let tableIndex = 0

  while ((match = tableRegex.exec(html)) !== null) {
    const tableContent = match[1]!
    const rowCount = (tableContent.match(/<tr[\s>]/gi) || []).length

    if (rowCount > maxRowsPerPage) {
      // Generate a selector — use nth-of-type if multiple tables
      const selector = tableIndex === 0 ? 'table' : `table:nth-of-type(${tableIndex + 1})`
      tables.push({ selector, estimatedRows: rowCount })
    }
    tableIndex++
  }

  return tables
}

/**
 * Generates CSS to handle large table rendering across pages.
 */
export function tableSplitCss(tables: Array<{ selector: string }>): string {
  return tables
    .map(
      (t) => `${t.selector} { break-inside: auto; }
${t.selector} thead { display: table-header-group; }
${t.selector} tr { break-inside: avoid; }`
    )
    .join('\n')
}
