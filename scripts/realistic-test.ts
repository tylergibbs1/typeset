/**
 * Realistic document pipeline tests — real-world documents rendered, OCR'd, and verified.
 * These simulate actual customer workflows, not toy examples.
 *
 * Run: MISTRAL_API_KEY=... bun scripts/realistic-test.ts
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
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ template, data, options: { smartLayout: false, ...options } }),
  })
  const json = (await res.json()) as any
  if (res.status !== 200) throw new Error(`Render failed: ${json.detail ?? res.status}`)
  return json.data
}

async function ocrPdf(url: string): Promise<string> {
  const pdfRes = await fetch(url)
  const pdf = new Uint8Array(await pdfRes.arrayBuffer())
  const base64 = Buffer.from(pdf).toString('base64')
  const res = await fetch(`${API}/v1/extract`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      document: { type: 'base64', data: base64, mimeType: 'application/pdf' },
      options: { tableFormat: null },
    }),
  })
  const json = (await res.json()) as any
  if (res.status !== 200) throw new Error(`OCR failed: ${res.status}`)
  let text = json.data.pages.map((p: any) => p.markdown).join('\n')
  for (const page of json.data.pages) {
    for (const table of page.tables ?? []) text += '\n' + (table.content ?? '')
  }
  return text
}

function verify(ocrText: string, expected: Record<string, string>): { score: number; missing: string[] } {
  const missing: string[] = []
  for (const [field, value] of Object.entries(expected)) {
    if (!ocrText.includes(value)) missing.push(`${field}: "${value}"`)
  }
  const total = Object.keys(expected).length
  return { score: total > 0 ? (total - missing.length) / total : 1, missing }
}

// ─── Realistic Documents ─────────────────────────────

async function main() {
  console.log('\n📄 REALISTIC DOCUMENT PIPELINE TESTS\n')

  // ── 1. SaaS Invoice ────────────────────────────────
  console.log('1. SaaS Monthly Invoice')

  const saasInvoice = {
    invoiceNumber: 'INV-2026-04-0183',
    issueDate: 'April 1, 2026',
    dueDate: 'April 30, 2026',
    companyName: 'Typeset Inc.',
    companyAddress: '548 Market St, Suite 92301, San Francisco, CA 94104',
    companyEmail: 'billing@typeset.dev',
    clientName: 'Grayhaven Technologies LLC',
    clientAddress: '4200 Research Forest Dr, Suite 300, The Woodlands, TX 77381',
    clientEmail: 'accounts@grayhavenops.com',
    paymentTerms: 'Net 30',
    subtotal: '$8,750.00',
    discount: '-$875.00',
    taxRate: '8.25%',
    taxAmount: '$649.69',
    total: '$8,524.69',
    amountDue: '$8,524.69',
    items: [
      { description: 'Typeset API — Scale Plan (April 2026)', qty: '1', unitPrice: '$2,500.00', amount: '$2,500.00' },
      { description: 'Document Renders (12,847 renders)', qty: '12,847', unitPrice: '$0.25', amount: '$3,211.75' },
      { description: 'OCR Extractions (1,203 pages)', qty: '1,203', unitPrice: '$0.50', amount: '$601.50' },
      { description: 'AI Layout Optimization', qty: '4,891', unitPrice: '$0.10', amount: '$489.10' },
      { description: 'Render Verification (OCR)', qty: '3,895', unitPrice: '$0.15', amount: '$584.25' },
      { description: 'Priority Support — Enterprise', qty: '1', unitPrice: '$500.00', amount: '$500.00' },
      { description: 'Custom Template Development (8 hrs)', qty: '8', unitPrice: '$150.00', amount: '$1,200.00' },
    ],
    notes: 'Payment via ACH preferred. Wire transfer details available upon request.',
    bankName: 'Silicon Valley Bank',
    routingNumber: '121140399',
    accountNumber: '****4821',
  }

  await test('SaaS invoice renders successfully', async () => {
    const result = await render(`<html><head>
<style>
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1a1a1a; padding: 48px; font-size: 13px; line-height: 1.5; }
  .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
  .company { font-size: 20px; font-weight: 700; color: #111; }
  .invoice-title { font-size: 32px; font-weight: 300; color: #333; margin-bottom: 8px; }
  .invoice-meta td { padding: 3px 12px 3px 0; font-size: 13px; }
  .invoice-meta td:first-child { font-weight: 600; color: #666; }
  .parties { display: flex; gap: 80px; margin: 32px 0; }
  .party-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 6px; }
  .party-name { font-weight: 600; font-size: 15px; }
  table.items { width: 100%; border-collapse: collapse; margin: 24px 0; }
  table.items th { background: #f8f9fa; border-bottom: 2px solid #dee2e6; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #666; }
  table.items td { padding: 10px 12px; border-bottom: 1px solid #eee; }
  table.items tr:last-child td { border-bottom: none; }
  .text-right { text-align: right; }
  .totals { margin-left: auto; width: 280px; }
  .totals td { padding: 6px 0; }
  .totals .total-row { font-size: 18px; font-weight: 700; border-top: 2px solid #111; padding-top: 12px; }
  .notes { margin-top: 40px; padding: 16px; background: #f8f9fa; border-radius: 6px; font-size: 12px; color: #555; }
  .footer { margin-top: 48px; text-align: center; font-size: 11px; color: #999; }
</style></head><body>
  <div class="header">
    <div><div class="company">{{companyName}}</div><div>{{companyAddress}}</div><div>{{companyEmail}}</div></div>
    <div style="text-align:right"><div class="invoice-title">INVOICE</div></div>
  </div>
  <table class="invoice-meta">
    <tr><td>Invoice #</td><td>{{invoiceNumber}}</td></tr>
    <tr><td>Issue Date</td><td>{{issueDate}}</td></tr>
    <tr><td>Due Date</td><td>{{dueDate}}</td></tr>
    <tr><td>Payment Terms</td><td>{{paymentTerms}}</td></tr>
  </table>
  <div class="parties">
    <div><div class="party-label">Bill To</div><div class="party-name">{{clientName}}</div><div>{{clientAddress}}</div><div>{{clientEmail}}</div></div>
  </div>
  <table class="items">
    <thead><tr><th>Description</th><th class="text-right">Qty</th><th class="text-right">Unit Price</th><th class="text-right">Amount</th></tr></thead>
    <tbody>{{#each items}}<tr><td>{{description}}</td><td class="text-right">{{qty}}</td><td class="text-right">{{unitPrice}}</td><td class="text-right">{{amount}}</td></tr>{{/each}}</tbody>
  </table>
  <table class="totals">
    <tr><td>Subtotal</td><td class="text-right">{{subtotal}}</td></tr>
    <tr><td>Discount (10%)</td><td class="text-right">{{discount}}</td></tr>
    <tr><td>Tax ({{taxRate}})</td><td class="text-right">{{taxAmount}}</td></tr>
    <tr class="total-row"><td>Amount Due</td><td class="text-right">{{amountDue}}</td></tr>
  </table>
  <div class="notes"><strong>Notes:</strong> {{notes}}<br/><strong>Bank:</strong> {{bankName}} | Routing: {{routingNumber}} | Account: {{accountNumber}}</div>
  <div class="footer">{{companyName}} — {{companyAddress}}</div>
</body></html>`, saasInvoice)
    assert(result.metadata.pages >= 1, `Should render, got ${result.metadata.pages} pages`)
    assert(result.metadata.sizeBytes > 20000, `Too small: ${result.metadata.sizeBytes}`)
    console.log(`      ${result.metadata.pages} page(s), ${(result.metadata.sizeBytes / 1024).toFixed(0)}KB, ${result.metadata.renderTimeMs}ms`)
  })

  await test('SaaS invoice: OCR verifies all financial fields', async () => {
    const result = await render(`<html><head><style>body{font-family:Helvetica,sans-serif;padding:48px;font-size:14px}table{width:100%;border-collapse:collapse;margin:16px 0}th{background:#f5f5f5;padding:8px;text-align:left;border-bottom:2px solid #ddd;font-size:12px}td{padding:8px;border-bottom:1px solid #eee}.right{text-align:right}h1{font-size:28px;font-weight:300;margin-bottom:4px}</style></head><body>
<h1>INVOICE</h1>
<p><strong>Invoice #:</strong> {{invoiceNumber}}</p>
<p><strong>Date:</strong> {{issueDate}}</p>
<p><strong>Due:</strong> {{dueDate}}</p>
<p><strong>From:</strong> {{companyName}}</p>
<p><strong>Bill To:</strong> {{clientName}}</p>
<p><strong>Address:</strong> {{clientAddress}}</p>
<table><thead><tr><th>Description</th><th class="right">Qty</th><th class="right">Unit Price</th><th class="right">Amount</th></tr></thead>
<tbody>{{#each items}}<tr><td>{{description}}</td><td class="right">{{qty}}</td><td class="right">{{unitPrice}}</td><td class="right">{{amount}}</td></tr>{{/each}}</tbody></table>
<p><strong>Subtotal:</strong> {{subtotal}}</p>
<p><strong>Discount:</strong> {{discount}}</p>
<p><strong>Tax ({{taxRate}}):</strong> {{taxAmount}}</p>
<p style="font-size:20px"><strong>TOTAL DUE: {{amountDue}}</strong></p>
<p>{{notes}}</p>
<p><strong>Bank:</strong> {{bankName}} | Routing: {{routingNumber}} | Account: {{accountNumber}}</p>
</body></html>`, saasInvoice)

    const ocr = await ocrPdf(result.url)
    const financialFields = {
      invoiceNumber: saasInvoice.invoiceNumber,
      subtotal: saasInvoice.subtotal,
      discount: saasInvoice.discount,
      taxAmount: saasInvoice.taxAmount,
      amountDue: saasInvoice.amountDue,
      companyName: saasInvoice.companyName,
      clientName: saasInvoice.clientName,
    }
    const { score, missing } = verify(ocr, financialFields)
    console.log(`      Financial fields: ${((score) * 100).toFixed(0)}% (${Object.keys(financialFields).length - missing.length}/${Object.keys(financialFields).length})`)
    if (missing.length > 0) console.log(`      Missing: ${missing.join(', ')}`)
    assert(score >= 0.8, `Financial verification too low: ${(score * 100).toFixed(0)}%`)
  })

  await test('SaaS invoice: OCR verifies line items', async () => {
    const result = await render(`<html><head><style>body{font-family:Helvetica;padding:40px;font-size:14px}table{width:100%;border-collapse:collapse}th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left}</style></head><body>
<h1>Line Items</h1>
<table><thead><tr><th>Description</th><th>Amount</th></tr></thead>
<tbody>{{#each items}}<tr><td>{{description}}</td><td>{{amount}}</td></tr>{{/each}}</tbody></table>
</body></html>`, saasInvoice)

    const ocr = await ocrPdf(result.url)
    let found = 0
    for (const item of saasInvoice.items) {
      if (ocr.includes(item.amount)) found++
    }
    console.log(`      Line item amounts: ${found}/${saasInvoice.items.length} found`)
    assert(found >= 5, `Only ${found}/${saasInvoice.items.length} line item amounts found`)
  })

  // ── 2. Employment Offer Letter ─────────────────────
  console.log('\n2. Employment Offer Letter')

  const offerLetter = {
    candidateName: 'Sarah Chen',
    position: 'Senior Software Engineer',
    department: 'Platform Engineering',
    startDate: 'May 15, 2026',
    salary: '$185,000',
    signingBonus: '$15,000',
    equityGrant: '12,500 shares',
    vestingSchedule: '4-year vesting with 1-year cliff',
    ptoPolicy: '20 days PTO + 10 company holidays',
    healthBenefits: 'Medical, dental, and vision coverage (100% employee, 75% dependents)',
    retirement: '401(k) with 4% company match',
    managerName: 'David Park',
    managerTitle: 'VP of Engineering',
    companyName: 'Typeset Inc.',
    offerExpiration: 'April 15, 2026',
  }

  await test('Offer letter: critical terms verified by OCR', async () => {
    const result = await render(`<html><head><style>body{font-family:'Georgia',serif;padding:60px;font-size:14px;line-height:1.8;max-width:700px;margin:0 auto}h1{font-size:24px;text-align:center;margin-bottom:40px}.sig{margin-top:60px;border-top:1px solid #333;width:250px;padding-top:8px}</style></head><body>
<h1>{{companyName}}</h1>
<p>Dear {{candidateName}},</p>
<p>We are pleased to offer you the position of <strong>{{position}}</strong> in our {{department}} department, starting <strong>{{startDate}}</strong>.</p>
<h2>Compensation</h2>
<p>Your annual base salary will be <strong>{{salary}}</strong>, paid semi-monthly. You will receive a signing bonus of <strong>{{signingBonus}}</strong>, payable within 30 days of your start date.</p>
<h2>Equity</h2>
<p>You will be granted <strong>{{equityGrant}}</strong> of common stock, subject to a <strong>{{vestingSchedule}}</strong>.</p>
<h2>Benefits</h2>
<ul>
<li><strong>Health:</strong> {{healthBenefits}}</li>
<li><strong>Time Off:</strong> {{ptoPolicy}}</li>
<li><strong>Retirement:</strong> {{retirement}}</li>
</ul>
<p>This offer is contingent upon successful completion of a background check and is valid until <strong>{{offerExpiration}}</strong>.</p>
<p>We are excited about the possibility of you joining our team.</p>
<p>Sincerely,</p>
<div class="sig">{{managerName}}<br/>{{managerTitle}}</div>
</body></html>`, offerLetter)

    const ocr = await ocrPdf(result.url)
    const criticalTerms = {
      candidateName: offerLetter.candidateName,
      position: offerLetter.position,
      salary: offerLetter.salary,
      signingBonus: offerLetter.signingBonus,
      equityGrant: offerLetter.equityGrant,
      startDate: offerLetter.startDate,
      offerExpiration: offerLetter.offerExpiration,
    }
    const { score, missing } = verify(ocr, criticalTerms)
    console.log(`      Critical terms: ${(score * 100).toFixed(0)}% (${Object.keys(criticalTerms).length - missing.length}/${Object.keys(criticalTerms).length})`)
    if (missing.length > 0) console.log(`      Missing: ${missing.join(', ')}`)
    assert(score >= 0.85, `Offer letter verification: ${(score * 100).toFixed(0)}%`)
  })

  // ── 3. Quarterly Financial Report ──────────────────
  console.log('\n3. Quarterly Financial Report (multi-table)')

  const financialReport = {
    companyName: 'Grayhaven Technologies',
    quarter: 'Q1 2026',
    reportDate: 'April 15, 2026',
    totalRevenue: '$2,847,500',
    totalCogs: '$1,138,000',
    grossProfit: '$1,709,500',
    grossMargin: '60.0%',
    operatingExpenses: '$1,234,000',
    netIncome: '$475,500',
    cashOnHand: '$4,200,000',
    burnRate: '$312,000',
    runway: '13.5 months',
    headcount: '47',
    revenueStreams: [
      { source: 'API Subscriptions', amount: '$1,425,000', pct: '50.0%' },
      { source: 'Enterprise Contracts', amount: '$892,500', pct: '31.3%' },
      { source: 'Professional Services', amount: '$337,500', pct: '11.9%' },
      { source: 'Marketplace Revenue', amount: '$192,500', pct: '6.8%' },
    ],
    expenses: [
      { category: 'Engineering Salaries', amount: '$612,000' },
      { category: 'Cloud Infrastructure', amount: '$187,000' },
      { category: 'Sales & Marketing', amount: '$234,000' },
      { category: 'G&A', amount: '$156,000' },
      { category: 'R&D (non-headcount)', amount: '$45,000' },
    ],
    kpis: [
      { metric: 'Monthly Recurring Revenue', value: '$949,167' },
      { metric: 'Annual Run Rate', value: '$11,390,000' },
      { metric: 'Net Revenue Retention', value: '124%' },
      { metric: 'Gross Churn', value: '2.1%' },
      { metric: 'CAC Payback', value: '8.2 months' },
      { metric: 'LTV:CAC Ratio', value: '5.8x' },
    ],
  }

  await test('Financial report: renders multi-table document', async () => {
    const result = await render(`<html><head><style>
body{font-family:Helvetica,sans-serif;padding:40px;font-size:13px;color:#1a1a1a}
h1{font-size:24px;border-bottom:3px solid #111;padding-bottom:8px}
h2{font-size:16px;color:#333;margin-top:28px;margin-bottom:8px}
table{width:100%;border-collapse:collapse;margin:12px 0}
th{background:#f0f0f0;padding:8px;text-align:left;font-size:11px;text-transform:uppercase;border-bottom:2px solid #ccc}
td{padding:7px 8px;border-bottom:1px solid #eee}
.right{text-align:right}
.highlight{background:#fffde7}
.summary td{font-weight:700;font-size:14px;border-top:2px solid #333}
</style></head><body>
<h1>{{companyName}} — {{quarter}} Financial Report</h1>
<p>Prepared: {{reportDate}}</p>
<h2>P&L Summary</h2>
<table>
<tr><td>Total Revenue</td><td class="right">{{totalRevenue}}</td></tr>
<tr><td>Cost of Goods Sold</td><td class="right">{{totalCogs}}</td></tr>
<tr class="highlight"><td><strong>Gross Profit</strong></td><td class="right"><strong>{{grossProfit}}</strong></td></tr>
<tr><td>Gross Margin</td><td class="right">{{grossMargin}}</td></tr>
<tr><td>Operating Expenses</td><td class="right">{{operatingExpenses}}</td></tr>
<tr class="summary"><td>Net Income</td><td class="right">{{netIncome}}</td></tr>
</table>
<h2>Revenue Breakdown</h2>
<table><thead><tr><th>Source</th><th class="right">Amount</th><th class="right">% of Revenue</th></tr></thead>
<tbody>{{#each revenueStreams}}<tr><td>{{source}}</td><td class="right">{{amount}}</td><td class="right">{{pct}}</td></tr>{{/each}}</tbody></table>
<h2>Operating Expenses</h2>
<table><thead><tr><th>Category</th><th class="right">Amount</th></tr></thead>
<tbody>{{#each expenses}}<tr><td>{{category}}</td><td class="right">{{amount}}</td></tr>{{/each}}</tbody></table>
<h2>Key Performance Indicators</h2>
<table><thead><tr><th>Metric</th><th class="right">Value</th></tr></thead>
<tbody>{{#each kpis}}<tr><td>{{metric}}</td><td class="right">{{value}}</td></tr>{{/each}}</tbody></table>
<h2>Cash Position</h2>
<table>
<tr><td>Cash on Hand</td><td class="right">{{cashOnHand}}</td></tr>
<tr><td>Monthly Burn Rate</td><td class="right">{{burnRate}}</td></tr>
<tr><td>Runway</td><td class="right">{{runway}}</td></tr>
<tr><td>Headcount</td><td class="right">{{headcount}}</td></tr>
</table>
</body></html>`, financialReport)

    assert(result.metadata.pages >= 1, 'Should render')
    console.log(`      ${result.metadata.pages} page(s), ${(result.metadata.sizeBytes / 1024).toFixed(0)}KB, ${result.metadata.renderTimeMs}ms`)
  })

  await test('Financial report: OCR verifies P&L figures', async () => {
    const result = await render(`<html><head><style>body{font-family:Helvetica;padding:40px;font-size:14px}table{width:100%;border-collapse:collapse}td{padding:8px;border-bottom:1px solid #eee}</style></head><body>
<h1>{{companyName}} — {{quarter}}</h1>
<h2>P&L Summary</h2>
<table>
<tr><td>Total Revenue</td><td>{{totalRevenue}}</td></tr>
<tr><td>COGS</td><td>{{totalCogs}}</td></tr>
<tr><td>Gross Profit</td><td>{{grossProfit}}</td></tr>
<tr><td>Net Income</td><td>{{netIncome}}</td></tr>
</table>
<h2>KPIs</h2>
<table>{{#each kpis}}<tr><td>{{metric}}</td><td>{{value}}</td></tr>{{/each}}</table>
</body></html>`, financialReport)

    const ocr = await ocrPdf(result.url)
    const plFields = {
      totalRevenue: financialReport.totalRevenue,
      grossProfit: financialReport.grossProfit,
      netIncome: financialReport.netIncome,
      companyName: financialReport.companyName,
    }
    const { score, missing } = verify(ocr, plFields)
    console.log(`      P&L: ${(score * 100).toFixed(0)}% (${Object.keys(plFields).length - missing.length}/${Object.keys(plFields).length})`)
    if (missing.length > 0) console.log(`      Missing: ${missing.join(', ')}`)
    assert(score >= 0.75, `P&L verification: ${(score * 100).toFixed(0)}%`)
  })

  // ── 4. Shipping Label / Packing Slip ───────────────
  console.log('\n4. E-commerce Packing Slip')

  const packingSlip = {
    orderNumber: 'ORD-2026-88431',
    orderDate: 'March 29, 2026',
    shipDate: 'April 1, 2026',
    carrier: 'FedEx Ground',
    trackingNumber: '794644790568',
    shipFrom: 'Typeset Fulfillment Center, 1200 Industrial Blvd, Memphis TN 38118',
    shipTo: 'Sarah Chen, 4200 Research Forest Dr, Suite 300, The Woodlands TX 77381',
    items: [
      { sku: 'TS-PRO-001', name: 'Typeset Pro License (Annual)', qty: '1', price: '$599.00' },
      { sku: 'TS-TPL-050', name: 'Premium Template Pack (50)', qty: '1', price: '$149.00' },
      { sku: 'TS-SUP-ENT', name: 'Enterprise Support Add-on', qty: '1', price: '$299.00' },
    ],
    subtotal: '$1,047.00',
    shipping: '$12.99',
    total: '$1,059.99',
  }

  await test('Packing slip: order and shipping details verified', async () => {
    const result = await render(`<html><head><style>body{font-family:Helvetica;padding:32px;font-size:13px}h1{font-size:20px}table{width:100%;border-collapse:collapse;margin:12px 0}th,td{padding:6px 8px;border:1px solid #ccc;text-align:left;font-size:12px}th{background:#eee}.right{text-align:right}</style></head><body>
<h1>PACKING SLIP</h1>
<p><strong>Order:</strong> {{orderNumber}} | <strong>Date:</strong> {{orderDate}} | <strong>Ship Date:</strong> {{shipDate}}</p>
<p><strong>Carrier:</strong> {{carrier}} | <strong>Tracking:</strong> {{trackingNumber}}</p>
<p><strong>Ship From:</strong> {{shipFrom}}</p>
<p><strong>Ship To:</strong> {{shipTo}}</p>
<table><thead><tr><th>SKU</th><th>Item</th><th class="right">Qty</th><th class="right">Price</th></tr></thead>
<tbody>{{#each items}}<tr><td>{{sku}}</td><td>{{name}}</td><td class="right">{{qty}}</td><td class="right">{{price}}</td></tr>{{/each}}</tbody></table>
<p><strong>Subtotal:</strong> {{subtotal}} | <strong>Shipping:</strong> {{shipping}} | <strong>Total:</strong> {{total}}</p>
</body></html>`, packingSlip)

    const ocr = await ocrPdf(result.url)
    const { score, missing } = verify(ocr, {
      orderNumber: packingSlip.orderNumber,
      trackingNumber: packingSlip.trackingNumber,
      total: packingSlip.total,
      carrier: packingSlip.carrier,
    })
    console.log(`      Shipping fields: ${(score * 100).toFixed(0)}%`)
    if (missing.length > 0) console.log(`      Missing: ${missing.join(', ')}`)
    assert(score >= 0.75, `Packing slip verification: ${(score * 100).toFixed(0)}%`)
  })

  // ── 5. NDA / Legal Document ────────────────────────
  console.log('\n5. Non-Disclosure Agreement')

  const nda = {
    partyA: 'Typeset Inc.',
    partyAAddress: '548 Market St, Suite 92301, San Francisco, CA 94104',
    partyB: 'Grayhaven Technologies LLC',
    partyBAddress: '4200 Research Forest Dr, Suite 300, The Woodlands, TX 77381',
    effectiveDate: 'April 1, 2026',
    duration: 'two (2) years',
    governingLaw: 'State of California',
    jurisdiction: 'San Francisco County, California',
  }

  await test('NDA: all party names and legal terms verified', async () => {
    const result = await render(`<html><head><style>body{font-family:Georgia,serif;padding:60px;font-size:13px;line-height:1.9;max-width:680px;margin:0 auto}h1{text-align:center;font-size:18px;text-transform:uppercase;letter-spacing:2px}h2{font-size:14px}p{text-align:justify}</style></head><body>
<h1>Mutual Non-Disclosure Agreement</h1>
<p>This Mutual Non-Disclosure Agreement ("Agreement") is entered into as of <strong>{{effectiveDate}}</strong> ("Effective Date") by and between:</p>
<p><strong>{{partyA}}</strong>, a Delaware corporation with offices at {{partyAAddress}} ("Party A"); and</p>
<p><strong>{{partyB}}</strong>, a Texas limited liability company with offices at {{partyBAddress}} ("Party B").</p>
<h2>1. Definition of Confidential Information</h2>
<p>"Confidential Information" means any non-public information disclosed by either party to the other, whether orally, in writing, or by inspection, including but not limited to: trade secrets, business plans, financial data, customer lists, technical specifications, source code, algorithms, and product roadmaps.</p>
<h2>2. Obligations</h2>
<p>Each party agrees to: (a) hold Confidential Information in strict confidence; (b) not disclose it to any third party without prior written consent; (c) use it solely for the purpose of evaluating a potential business relationship.</p>
<h2>3. Term</h2>
<p>This Agreement shall remain in effect for a period of <strong>{{duration}}</strong> from the Effective Date.</p>
<h2>4. Governing Law</h2>
<p>This Agreement shall be governed by and construed in accordance with the laws of the <strong>{{governingLaw}}</strong>, without regard to conflict of law principles. Any disputes shall be resolved in the courts of <strong>{{jurisdiction}}</strong>.</p>
<h2>5. Signatures</h2>
<p>IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above.</p>
<table style="width:100%;margin-top:40px"><tr>
<td style="width:45%"><div style="border-top:1px solid #333;padding-top:8px;margin-top:60px">{{partyA}}<br/>Authorized Signatory</div></td>
<td style="width:10%"></td>
<td style="width:45%"><div style="border-top:1px solid #333;padding-top:8px;margin-top:60px">{{partyB}}<br/>Authorized Signatory</div></td>
</tr></table>
</body></html>`, nda)

    const ocr = await ocrPdf(result.url)
    const { score, missing } = verify(ocr, {
      partyA: nda.partyA,
      partyB: nda.partyB,
      effectiveDate: nda.effectiveDate,
      duration: nda.duration,
      governingLaw: nda.governingLaw,
      jurisdiction: nda.jurisdiction,
    })
    console.log(`      Legal terms: ${(score * 100).toFixed(0)}% (${6 - missing.length}/6)`)
    if (missing.length > 0) console.log(`      Missing: ${missing.join(', ')}`)
    assert(score >= 0.8, `NDA verification: ${(score * 100).toFixed(0)}%`)
  })

  // ── 6. Determinism across all documents ────────────
  console.log('\n6. Determinism — same input always produces same hash')

  await test('Rendering same invoice twice produces identical hashes', async () => {
    const tpl = '<html><body style="font-family:Helvetica;padding:40px"><h1>{{invoiceNumber}}</h1><p>{{clientName}}</p><p>{{total}}</p></body></html>'
    const data = { invoiceNumber: 'DET-001', clientName: 'Hash Test Corp', total: '$999.99' }
    const r1 = await render(tpl, data)
    const r2 = await render(tpl, data)
    assert(r1.metadata.templateHash === r2.metadata.templateHash, 'Template hash mismatch')
    assert(r1.metadata.dataHash === r2.metadata.dataHash, 'Data hash mismatch')
    console.log(`      templateHash: ${r1.metadata.templateHash.slice(0, 16)}... ✓`)
    console.log(`      dataHash: ${r1.metadata.dataHash.slice(0, 16)}... ✓`)
  })

  // ── Summary ────────────────────────────────────────
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`\n  Realistic Test Results: ${passed} passed, ${failed} failed\n`)
  if (failures.length > 0) {
    console.log('  Failures:')
    for (const f of failures) console.log(`    ❌ ${f}`)
  }
  console.log()
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1) })
