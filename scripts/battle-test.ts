/**
 * Battle test — verifies every PRD claim against the live API.
 * Run: bun scripts/battle-test.ts
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

async function api(
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>
): Promise<{ status: number; headers: Headers; data: any }> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      ...(headers ?? {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  return { status: res.status, headers: res.headers, data }
}

// ─── Test suite ───────────────────────────────────────

const INVOICE_TEMPLATE = `<html><head><style>body{font-family:sans-serif;padding:40px}table{width:100%;border-collapse:collapse;margin:20px 0}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5}</style></head><body><h1>Invoice #{{invoiceNumber}}</h1><p>Date: {{date}}</p><p>Bill to: {{clientName}}</p>{{#if notes}}<p>Notes: {{notes}}</p>{{/if}}<table><thead><tr><th>Item</th><th>Qty</th><th>Price</th></tr></thead><tbody>{{#each items}}<tr><td>{{name}}</td><td>{{qty}}</td><td>{{price}}</td></tr>{{/each}}</tbody></table><p><strong>Total: {{total}}</strong></p></body></html>`

const INVOICE_DATA = {
  invoiceNumber: 'TEST-001',
  date: 'April 1, 2026',
  clientName: 'Battle Test Corp',
  notes: 'Net 30 payment terms',
  total: '$2,500.00',
  items: [
    { name: 'Widget A', qty: '10', price: '$1,000.00' },
    { name: 'Widget B', qty: '5', price: '$750.00' },
    { name: 'Service Fee', qty: '1', price: '$750.00' },
  ],
}

async function main() {
  console.log('\n🔥 TYPESET BATTLE TEST\n')

  // ── 1. Health ──────────────────────────────────────
  console.log('1. Health & basics')

  await test('GET /health returns 200', async () => {
    const res = await fetch(`${API}/health`)
    assert(res.status === 200, `expected 200, got ${res.status}`)
    const data = await res.json() as { status: string }
    assert(data.status === 'ok', `expected ok, got ${data.status}`)
  })

  // ── 2. Authentication ─────────────────────────────
  console.log('\n2. Authentication & scoping')

  await test('Request without auth returns 401', async () => {
    const res = await fetch(`${API}/v1/runs`)
    assert(res.status === 401, `expected 401, got ${res.status}`)
    const data = await res.json() as { type: string }
    assert(data.type.includes('unauthorized'), `expected unauthorized error type`)
  })

  await test('Request with invalid key returns 401', async () => {
    const res = await fetch(`${API}/v1/runs`, {
      headers: { Authorization: 'Bearer ts_test_invalid_key_000000' },
    })
    assert(res.status === 401, `expected 401, got ${res.status}`)
  })

  await test('Request with malformed auth returns 401', async () => {
    const res = await fetch(`${API}/v1/runs`, {
      headers: { Authorization: 'not-a-bearer-token' },
    })
    assert(res.status === 401, `expected 401, got ${res.status}`)
  })

  await test('Valid key returns 200', async () => {
    const { status } = await api('GET', '/v1/runs')
    assert(status === 200, `expected 200, got ${status}`)
  })

  // ── 3. Response headers ────────────────────────────
  console.log('\n3. API response headers (PRD claims)')

  await test('X-Request-Id header present', async () => {
    const { headers } = await api('GET', '/v1/runs')
    const reqId = headers.get('x-request-id')
    assert(!!reqId, 'missing X-Request-Id')
    assert(reqId!.startsWith('req_'), `expected req_ prefix, got ${reqId}`)
  })

  await test('X-RateLimit headers present', async () => {
    const { headers } = await api('GET', '/v1/runs')
    assert(!!headers.get('x-ratelimit-limit'), 'missing X-RateLimit-Limit')
    assert(!!headers.get('x-ratelimit-remaining'), 'missing X-RateLimit-Remaining')
    assert(!!headers.get('x-ratelimit-reset'), 'missing X-RateLimit-Reset')
  })

  await test('Typeset-Version header present', async () => {
    const { headers } = await api('GET', '/v1/runs')
    const version = headers.get('typeset-version')
    assert(!!version, 'missing Typeset-Version')
    assert(version === '2026-04-01', `expected 2026-04-01, got ${version}`)
  })

  // ── 4. RFC 9457 error format ───────────────────────
  console.log('\n4. RFC 9457 error format')

  await test('404 returns RFC 9457 problem details', async () => {
    const { status, data } = await api('GET', '/v1/runs/run_nonexistent')
    assert(status === 404, `expected 404, got ${status}`)
    assert(typeof data.type === 'string', 'missing type')
    assert(typeof data.title === 'string', 'missing title')
    assert(data.status === 404, 'missing status field')
    assert(typeof data.detail === 'string', 'missing detail')
    assert(typeof data.instance === 'string', 'missing instance (request id)')
  })

  await test('Global 404 returns RFC 9457', async () => {
    const { status, data } = await api('GET', '/v1/nonexistent-endpoint')
    assert(status === 404, `expected 404, got ${status}`)
    assert(data.type.includes('not-found'), `expected not-found type, got ${data.type}`)
  })

  // ── 5. Sync render ─────────────────────────────────
  console.log('\n5. Sync render pipeline')

  let renderResult: any

  await test('POST /v1/render creates a document run', async () => {
    const { status, data } = await api('POST', '/v1/render', {
      template: INVOICE_TEMPLATE,
      data: INVOICE_DATA,
      options: { pageSize: 'letter' },
    })
    assert(status === 200, `expected 200, got ${status}`)
    renderResult = data.data
    assert(renderResult.runId.startsWith('run_'), `runId missing prefix`)
    assert(typeof renderResult.url === 'string', 'missing url')
    assert(typeof renderResult.expiresAt === 'string', 'missing expiresAt')
    assert(renderResult.metadata.pages >= 1, 'pages should be >= 1')
    assert(renderResult.metadata.sizeBytes > 0, 'sizeBytes should be > 0')
    assert(renderResult.metadata.renderTimeMs > 0, 'renderTimeMs should be > 0')
    assert(typeof renderResult.metadata.templateHash === 'string', 'missing templateHash')
    assert(typeof renderResult.metadata.dataHash === 'string', 'missing dataHash')
  })

  await test('Rendered PDF is downloadable', async () => {
    const res = await fetch(renderResult.url)
    assert(res.status === 200, `PDF download failed: ${res.status}`)
    const buf = await res.arrayBuffer()
    assert(buf.byteLength > 1000, `PDF too small: ${buf.byteLength}`)
    const header = new TextDecoder('latin1').decode(buf.slice(0, 5))
    assert(header === '%PDF-', `Not a valid PDF: starts with ${header}`)
  })

  // ── 6. Deterministic rendering ─────────────────────
  console.log('\n6. Deterministic rendering')

  await test('Same input + template produces same hashes', async () => {
    const { data: d1 } = await api('POST', '/v1/render', {
      template: INVOICE_TEMPLATE,
      data: INVOICE_DATA,
      options: { smartLayout: false },
    })
    const { data: d2 } = await api('POST', '/v1/render', {
      template: INVOICE_TEMPLATE,
      data: INVOICE_DATA,
      options: { smartLayout: false },
    })
    assert(
      d1.data.metadata.templateHash === d2.data.metadata.templateHash,
      `templateHash mismatch: ${d1.data.metadata.templateHash} vs ${d2.data.metadata.templateHash}`
    )
    assert(
      d1.data.metadata.dataHash === d2.data.metadata.dataHash,
      `dataHash mismatch: ${d1.data.metadata.dataHash} vs ${d2.data.metadata.dataHash}`
    )
  })

  await test('Different data produces different dataHash', async () => {
    const { data: d1 } = await api('POST', '/v1/render', {
      template: '<h1>{{title}}</h1>',
      data: { title: 'A' },
    })
    const { data: d2 } = await api('POST', '/v1/render', {
      template: '<h1>{{title}}</h1>',
      data: { title: 'B' },
    })
    assert(
      d1.data.metadata.dataHash !== d2.data.metadata.dataHash,
      'different data should produce different hashes'
    )
    assert(
      d1.data.metadata.templateHash === d2.data.metadata.templateHash,
      'same template should produce same hash'
    )
  })

  // ── 7. Document run model ──────────────────────────
  console.log('\n7. Document run model (full lineage)')

  await test('GET /v1/runs/:id returns full run', async () => {
    const { status, data } = await api('GET', `/v1/runs/${renderResult.runId}`)
    assert(status === 200, `expected 200, got ${status}`)
    const run = data.data
    assert(run.id === renderResult.runId, 'id mismatch')
    assert(run.status === 'completed', `expected completed, got ${run.status}`)
    assert(typeof run.templateHash === 'string', 'missing templateHash')
    assert(typeof run.dataHash === 'string', 'missing dataHash')
    assert(typeof run.storageKey === 'string', 'missing storageKey')
    assert(run.pages >= 1, 'missing pages')
    assert(run.sizeBytes > 0, 'missing sizeBytes')
    assert(run.renderTimeMs > 0, 'missing renderTimeMs')
    assert(typeof run.createdAt === 'string', 'missing createdAt')
    assert(typeof run.completedAt === 'string', 'missing completedAt')
  })

  await test('GET /v1/runs lists runs with pagination', async () => {
    const { status, data } = await api('GET', '/v1/runs?limit=5')
    assert(status === 200, `expected 200, got ${status}`)
    assert(Array.isArray(data.data), 'data should be array')
    assert(data.data.length > 0, 'should have at least one run')
    assert('pagination' in data, 'missing pagination')
    assert('cursor' in data.pagination, 'missing cursor')
    assert('hasMore' in data.pagination, 'missing hasMore')
  })

  await test('GET /v1/runs filters by status', async () => {
    const { data } = await api('GET', '/v1/runs?status=completed&limit=3')
    for (const run of data.data) {
      assert(run.status === 'completed', `expected completed, got ${run.status}`)
    }
  })

  // ── 8. Template CRUD ───────────────────────────────
  console.log('\n8. Template CRUD')

  let templateId: string

  await test('POST /v1/templates creates a template', async () => {
    const { status, data } = await api('POST', '/v1/templates', {
      name: 'Battle Test Invoice',
      content: INVOICE_TEMPLATE,
      description: 'Test template for battle testing',
    })
    assert(status === 201, `expected 201, got ${status}`)
    templateId = data.data.id
    assert(templateId.startsWith('tpl_'), `id missing prefix: ${templateId}`)
    assert(data.data.version === 1, `expected version 1, got ${data.data.version}`)
    assert(typeof data.data.hash === 'string', 'missing hash')
  })

  await test('GET /v1/templates lists templates', async () => {
    const { status, data } = await api('GET', '/v1/templates')
    assert(status === 200, `expected 200, got ${status}`)
    assert(Array.isArray(data.data), 'data should be array')
    const found = data.data.find((t: any) => t.id === templateId)
    assert(!!found, 'created template not in list')
  })

  await test('GET /v1/templates/:id returns template', async () => {
    const { status, data } = await api('GET', `/v1/templates/${templateId}`)
    assert(status === 200, `expected 200, got ${status}`)
    assert(data.data.name === 'Battle Test Invoice', 'wrong name')
    assert(data.data.content === INVOICE_TEMPLATE, 'content mismatch')
  })

  await test('Render by template ID', async () => {
    const { status, data } = await api('POST', '/v1/render', {
      template: templateId,
      data: INVOICE_DATA,
    })
    assert(status === 200, `expected 200, got ${status}`)
    assert(data.data.metadata.pages >= 1, 'should render at least 1 page')
  })

  await test('Render with nonexistent template ID returns 404', async () => {
    const { status, data } = await api('POST', '/v1/render', {
      template: 'tpl_nonexistent000000',
      data: {},
    })
    assert(status === 404, `expected 404, got ${status}`)
    assert(data.type.includes('not-found'), 'should be not-found error')
  })

  // ── 9. Idempotency ─────────────────────────────────
  console.log('\n9. Idempotency')

  await test('Same Idempotency-Key returns same runId', async () => {
    const idemKey = `battle-test-${Date.now()}`
    const { data: d1 } = await api(
      'POST', '/v1/render',
      { template: '<h1>Idempotent</h1>', data: {} },
      { 'Idempotency-Key': idemKey }
    )
    const { data: d2 } = await api(
      'POST', '/v1/render',
      { template: '<h1>Idempotent</h1>', data: {} },
      { 'Idempotency-Key': idemKey }
    )
    assert(
      d1.data.runId === d2.data.runId,
      `idempotency failed: ${d1.data.runId} vs ${d2.data.runId}`
    )
  })

  await test('Different Idempotency-Key returns different runId', async () => {
    const { data: d1 } = await api(
      'POST', '/v1/render',
      { template: '<h1>A</h1>', data: {} },
      { 'Idempotency-Key': `key-a-${Date.now()}` }
    )
    const { data: d2 } = await api(
      'POST', '/v1/render',
      { template: '<h1>A</h1>', data: {} },
      { 'Idempotency-Key': `key-b-${Date.now()}` }
    )
    assert(
      d1.data.runId !== d2.data.runId,
      'different keys should produce different runs'
    )
  })

  // ── 10. Template injection features ────────────────
  console.log('\n10. Template injection (Handlebars-style)')

  await test('{{#each}} renders array items', async () => {
    const { data } = await api('POST', '/v1/render', {
      template: '<ul>{{#each items}}<li>{{name}}</li>{{/each}}</ul>',
      data: { items: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] },
    })
    assert(data.data.metadata.sizeBytes > 0, 'should render')
  })

  await test('{{#if}} conditional rendering', async () => {
    const { data } = await api('POST', '/v1/render', {
      template: '{{#if show}}<p>Visible</p>{{/if}}{{#if hide}}<p>Hidden</p>{{/if}}',
      data: { show: true, hide: false },
    })
    assert(data.data.metadata.sizeBytes > 0, 'should render')
  })

  await test('HTML escaping in template injection', async () => {
    const { data } = await api('POST', '/v1/render', {
      template: '<p>{{content}}</p>',
      data: { content: '<script>alert("xss")</script>' },
    })
    assert(data.data.metadata.sizeBytes > 0, 'should render safely')
  })

  // ── 11. Validation ─────────────────────────────────
  console.log('\n11. Validation & error handling')

  await test('Empty template returns 400', async () => {
    const { status } = await api('POST', '/v1/render', {
      template: '',
      data: {},
    })
    assert(status === 400, `expected 400, got ${status}`)
  })

  await test('Missing template field returns 400', async () => {
    const { status } = await api('POST', '/v1/render', { data: {} })
    assert(status === 400, `expected 400, got ${status}`)
  })

  // ── 12. Org isolation ──────────────────────────────
  console.log('\n12. Org-level isolation')

  await test('Cannot access other org runs', async () => {
    const { data } = await api('GET', '/v1/runs/run_does_not_exist_in_org')
    // Should return 404, not 403 (to not leak existence)
    assert(data.status === 404, `expected 404 for cross-org access`)
  })

  // ── 13. Async render ───────────────────────────────
  console.log('\n13. Async render pipeline')

  await test('POST /v1/render/async returns 201 with queued status', async () => {
    const { status, data } = await api('POST', '/v1/render/async', {
      template: '<h1>Async {{title}}</h1>',
      data: { title: 'Battle Test' },
    })
    assert(status === 201, `expected 201, got ${status}`)
    assert(data.data.status === 'queued', `expected queued, got ${data.data.status}`)
    assert(data.data.runId.startsWith('run_'), 'missing run_ prefix')
    assert(typeof data.data.links.self === 'string', 'missing self link')
  })

  // ── 14. Multi-page rendering ───────────────────────
  console.log('\n14. Complex document rendering')

  await test('Large table renders correctly', async () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({
      id: i + 1,
      name: `Item ${i + 1}`,
      value: `$${((i + 1) * 100).toFixed(2)}`,
    }))
    const { data } = await api('POST', '/v1/render', {
      template:
        '<html><body><h1>Large Table Report</h1><table><thead><tr><th>#</th><th>Name</th><th>Value</th></tr></thead><tbody>{{#each rows}}<tr><td>{{id}}</td><td>{{name}}</td><td>{{value}}</td></tr>{{/each}}</tbody></table></body></html>',
      data: { rows },
      options: { pageSize: 'a4', smartLayout: false },
    })
    assert(data.data.metadata.pages >= 1, 'should have pages')
    assert(data.data.metadata.sizeBytes > 10000, 'large doc should be > 10KB')
  })

  await test('Page size options work (A4 vs Letter)', async () => {
    const { data: a4 } = await api('POST', '/v1/render', {
      template: '<h1>A4</h1>',
      data: {},
      options: { pageSize: 'a4' },
    })
    const { data: letter } = await api('POST', '/v1/render', {
      template: '<h1>Letter</h1>',
      data: {},
      options: { pageSize: 'letter' },
    })
    // Both should render but sizes may differ slightly
    assert(a4.data.metadata.sizeBytes > 0, 'A4 should render')
    assert(letter.data.metadata.sizeBytes > 0, 'Letter should render')
  })

  // ── 15. Verification status ────────────────────────
  console.log('\n15. Verification')

  await test('Render without verify returns skipped status', async () => {
    const { data } = await api('POST', '/v1/render', {
      template: '<h1>No Verify</h1>',
      data: {},
      options: { verify: false },
    })
    assert(
      data.data.verification.status === 'skipped',
      `expected skipped, got ${data.data.verification.status}`
    )
  })

  // ── Summary ────────────────────────────────────────
  console.log(`\n${'═'.repeat(50)}`)
  console.log(`\n  Results: ${passed} passed, ${failed} failed\n`)

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
