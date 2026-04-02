import { describe, test, expect } from 'bun:test'
import { detectPageBreaks, pageBreakCss } from '../layout/pageBreaks'
import { detectLargeTables, tableSplitCss } from '../layout/tableSplit'
import { orphanWidowCss } from '../layout/orphanWidow'
import { applyLayoutDecisions } from '../layout/apply'
import { optimizeContentFlow } from '../layout/contentFlow'
import type { LayoutDecision } from '../layout/types'

// ── detectPageBreaks ─────────────────────────────────────────────────────────

describe('detectPageBreaks', () => {
  test('returns empty array for HTML with no section/article/hr tags', () => {
    const html = '<div><p>No breaks here</p></div>'
    expect(detectPageBreaks(html)).toEqual([])
  })

  test('detects </section> tag', () => {
    const html = '<section><p>content</p></section><section><p>more</p></section>'
    const selectors = detectPageBreaks(html)
    expect(selectors.some((s) => s.includes('section'))).toBe(true)
  })

  test('detects </article> tag', () => {
    const html = '<article><p>first</p></article><article><p>second</p></article>'
    const selectors = detectPageBreaks(html)
    expect(selectors.some((s) => s.includes('article'))).toBe(true)
  })

  test('detects <hr> tag', () => {
    const html = '<p>before</p><hr><p>after</p>'
    const selectors = detectPageBreaks(html)
    expect(selectors.some((s) => s.includes('hr'))).toBe(true)
  })

  test('detects <hr /> self-closing tag', () => {
    const html = '<p>before</p><hr /><p>after</p>'
    const selectors = detectPageBreaks(html)
    expect(selectors.some((s) => s.includes('hr'))).toBe(true)
  })
})

describe('pageBreakCss', () => {
  test('returns empty string for empty selectors array', () => {
    expect(pageBreakCss([])).toBe('')
  })

  test('generates break-after: page rule for each selector', () => {
    const css = pageBreakCss(['section', 'article'])
    expect(css).toContain('section { break-after: page; }')
    expect(css).toContain('article { break-after: page; }')
  })
})

// ── detectLargeTables ────────────────────────────────────────────────────────

describe('detectLargeTables', () => {
  function makeTable(rows: number): string {
    const trs = '<tr><td>cell</td></tr>'.repeat(rows)
    return `<table>${trs}</table>`
  }

  test('returns empty array when no tables are present', () => {
    expect(detectLargeTables('<p>no tables</p>')).toEqual([])
  })

  test('returns empty array when table has fewer than 25 rows', () => {
    const html = makeTable(10)
    expect(detectLargeTables(html)).toEqual([])
  })

  test('returns empty array when table has exactly 25 rows (boundary)', () => {
    const html = makeTable(25)
    expect(detectLargeTables(html)).toEqual([])
  })

  test('detects a table with 26 rows', () => {
    const html = makeTable(26)
    const result = detectLargeTables(html)
    expect(result).toHaveLength(1)
    expect(result[0]!.estimatedRows).toBe(26)
  })

  test('first large table uses selector "table"', () => {
    const html = makeTable(30)
    const result = detectLargeTables(html)
    expect(result[0]!.selector).toBe('table')
  })

  test('second large table uses nth-of-type selector', () => {
    const html = makeTable(30) + makeTable(30)
    const result = detectLargeTables(html)
    expect(result).toHaveLength(2)
    expect(result[1]!.selector).toBe('table:nth-of-type(2)')
  })

  test('ignores small tables mixed with large ones', () => {
    const html = makeTable(5) + makeTable(30)
    const result = detectLargeTables(html)
    expect(result).toHaveLength(1)
    // The large table is the second one overall (index 1), so nth-of-type(2)
    expect(result[0]!.selector).toBe('table:nth-of-type(2)')
  })

  test('respects custom maxRowsPerPage parameter', () => {
    const html = makeTable(10)
    const result = detectLargeTables(html, 5)
    expect(result).toHaveLength(1)
    expect(result[0]!.estimatedRows).toBe(10)
  })
})

describe('tableSplitCss', () => {
  test('returns empty string for empty tables array', () => {
    expect(tableSplitCss([])).toBe('')
  })

  test('generates break-inside, thead, and tr rules for a table', () => {
    const css = tableSplitCss([{ selector: 'table' }])
    expect(css).toContain('table { break-inside: auto; }')
    expect(css).toContain('table thead { display: table-header-group; }')
    expect(css).toContain('table tr { break-inside: avoid; }')
  })

  test('generates rules for multiple tables', () => {
    const css = tableSplitCss([
      { selector: 'table' },
      { selector: 'table:nth-of-type(2)' },
    ])
    expect(css).toContain('table { break-inside: auto; }')
    expect(css).toContain('table:nth-of-type(2) { break-inside: auto; }')
  })
})

// ── orphanWidowCss ───────────────────────────────────────────────────────────

describe('orphanWidowCss', () => {
  test('returns a non-empty string', () => {
    const css = orphanWidowCss()
    expect(typeof css).toBe('string')
    expect(css.length).toBeGreaterThan(0)
  })

  test('contains heading break-after: avoid rule', () => {
    const css = orphanWidowCss()
    expect(css).toContain('h1')
    expect(css).toContain('break-after: avoid')
  })

  test('contains heading break-inside: avoid rule', () => {
    const css = orphanWidowCss()
    expect(css).toContain('break-inside: avoid')
  })

  test('contains tr:last-child break-before: avoid rule', () => {
    const css = orphanWidowCss()
    expect(css).toContain('tr:last-child')
    expect(css).toContain('break-before: avoid')
  })

  test('contains figure break-inside: avoid rule', () => {
    const css = orphanWidowCss()
    expect(css).toContain('figure')
  })

  test('contains p orphans and widows rules', () => {
    const css = orphanWidowCss()
    expect(css).toContain('orphans: 3')
    expect(css).toContain('widows: 3')
  })
})

// ── applyLayoutDecisions ─────────────────────────────────────────────────────

describe('applyLayoutDecisions', () => {
  const emptyDecisions: LayoutDecision = {
    pageBreaks: [],
    tableSplits: [],
    orphanWarnings: [],
  }

  test('returns original HTML unchanged when all decisions are empty', () => {
    const html = '<html><head></head><body><p>content</p></body></html>'
    expect(applyLayoutDecisions(html, emptyDecisions)).toBe(html)
  })

  test('injects style tag before </head> for page break decisions', () => {
    const html = '<html><head></head><body></body></html>'
    const decisions: LayoutDecision = {
      pageBreaks: [{ afterElement: 'section', reason: 'new section' }],
      tableSplits: [],
      orphanWarnings: [],
    }
    const result = applyLayoutDecisions(html, decisions)
    expect(result).toContain('<style data-typeset-layout>')
    expect(result).toContain('section { break-after: page; }')
    // Style must be injected before </head>
    expect(result.indexOf('<style')).toBeLessThan(result.indexOf('</head>'))
  })

  test('generates correct CSS for table split with repeatHeaders', () => {
    const html = '<html><head></head><body><table></table></body></html>'
    const decisions: LayoutDecision = {
      pageBreaks: [],
      tableSplits: [
        {
          tableSelector: 'table',
          splitAfterRow: 9,
          repeatHeaders: true,
          keepGrouped: null,
        },
      ],
      orphanWarnings: [],
    }
    const result = applyLayoutDecisions(html, decisions)
    expect(result).toContain('table thead { display: table-header-group; }')
    expect(result).toContain('table tr { break-inside: avoid; }')
    expect(result).toContain('table tr:nth-child(10) { break-after: page; }')
  })

  test('generates correct CSS for table split without repeatHeaders', () => {
    const html = '<html><head></head><body><table></table></body></html>'
    const decisions: LayoutDecision = {
      pageBreaks: [],
      tableSplits: [
        {
          tableSelector: 'table',
          splitAfterRow: 5,
          repeatHeaders: false,
          keepGrouped: null,
        },
      ],
      orphanWarnings: [],
    }
    const result = applyLayoutDecisions(html, decisions)
    expect(result).not.toContain('table thead { display: table-header-group; }')
    expect(result).toContain('table tr { break-inside: avoid; }')
  })

  test('generates correct CSS for keepGrouped rows', () => {
    const html = '<html><head></head><body><table></table></body></html>'
    const decisions: LayoutDecision = {
      pageBreaks: [],
      tableSplits: [
        {
          tableSelector: 'table',
          splitAfterRow: -1,
          repeatHeaders: false,
          keepGrouped: [2, 3],
        },
      ],
      orphanWarnings: [],
    }
    const result = applyLayoutDecisions(html, decisions)
    expect(result).toContain('table tr:nth-child(3) { break-before: avoid; break-after: avoid; }')
    expect(result).toContain('table tr:nth-child(4) { break-before: avoid; break-after: avoid; }')
  })

  test('generates correct CSS for orphan warnings', () => {
    const html = '<html><head></head><body></body></html>'
    const decisions: LayoutDecision = {
      pageBreaks: [],
      tableSplits: [],
      orphanWarnings: [{ element: 'h2', issue: 'orphaned_header', fix: 'break-before: avoid' }],
    }
    const result = applyLayoutDecisions(html, decisions)
    expect(result).toContain('h2 { break-before: avoid; }')
  })

  test('wraps rules in @media print', () => {
    const html = '<html><head></head><body></body></html>'
    const decisions: LayoutDecision = {
      pageBreaks: [{ afterElement: 'section', reason: 'end of section' }],
      tableSplits: [],
      orphanWarnings: [],
    }
    const result = applyLayoutDecisions(html, decisions)
    expect(result).toContain('@media print')
  })

  test('injects before </body> when no </head> is present', () => {
    const html = '<body><p>content</p></body>'
    const decisions: LayoutDecision = {
      pageBreaks: [{ afterElement: 'section', reason: 'end of section' }],
      tableSplits: [],
      orphanWarnings: [],
    }
    const result = applyLayoutDecisions(html, decisions)
    expect(result).toContain('<style data-typeset-layout>')
    expect(result.indexOf('<style')).toBeLessThan(result.indexOf('</body>'))
  })

  test('appends to end when neither </head> nor </body> is present', () => {
    const html = '<p>bare content</p>'
    const decisions: LayoutDecision = {
      pageBreaks: [{ afterElement: 'section', reason: 'end of section' }],
      tableSplits: [],
      orphanWarnings: [],
    }
    const result = applyLayoutDecisions(html, decisions)
    expect(result).toContain('<style data-typeset-layout>')
    expect(result.endsWith('</style>')).toBe(true)
  })
})

// ── optimizeContentFlow ──────────────────────────────────────────────────────

describe('optimizeContentFlow', () => {
  test('with smartLayout: false, injects baseline style tag', async () => {
    const html = '<html><head></head><body><p>content</p></body></html>'
    const { html: result, decisions } = await optimizeContentFlow(html, {
      smartLayout: false,
      data: {},
    })
    expect(result).toContain('<style data-typeset-baseline>')
    expect(decisions).toBeNull()
  })

  test('with smartLayout: false, includes orphan/widow CSS in baseline', async () => {
    const html = '<html><head></head><body><p>content</p></body></html>'
    const { html: result } = await optimizeContentFlow(html, {
      smartLayout: false,
      data: {},
    })
    expect(result).toContain('orphans')
    expect(result).toContain('widows')
  })

  test('with smartLayout: false, decisions is null', async () => {
    const html = '<p>bare</p>'
    const { decisions } = await optimizeContentFlow(html, {
      smartLayout: false,
      data: {},
    })
    expect(decisions).toBeNull()
  })

  test('with smartLayout: false, detects and handles large tables', async () => {
    const rows = '<tr><td>x</td></tr>'.repeat(30)
    const html = `<html><head></head><body><table>${rows}</table></body></html>`
    const { html: result } = await optimizeContentFlow(html, {
      smartLayout: false,
      data: {},
    })
    // Large table CSS should be present in the baseline style block
    expect(result).toContain('break-inside: auto')
  })

  test('with smartLayout: false and no OPENAI_API_KEY, does not call AI', async () => {
    // Ensure no API key is set for this test
    const originalKey = process.env.OPENAI_API_KEY
    delete process.env.OPENAI_API_KEY

    const html = '<html><head></head><body></body></html>'
    const { decisions } = await optimizeContentFlow(html, {
      smartLayout: true, // smartLayout: true but no key — should skip AI
      data: {},
    })
    expect(decisions).toBeNull()

    if (originalKey !== undefined) process.env.OPENAI_API_KEY = originalKey
  })

  test('baseline style is injected before </head> when <head> exists', async () => {
    const html = '<html><head></head><body></body></html>'
    const { html: result } = await optimizeContentFlow(html, {
      smartLayout: false,
      data: {},
    })
    const styleIdx = result.indexOf('<style data-typeset-baseline>')
    const headCloseIdx = result.indexOf('</head>')
    expect(styleIdx).toBeGreaterThan(-1)
    expect(styleIdx).toBeLessThan(headCloseIdx)
  })

  test('baseline style is prepended when no <head> element', async () => {
    const html = '<p>no head</p>'
    const { html: result } = await optimizeContentFlow(html, {
      smartLayout: false,
      data: {},
    })
    expect(result.startsWith('<style data-typeset-baseline>')).toBe(true)
  })
})
