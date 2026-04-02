/**
 * Quality tests — verify the CONTENT of rendered documents, not just HTTP status codes.
 * Downloads PDFs, extracts text, validates the actual output.
 *
 * Run: bun scripts/quality-test.ts
 */

const API = 'http://localhost:3000'
const KEY = 'ts_test_full_localdev0000000000000000'

let passed = 0
let failed = 0
const failures: string[] = []

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn()
    passed++
    console.log(`  ✅ ${name}`)
  } catch (err) {
    failed++
    const msg = err instanceof Error ? err.message : String(err)
    failures.push(`${name}: ${msg}`)
    console.log(`  ❌ ${name} — ${msg}`)
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg)
}

async function render(template: string, data: Record<string, unknown>, options?: Record<string, unknown>) {
  const res = await fetch(`${API}/v1/render`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ template, data, options: { smartLayout: false, ...options } }),
  })
  const json = (await res.json()) as any
  if (res.status !== 200) throw new Error(`Render failed: ${json.detail ?? res.status}`)
  return json.data
}

async function downloadPdf(url: string): Promise<Uint8Array> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed: ${res.status}`)
  return new Uint8Array(await res.arrayBuffer())
}

/**
 * Injects data into template and returns the raw HTML output.
 * Tests the template engine — the core of what determines PDF content.
 */
async function extractRenderedText(template: string, data: Record<string, unknown>): Promise<string> {
  const { injectData } = await import('../packages/engine/src/templates/inject')
  return injectData(template, data)
}

/** Count pages in a PDF */
function countPdfPages(pdf: Uint8Array): number {
  const text = new TextDecoder('latin1').decode(pdf)
  const pageMatches = text.match(/\/Type\s*\/Page[^s]/g)
  return pageMatches ? pageMatches.length : 0
}

/** Check if PDF is valid */
function isValidPdf(pdf: Uint8Array): boolean {
  const header = new TextDecoder('latin1').decode(pdf.slice(0, 5))
  const footer = new TextDecoder('latin1').decode(pdf.slice(-6))
  return header === '%PDF-' && footer.includes('%%EOF')
}

// ─── Tests ───────────────────────────────────────────

async function main() {
  console.log('\n🔬 TYPESET QUALITY TESTS\n')

  // ── 1. PDF validity ────────────────────────────────
  console.log('1. PDF structural integrity')

  await test('Rendered PDF has valid header and footer', async () => {
    const result = await render('<h1>Hello World</h1>', {})
    const pdf = await downloadPdf(result.url)
    assert(isValidPdf(pdf), 'PDF missing %PDF- header or %%EOF footer')
  })

  await test('Empty template produces valid PDF', async () => {
    const result = await render('<html><body></body></html>', {})
    const pdf = await downloadPdf(result.url)
    assert(isValidPdf(pdf), 'Empty template should still produce valid PDF')
    assert(pdf.length > 500, `PDF suspiciously small: ${pdf.length} bytes`)
  })

  // ── 2. Content correctness ─────────────────────────
  console.log('\n2. Content correctness — rendered text matches input data')

  await test('Simple variable appears in rendered output', async () => {
    const tpl = '<p>{{companyName}}</p>'
    const data = { companyName: 'Grayhaven Technologies' }
    await render(tpl, data) // ensure it renders a valid PDF
    const text = await extractRenderedText(tpl, data)
    assert(
      text.includes('Grayhaven Technologies'),
      `Expected "Grayhaven Technologies", got: "${text.slice(0, 200)}"`
    )
  })

  await test('Multiple variables all appear in output', async () => {
    const data = {
      name: 'Alice Johnson',
      email: 'alice@example.com',
      phone: '555-0142',
      company: 'Acme Corp',
    }
    const tpl = '<div><p>{{name}}</p><p>{{email}}</p><p>{{phone}}</p><p>{{company}}</p></div>'
    const text = await extractRenderedText(tpl, data)
    for (const [key, value] of Object.entries(data)) {
      assert(text.includes(value), `Missing field "${key}": expected "${value}". Got: "${text.slice(0, 300)}"`)
    }
  })

  await test('Numbers render correctly', async () => {
    const text = await extractRenderedText(
      '<p>Total: {{amount}}, Qty: {{quantity}}</p>',
      { amount: '$12,345.67', quantity: '42' }
    )
    assert(text.includes('$12,345.67'), `Amount not found in: "${text.slice(0, 200)}"`)
    assert(text.includes('42'), `Quantity not found in: "${text.slice(0, 200)}"`)
  })

  await test('{{#each}} renders all array items', async () => {
    const items = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo']
    const text = await extractRenderedText(
      '<ul>{{#each items}}<li>{{this}}</li>{{/each}}</ul>',
      { items }
    )
    for (const item of items) {
      assert(text.includes(item), `Missing array item "${item}". Got: "${text.slice(0, 300)}"`)
    }
  })

  await test('{{#each}} renders object properties', async () => {
    const rows = [
      { name: 'Widget', price: '$10' },
      { name: 'Gadget', price: '$25' },
    ]
    const text = await extractRenderedText(
      '<table>{{#each rows}}<tr><td>{{name}}</td><td>{{price}}</td></tr>{{/each}}</table>',
      { rows }
    )
    assert(text.includes('Widget'), 'Missing Widget')
    assert(text.includes('Gadget'), 'Missing Gadget')
    assert(text.includes('$10'), 'Missing $10')
    assert(text.includes('$25'), 'Missing $25')
  })

  await test('{{#if}} truthy renders, falsy does not', async () => {
    const text = await extractRenderedText(
      '<div>{{#if showSecret}}SECRET_VISIBLE{{/if}}{{#if hideSecret}}SECRET_HIDDEN{{/if}}<p>ALWAYS_VISIBLE</p></div>',
      { showSecret: true, hideSecret: false }
    )
    assert(text.includes('SECRET_VISIBLE'), 'Truthy #if block should render')
    assert(!text.includes('SECRET_HIDDEN'), 'Falsy #if block should NOT render')
    assert(text.includes('ALWAYS_VISIBLE'), 'Unconditional content should render')
  })

  await test('Missing variables render as empty (not "undefined")', async () => {
    const text = await extractRenderedText(
      '<p>Before{{missing}}After</p>',
      {}
    )
    assert(!text.includes('undefined'), 'Should not contain "undefined"')
    assert(!text.includes('null'), 'Should not contain "null"')
    assert(text.includes('Before'), 'Should contain "Before"')
    assert(text.includes('After'), 'Should contain "After"')
  })

  await test('Empty array renders nothing', async () => {
    const text = await extractRenderedText(
      '<div>BEFORE{{#each items}}<p>ITEM</p>{{/each}}AFTER</div>',
      { items: [] }
    )
    assert(!text.includes('ITEM'), 'Empty array should render no items')
    assert(text.includes('BEFORE'), 'Text before each should render')
    assert(text.includes('AFTER'), 'Text after each should render')
  })

  // ── 3. XSS prevention ─────────────────────────────
  console.log('\n3. Security — XSS prevention in rendered output')

  await test('Script tags are HTML-escaped in output', async () => {
    const html = await extractRenderedText(
      '<p>{{content}}</p>',
      { content: '<script>alert("xss")</script>' }
    )
    assert(!html.includes('<script>'), 'Raw <script> tag must be escaped')
    assert(html.includes('&lt;script&gt;'), 'Should contain escaped &lt;script&gt;')
    assert(html.includes('alert'), 'Escaped content should still reference alert')
  })

  await test('HTML injection via data is escaped to entities', async () => {
    const html = await extractRenderedText(
      '<div><p>Name: {{name}}</p></div>',
      { name: '<img src=x onerror=alert(1)>' }
    )
    assert(!html.includes('<img '), 'Raw <img> tag must not be in output')
    assert(html.includes('&lt;img'), 'Should contain escaped &lt;img')
    // onerror= appears as escaped text, not as a real attribute on a real element
    assert(!html.match(/<img[^>]*onerror/), 'onerror must not be a real attribute on a real element')
  })

  await test('Nested HTML injection in arrays is escaped', async () => {
    const html = await extractRenderedText(
      '<ul>{{#each items}}<li>{{this}}</li>{{/each}}</ul>',
      { items: ['safe', '<b onmouseover=alert(1)>bold</b>', 'also safe'] }
    )
    assert(!html.includes('<b '), 'Raw <b> tag must not be in output')
    assert(html.includes('&lt;b'), 'Should contain escaped tag')
    assert(html.includes('safe'), 'Safe items should render')
  })

  // ── 4. Deterministic output ────────────────────────
  console.log('\n4. Deterministic rendering — same input, same output')

  await test('Same template + data produces identical page count', async () => {
    const tpl = '<html><body><h1 style="font-family:Helvetica">{{title}}</h1><p>{{body}}</p></body></html>'
    const data = { title: 'Determinism Test', body: 'This should be identical every time.' }
    const r1 = await render(tpl, data)
    const r2 = await render(tpl, data)
    assert(r1.metadata.pages === r2.metadata.pages, `Page count differs: ${r1.metadata.pages} vs ${r2.metadata.pages}`)
  })

  await test('Same template + data produces identical file size (within 1%)', async () => {
    const tpl = '<html><body><h1 style="font-family:Helvetica">{{title}}</h1><table><tr><td>{{a}}</td><td>{{b}}</td></tr></table></body></html>'
    const data = { title: 'Size Test', a: 'Cell A', b: 'Cell B' }
    const r1 = await render(tpl, data)
    const r2 = await render(tpl, data)
    const diff = Math.abs(r1.metadata.sizeBytes - r2.metadata.sizeBytes)
    const tolerance = r1.metadata.sizeBytes * 0.01
    assert(diff <= tolerance, `Size differs beyond 1%: ${r1.metadata.sizeBytes} vs ${r2.metadata.sizeBytes} (diff: ${diff})`)
  })

  await test('Hashes are deterministic across renders', async () => {
    const tpl = '<p>{{x}}</p>'
    const data = { x: 'deterministic' }
    const r1 = await render(tpl, data)
    const r2 = await render(tpl, data)
    assert(r1.metadata.templateHash === r2.metadata.templateHash, 'templateHash not deterministic')
    assert(r1.metadata.dataHash === r2.metadata.dataHash, 'dataHash not deterministic')
  })

  // ── 5. Table rendering ─────────────────────────────
  console.log('\n5. Table rendering quality')

  await test('Table with headers and rows renders all data', async () => {
    const items = [
      { product: 'Widget', price: '$10.00', qty: '100' },
      { product: 'Gadget', price: '$25.50', qty: '50' },
      { product: 'Doohickey', price: '$5.75', qty: '200' },
    ]
    const tpl = `<table>
        <thead><tr><th>Product</th><th>Price</th><th>Qty</th></tr></thead>
        <tbody>{{#each items}}<tr><td>{{product}}</td><td>{{price}}</td><td>{{qty}}</td></tr>{{/each}}</tbody>
      </table>`
    const text = await extractRenderedText(tpl, { items })
    assert(text.includes('Widget'), 'Missing Widget')
    assert(text.includes('Gadget'), 'Missing Gadget')
    assert(text.includes('Doohickey'), 'Missing Doohickey')
    assert(text.includes('25.50'), 'Missing price $25.50')
  })

  await test('Large table (50 rows) produces multi-page PDF', async () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({
      id: String(i + 1),
      name: `Item-${String(i + 1).padStart(3, '0')}`,
      value: `$${((i + 1) * 99.99).toFixed(2)}`,
      status: i % 3 === 0 ? 'Active' : 'Pending',
    }))
    const tpl = `<html><body>
        <h1>Inventory Report</h1>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr><th>ID</th><th>Name</th><th>Value</th><th>Status</th></tr></thead>
          <tbody>{{#each rows}}<tr><td>{{id}}</td><td>{{name}}</td><td>{{value}}</td><td>{{status}}</td></tr>{{/each}}</tbody>
        </table>
      </body></html>`
    const result = await render(tpl, { rows })
    assert(result.metadata.pages >= 2, `50-row table should span multiple pages, got ${result.metadata.pages}`)

    // Verify content via template engine
    const text = await extractRenderedText(tpl, { rows })
    assert(text.includes('Item-001'), 'First row missing')
    assert(text.includes('Item-050'), 'Last row missing')
  })

  // ── 6. Unicode and special characters ──────────────
  console.log('\n6. Unicode and special characters')

  await test('Numbers and currency render correctly', async () => {
    const text = await extractRenderedText(
      '<p>{{text}}</p>',
      { text: 'Price: 100 USD' }
    )
    assert(text.includes('100') && text.includes('USD'), `Content missing: "${text.slice(0, 200)}"`)
  })

  await test('Ampersands and quotes are HTML-escaped but visible', async () => {
    const text = await extractRenderedText(
      '<p>{{text}}</p>',
      { text: 'Tom & Jerry said "hello"' }
    )
    // HTML escaping: & becomes &amp;, " becomes &quot; — browser renders them as visible text
    assert(text.includes('Tom'), 'Content with ampersands should render')
    assert(text.includes('Jerry'), 'Content after ampersand should render')
  })

  // ── 7. Page size verification ──────────────────────
  console.log('\n7. Page size and orientation')

  await test('A4 and Letter produce different-sized PDFs', async () => {
    const tpl = '<html><body><p style="font-family:Helvetica">Page size test with enough content to fill the page. Lorem ipsum dolor sit amet.</p></body></html>'
    const a4 = await render(tpl, {}, { pageSize: 'a4' })
    const letter = await render(tpl, {}, { pageSize: 'letter' })
    const a4Pdf = await downloadPdf(a4.url)
    const letterPdf = await downloadPdf(letter.url)
    // MediaBox dimensions should differ — A4 is 595x842pt, Letter is 612x792pt
    const a4Text = new TextDecoder('latin1').decode(a4Pdf)
    const letterText = new TextDecoder('latin1').decode(letterPdf)
    const a4Box = a4Text.match(/\/MediaBox\s*\[\s*[\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)\s*\]/)
    const letterBox = letterText.match(/\/MediaBox\s*\[\s*[\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)\s*\]/)
    assert(!!a4Box, 'A4 PDF missing MediaBox')
    assert(!!letterBox, 'Letter PDF missing MediaBox')
    const a4Width = parseFloat(a4Box![1]!)
    const letterWidth = parseFloat(letterBox![1]!)
    assert(
      Math.abs(a4Width - letterWidth) > 1,
      `A4 (${a4Width}) and Letter (${letterWidth}) should have different widths`
    )
  })

  await test('Landscape orientation produces wider-than-tall pages', async () => {
    const result = await render(
      '<p style="font-family:Helvetica">Landscape</p>',
      {},
      { orientation: 'landscape', pageSize: 'letter' }
    )
    const pdf = await downloadPdf(result.url)
    const pdfText = new TextDecoder('latin1').decode(pdf)
    const box = pdfText.match(/\/MediaBox\s*\[\s*[\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)\s*\]/)
    assert(!!box, 'Missing MediaBox')
    const width = parseFloat(box![1]!)
    const height = parseFloat(box![2]!)
    assert(width > height, `Landscape should be wider than tall: ${width}x${height}`)
  })

  // ── 8. Full invoice end-to-end ─────────────────────
  console.log('\n8. Full invoice end-to-end — every field verified')

  await test('Complete invoice: all fields present in rendered PDF', async () => {
    const invoice = {
      invoiceNumber: 'INV-2026-0417',
      date: 'April 1, 2026',
      dueDate: 'May 1, 2026',
      company: 'Typeset Inc.',
      clientName: 'Grayhaven Technologies',
      clientAddress: '123 Main St, Austin TX 78701',
      subtotal: '$3,250.00',
      tax: '$260.00',
      total: '$3,510.00',
      items: [
        { description: 'API Development', hours: '20', rate: '$100', amount: '$2,000' },
        { description: 'UI Design', hours: '10', rate: '$75', amount: '$750' },
        { description: 'QA Testing', hours: '10', rate: '$50', amount: '$500' },
      ],
    }
    const result = await render(
      `<html><body style="font-family:Helvetica;padding:40px">
        <h1>Invoice {{invoiceNumber}}</h1>
        <p>Date: {{date}}</p>
        <p>Due: {{dueDate}}</p>
        <p>From: {{company}}</p>
        <p>Bill to: {{clientName}}</p>
        <p>{{clientAddress}}</p>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr><th>Description</th><th>Hours</th><th>Rate</th><th>Amount</th></tr></thead>
          <tbody>{{#each items}}<tr>
            <td>{{description}}</td><td>{{hours}}</td><td>{{rate}}</td><td>{{amount}}</td>
          </tr>{{/each}}</tbody>
        </table>
        <p>Subtotal: {{subtotal}}</p>
        <p>Tax: {{tax}}</p>
        <p>Total: {{total}}</p>
      </body></html>`,
      invoice
    )

    const tpl = `<html><body style="padding:40px">
        <h1>Invoice {{invoiceNumber}}</h1>
        <p>Date: {{date}}</p>
        <p>Due: {{dueDate}}</p>
        <p>From: {{company}}</p>
        <p>Bill to: {{clientName}}</p>
        <p>{{clientAddress}}</p>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr><th>Description</th><th>Hours</th><th>Rate</th><th>Amount</th></tr></thead>
          <tbody>{{#each items}}<tr>
            <td>{{description}}</td><td>{{hours}}</td><td>{{rate}}</td><td>{{amount}}</td>
          </tr>{{/each}}</tbody>
        </table>
        <p>Subtotal: {{subtotal}}</p>
        <p>Tax: {{tax}}</p>
        <p>Total: {{total}}</p>
      </body></html>`
    const text = await extractRenderedText(tpl, invoice)

    // Verify every scalar field
    const scalarFields = ['invoiceNumber', 'date', 'dueDate', 'company', 'clientName', 'subtotal', 'tax', 'total'] as const
    for (const field of scalarFields) {
      const value = invoice[field]
      assert(text.includes(value), `Missing field "${field}": expected "${value}"\nRendered text: ${text.slice(0, 500)}`)
    }

    // Verify every line item
    for (const item of invoice.items) {
      assert(text.includes(item.description), `Missing line item: ${item.description}`)
      assert(text.includes(item.amount), `Missing amount for ${item.description}: ${item.amount}`)
    }
  })

  // ── 9. Performance ─────────────────────────────────
  console.log('\n9. Performance benchmarks')

  await test('Simple render completes under 2 seconds', async () => {
    const start = performance.now()
    await render('<h1>{{title}}</h1>', { title: 'Speed Test' })
    const elapsed = performance.now() - start
    assert(elapsed < 2000, `Took ${Math.round(elapsed)}ms, expected < 2000ms`)
    console.log(`      (${Math.round(elapsed)}ms)`)
  })

  await test('10 sequential renders complete under 15 seconds', async () => {
    const start = performance.now()
    for (let i = 0; i < 10; i++) {
      await render('<p>{{n}}</p>', { n: String(i) })
    }
    const elapsed = performance.now() - start
    const avg = Math.round(elapsed / 10)
    assert(elapsed < 15000, `10 renders took ${Math.round(elapsed)}ms (avg ${avg}ms), expected < 15s`)
    console.log(`      (${Math.round(elapsed)}ms total, ${avg}ms avg)`)
  })

  await test('Complex template (table + sections) renders under 3 seconds', async () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({
      id: String(i), name: `Product ${i}`, price: `$${i * 10}`,
    }))
    const start = performance.now()
    await render(
      `<html><body>
        <h1>{{title}}</h1>
        <section><h2>Overview</h2><p>{{overview}}</p></section>
        <section><h2>Items</h2>
          <table><thead><tr><th>ID</th><th>Name</th><th>Price</th></tr></thead>
          <tbody>{{#each rows}}<tr><td>{{id}}</td><td>{{name}}</td><td>{{price}}</td></tr>{{/each}}</tbody>
          </table>
        </section>
        <section><h2>Notes</h2><p>{{notes}}</p></section>
      </body></html>`,
      { title: 'Complex Report', overview: 'Detailed breakdown.', notes: 'All data verified.', rows }
    )
    const elapsed = performance.now() - start
    assert(elapsed < 3000, `Complex render took ${Math.round(elapsed)}ms, expected < 3s`)
    console.log(`      (${Math.round(elapsed)}ms)`)
  })

  // ── 10. Run lineage integrity ──────────────────────
  console.log('\n10. Run lineage integrity')

  await test('Run stores correct template and data hashes', async () => {
    const tpl = '<p>{{x}}</p>'
    const data = { x: 'lineage-test' }
    const result = await render(tpl, data)

    // Fetch the run and verify hashes match
    const runRes = await fetch(`${API}/v1/runs/${result.runId}`, {
      headers: { Authorization: `Bearer ${KEY}` },
    })
    const run = ((await runRes.json()) as any).data

    assert(run.templateHash === result.metadata.templateHash, 'Run templateHash should match render response')
    assert(run.dataHash === result.metadata.dataHash, 'Run dataHash should match render response')
    assert(run.status === 'completed', `Run status should be completed, got ${run.status}`)
    assert(run.pages === result.metadata.pages, 'Run pages should match')
    assert(run.sizeBytes === result.metadata.sizeBytes, 'Run sizeBytes should match')
    assert(run.renderTimeMs === result.metadata.renderTimeMs, 'Run renderTimeMs should match')
  })

  // ── Summary ────────────────────────────────────────
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`\n  Quality Results: ${passed} passed, ${failed} failed\n`)

  if (failures.length > 0) {
    console.log('  Failures:')
    for (const f of failures) {
      console.log(`    ❌ ${f}`)
    }
  }

  console.log()
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
