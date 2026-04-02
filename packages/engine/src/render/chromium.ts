import type { Page } from 'playwright'
import type { RenderOptions, RenderResult } from '../types'
import { PAGE_DIMENSIONS } from '../types'
import { applySandbox } from './sandbox'
import { printCss } from './css'

export async function renderHtml(
  page: Page,
  html: string,
  options: RenderOptions
): Promise<RenderResult> {
  const start = performance.now()
  const dimensions = PAGE_DIMENSIONS[options.pageSize]

  const sandboxedHtml = applySandbox(html)
  const styledHtml = injectPrintStyles(sandboxedHtml, options)

  await page.setContent(styledHtml, { waitUntil: 'networkidle' })

  const buffer = await page.pdf({
    width: dimensions.width,
    height: dimensions.height,
    margin: {
      top: options.margin.top,
      right: options.margin.right,
      bottom: options.margin.bottom,
      left: options.margin.left,
    },
    printBackground: true,
    landscape: options.orientation === 'landscape',
  })

  const renderTimeMs = Math.round(performance.now() - start)

  // Count pages by parsing the PDF (simplified: count /Type /Page occurrences)
  const pdfText = new TextDecoder('latin1').decode(buffer)
  const pageMatches = pdfText.match(/\/Type\s*\/Page[^s]/g)
  const pages = pageMatches ? pageMatches.length : 1

  return {
    buffer: new Uint8Array(buffer),
    pages,
    renderTimeMs,
  }
}

function injectPrintStyles(html: string, options: RenderOptions): string {
  const css = printCss(options)
  const styleTag = `<style>${css}</style>`

  if (html.includes('</head>')) {
    return html.replace('</head>', `${styleTag}</head>`)
  }
  return html.replace('</head>', `${styleTag}</head>`)
}
