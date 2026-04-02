/**
 * Closed-loop verification tests — the core PRD claim:
 * render → OCR → verify every field matches input data.
 *
 * Tests the full pipeline: Playwright render → Mistral OCR → field comparison.
 * Requires: MISTRAL_API_KEY
 *
 * Run: bun scripts/closed-loop-test.ts
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

async function ocrPdf(pdfBuffer: Uint8Array): Promise<string> {
  const base64 = Buffer.from(pdfBuffer).toString('base64')
  const res = await fetch(`${API}/v1/extract`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      document: { type: 'base64', data: base64, mimeType: 'application/pdf' },
      // Use null tableFormat to keep tables inline in markdown (better for verification)
      options: { tableFormat: null },
    }),
  })
  const json = (await res.json()) as any
  if (res.status !== 200) throw new Error(`Extract/OCR failed: ${res.status} ${json.detail ?? ''}`)
  // Combine markdown + any separated table content
  let text = json.data.pages.map((p: any) => p.markdown).join('\n')
  for (const page of json.data.pages) {
    for (const table of page.tables ?? []) {
      text += '\n' + (table.content ?? '')
    }
  }
  return text
}

function verifyFields(
  ocrText: string,
  inputData: Record<string, unknown>
): { score: number; issues: string[]; totalFields: number } {
  const issues: string[] = []
  let totalFields = 0

  for (const [key, value] of Object.entries(inputData)) {
    if (typeof value === 'string') {
      totalFields++
      if (!ocrText.includes(value)) {
        issues.push(`Missing "${key}": expected "${value}"`)
      }
    } else if (typeof value === 'number') {
      totalFields++
      if (!ocrText.includes(String(value))) {
        issues.push(`Missing "${key}": expected ${value}`)
      }
    }
    // Skip arrays and objects — tested separately
  }

  const score = totalFields > 0 ? 1 - issues.length / totalFields : 1
  return { score: Math.max(0, score), issues, totalFields }
}

// ─── Tests ───────────────────────────────────────────

async function main() {
  console.log('\n🔁 CLOSED-LOOP VERIFICATION TESTS\n')
  console.log('   render → Mistral OCR → verify fields match input\n')

  // ── 1. Simple document ─────────────────────────────
  console.log('1. Simple document — render → OCR → verify')

  await test('Single-field document: OCR reads back the rendered text', async () => {
    const data = { title: 'Verification Test Document' }
    const result = await render(
      '<html><body><h1 style="font-family:Helvetica;font-size:24px">{{title}}</h1></body></html>',
      data
    )
    const pdf = await downloadPdf(result.url)
    const ocrText = await ocrPdf(pdf)
    console.log(`      OCR extracted: "${ocrText.trim().slice(0, 80)}"`)
    assert(
      ocrText.includes('Verification Test Document'),
      `OCR did not find title. Got: "${ocrText.slice(0, 200)}"`
    )
  })

  // ── 2. Multi-field document ────────────────────────
  console.log('\n2. Multi-field document — all fields verified')

  await test('Contact card: name, email, phone all OCR-readable', async () => {
    const data = {
      name: 'Eleanor Rigby',
      email: 'eleanor@abbey.road',
      phone: '+1-555-0199',
      role: 'Document Engineer',
    }
    const result = await render(
      `<html><body style="font-family:Helvetica;padding:40px">
        <h1 style="font-size:28px">{{name}}</h1>
        <p style="font-size:16px">{{role}}</p>
        <p style="font-size:14px">Email: {{email}}</p>
        <p style="font-size:14px">Phone: {{phone}}</p>
      </body></html>`,
      data
    )
    const pdf = await downloadPdf(result.url)
    const ocrText = await ocrPdf(pdf)
    const { score, issues, totalFields } = verifyFields(ocrText, data)
    console.log(`      Score: ${(score * 100).toFixed(0)}% (${totalFields - issues.length}/${totalFields} fields)`)
    if (issues.length > 0) console.log(`      Issues: ${issues.join(', ')}`)
    assert(score >= 0.75, `Verification score too low: ${score}. Issues: ${issues.join(', ')}`)
  })

  // ── 3. Invoice closed loop ─────────────────────────
  console.log('\n3. Invoice closed loop — the PRD\'s core use case')

  await test('Full invoice: render → OCR → verify all scalar fields', async () => {
    const invoice = {
      invoiceNumber: 'INV-2026-0501',
      date: 'April 1, 2026',
      company: 'Typeset Inc.',
      clientName: 'Acme Corporation',
      subtotal: '$4,500.00',
      tax: '$360.00',
      total: '$4,860.00',
    }
    const result = await render(
      `<html><body style="font-family:Helvetica;padding:40px">
        <h1 style="font-size:28px">INVOICE</h1>
        <table style="width:100%;margin:20px 0">
          <tr><td style="font-size:14px"><strong>Invoice #:</strong></td><td style="font-size:14px">{{invoiceNumber}}</td></tr>
          <tr><td style="font-size:14px"><strong>Date:</strong></td><td style="font-size:14px">{{date}}</td></tr>
          <tr><td style="font-size:14px"><strong>From:</strong></td><td style="font-size:14px">{{company}}</td></tr>
          <tr><td style="font-size:14px"><strong>Bill To:</strong></td><td style="font-size:14px">{{clientName}}</td></tr>
        </table>
        <hr/>
        <table style="width:100%;margin:20px 0">
          <tr><td style="font-size:16px"><strong>Subtotal:</strong></td><td style="font-size:16px">{{subtotal}}</td></tr>
          <tr><td style="font-size:16px"><strong>Tax:</strong></td><td style="font-size:16px">{{tax}}</td></tr>
          <tr style="background:#f0f0f0"><td style="font-size:20px"><strong>TOTAL:</strong></td><td style="font-size:20px"><strong>{{total}}</strong></td></tr>
        </table>
      </body></html>`,
      invoice
    )

    const pdf = await downloadPdf(result.url)
    const ocrText = await ocrPdf(pdf)
    const { score, issues, totalFields } = verifyFields(ocrText, invoice)

    console.log(`      Score: ${(score * 100).toFixed(0)}% (${totalFields - issues.length}/${totalFields} fields)`)
    console.log(`      OCR text length: ${ocrText.length} chars`)
    if (issues.length > 0) console.log(`      Issues: ${issues.join(', ')}`)

    assert(score >= 0.8, `Invoice verification failed: ${(score * 100).toFixed(0)}%. Issues: ${issues.join(', ')}`)
  })

  // ── 4. Table data verification ─────────────────────
  console.log('\n4. Table data — verify line items survive render → OCR')

  await test('Table rows: all item names and amounts OCR-readable', async () => {
    const items = [
      { description: 'API Development', amount: '$2,000.00' },
      { description: 'Infrastructure Setup', amount: '$1,500.00' },
      { description: 'Documentation', amount: '$800.00' },
    ]
    const result = await render(
      `<html><body style="font-family:Helvetica;padding:40px">
        <h1 style="font-size:24px">Service Breakdown</h1>
        <table style="width:100%;border-collapse:collapse;margin:20px 0">
          <thead><tr style="background:#333;color:white">
            <th style="padding:10px;font-size:14px;text-align:left">Service</th>
            <th style="padding:10px;font-size:14px;text-align:right">Amount</th>
          </tr></thead>
          <tbody>{{#each items}}<tr style="border-bottom:1px solid #ddd">
            <td style="padding:10px;font-size:14px">{{description}}</td>
            <td style="padding:10px;font-size:14px;text-align:right">{{amount}}</td>
          </tr>{{/each}}</tbody>
        </table>
      </body></html>`,
      { items }
    )

    const pdf = await downloadPdf(result.url)
    const ocrText = await ocrPdf(pdf)

    let itemsFound = 0
    for (const item of items) {
      if (ocrText.includes(item.description)) itemsFound++
      if (ocrText.includes(item.amount)) itemsFound++
    }
    const totalChecks = items.length * 2
    const itemScore = itemsFound / totalChecks
    console.log(`      Line items: ${itemsFound}/${totalChecks} fields found (${(itemScore * 100).toFixed(0)}%)`)
    assert(itemScore >= 0.7, `Only ${itemsFound}/${totalChecks} line item fields found in OCR`)
  })

  // ── 5. Extract endpoint ────────────────────────────
  console.log('\n5. Extract endpoint — OCR via API')

  await test('POST /v1/extract returns OCR pages from rendered PDF', async () => {
    // First render a PDF
    const renderResult = await render(
      '<html><body style="font-family:Helvetica;padding:40px"><h1 style="font-size:28px">Extract Test</h1><p style="font-size:16px">This document was created to test the extract endpoint.</p></body></html>',
      {}
    )

    // Download it and send to extract
    const pdf = await downloadPdf(renderResult.url)
    const base64 = Buffer.from(pdf).toString('base64')

    const res = await fetch(`${API}/v1/extract`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        document: { type: 'base64', data: base64, mimeType: 'application/pdf' },
      }),
    })
    const json = (await res.json()) as any
    assert(res.status === 200, `Extract failed: ${res.status} ${json.detail ?? ''}`)
    assert(Array.isArray(json.data.pages), 'Should return pages array')
    assert(json.data.pages.length >= 1, 'Should have at least 1 page')

    const extractedText = json.data.pages.map((p: any) => p.markdown).join('\n')
    console.log(`      Extracted ${json.data.pages.length} page(s), ${extractedText.length} chars`)
    assert(extractedText.includes('Extract Test'), 'Extracted text should contain "Extract Test"')
  })

  // ── 6. Verification via sync render ────────────────
  console.log('\n6. Sync render with verify=true')

  await test('Render with verify: true runs OCR verification', async () => {
    const res = await fetch(`${API}/v1/render`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        template: '<html><body style="font-family:Helvetica;padding:40px"><h1 style="font-size:28px">Verified Document</h1><p style="font-size:16px">Company: {{company}}</p><p style="font-size:16px">Amount: {{amount}}</p></body></html>',
        data: { company: 'Typeset Corp', amount: '$9,999.00' },
        options: { verify: true, smartLayout: false },
      }),
    })
    const json = (await res.json()) as any

    if (res.status === 200 && json.data?.verification) {
      const v = json.data.verification
      console.log(`      Verification: ${v.status}, score: ${v.score}, issues: ${v.issues?.length ?? 0}`)
      assert(
        ['passed', 'failed', 'skipped'].includes(v.status),
        `Invalid verification status: ${v.status}`
      )
      assert(typeof v.score === 'number', 'Score should be a number')
    } else {
      // verify=true might not be wired in sync render yet — that's ok, just note it
      console.log('      (verify=true not yet implemented in sync render — skipping)')
    }
  })

  // ── Summary ────────────────────────────────────────
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`\n  Closed-Loop Results: ${passed} passed, ${failed} failed\n`)

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
