import { describe, test, expect } from 'bun:test'
import { renderTypst } from '../render/typst'
import { detectEngine } from '../render/dispatch'
import type { RenderOptions } from '../types'

const defaultOptions: RenderOptions = {
  pageSize: 'a4',
  orientation: 'portrait',
  margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
}

describe('detectEngine', () => {
  test('detects Typst from #set directive', () => {
    expect(detectEngine('#set page(paper: "a4")\nHello')).toBe('typst')
  })

  test('detects Typst from #let directive', () => {
    expect(detectEngine('#let data = json("data.json")\n#data.name')).toBe('typst')
  })

  test('detects Typst from #import directive', () => {
    expect(detectEngine('#import "template.typ": *')).toBe('typst')
  })

  test('detects Typst from #show directive', () => {
    expect(detectEngine('#show heading: set text(blue)')).toBe('typst')
  })

  test('detects Typst from #table directive', () => {
    expect(detectEngine('#table(columns: 3)[A][B][C]')).toBe('typst')
  })

  test('detects HTML from standard markup', () => {
    expect(detectEngine('<html><body><h1>Hello</h1></body></html>')).toBe('html')
  })

  test('detects HTML from simple content', () => {
    expect(detectEngine('<p>Hello {{name}}</p>')).toBe('html')
  })

  test('detects HTML from empty string', () => {
    expect(detectEngine('')).toBe('html')
  })

  test('does not false-positive on # in HTML', () => {
    expect(detectEngine('<h1>Section #1</h1>')).toBe('html')
  })

  test('does not false-positive on CSS color #set', () => {
    expect(detectEngine('<style>body { color: #333; }</style>')).toBe('html')
  })
})

describe('renderTypst', () => {
  test('renders simple Typst template to PDF', async () => {
    const result = await renderTypst(
      'Hello, World!',
      {},
      defaultOptions
    )
    expect(result.buffer).toBeInstanceOf(Uint8Array)
    expect(result.buffer.length).toBeGreaterThan(100)
    expect(result.pages).toBe(1)
    expect(result.renderTimeMs).toBeGreaterThanOrEqual(0)

    // Verify PDF header
    const header = new TextDecoder('latin1').decode(result.buffer.slice(0, 5))
    expect(header).toBe('%PDF-')
  })

  test('renders template with JSON data', async () => {
    const template = `#let data = json("data.json")
#data.name is #data.age years old.`
    const data = { name: 'Alice', age: 30 }
    const result = await renderTypst(template, data, defaultOptions)
    expect(result.pages).toBe(1)
    expect(result.buffer.length).toBeGreaterThan(100)
  })

  test('renders table from data', async () => {
    const template = `#let data = json("data.json")
#table(
  columns: (1fr, auto),
  table.header[*Name*][*Price*],
  ..for item in data.items {
    (item.name, item.price)
  },
)`
    const data = {
      items: [
        { name: 'Widget', price: '$10' },
        { name: 'Gadget', price: '$25' },
        { name: 'Doohickey', price: '$5' },
      ],
    }
    const result = await renderTypst(template, data, defaultOptions)
    expect(result.pages).toBeGreaterThanOrEqual(1)
  })

  test('large table produces multiple pages', async () => {
    const items = Array.from({ length: 100 }, (_, i) => ({
      id: String(i + 1),
      name: `Item ${i + 1}`,
      value: `$${(i * 10).toFixed(2)}`,
    }))
    const template = `#let data = json("data.json")
#set page(paper: "a4")
#table(
  columns: (auto, 1fr, auto),
  table.header[*ID*][*Name*][*Value*],
  ..for item in data.items {
    (item.id, item.name, item.value)
  },
)`
    const result = await renderTypst(template, { items }, defaultOptions)
    expect(result.pages).toBeGreaterThan(1)
  })

  test('invalid Typst template throws error', async () => {
    expect(
      renderTypst('#invalid-syntax{{{', {}, defaultOptions)
    ).rejects.toThrow()
  })

  test('renders faster than 2 seconds', async () => {
    const start = performance.now()
    await renderTypst('Hello, performance test!', {}, defaultOptions)
    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(2000)
  })

  test('produces smaller PDFs than HTML renderer would', async () => {
    const result = await renderTypst(
      '#set text(size: 12pt)\nThis is a simple document for size comparison.',
      {},
      defaultOptions
    )
    // Typst PDFs are typically much smaller than Playwright-rendered ones
    expect(result.buffer.length).toBeLessThan(50000)
  })

  test('deterministic output — same input produces same size', async () => {
    const template = '#let data = json("data.json")\n*Invoice:* #data.id'
    const data = { id: 'DET-001' }
    const r1 = await renderTypst(template, data, defaultOptions)
    const r2 = await renderTypst(template, data, defaultOptions)
    expect(r1.pages).toBe(r2.pages)
    expect(r1.buffer.length).toBe(r2.buffer.length)
  })
})
