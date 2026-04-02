import { Command } from 'commander'
import { getClient } from '../lib/client'

export const renderCommand = new Command('render')
  .description('Render a document from template + data')
  .argument('<template>', 'Path to HTML template file or template ID (tpl_...)')
  .argument('[data]', 'Path to JSON data file')
  .option('-o, --output <path>', 'Output file path', 'output.pdf')
  .option('-f, --format <format>', 'Output format (pdf, docx, html)', 'pdf')
  .option('--page-size <size>', 'Page size (a4, letter, legal)', 'a4')
  .option('--orientation <orientation>', 'Orientation (portrait, landscape)', 'portrait')
  .option('--remote', 'Render via the Typeset API instead of locally')
  .option('--api-key <key>', 'API key (overrides TYPESET_API_KEY)')
  .option('--verify', 'Run verification after rendering')
  .action(async (templatePath: string, dataPath: string | undefined, opts) => {
    try {
      if (opts.remote || templatePath.startsWith('tpl_')) {
        // Remote render via API
        const client = getClient()

        const template = templatePath.startsWith('tpl_')
          ? templatePath
          : await Bun.file(templatePath).text()

        const data = dataPath ? JSON.parse(await Bun.file(dataPath).text()) : {}

        console.log('Rendering via API...')
        const result = await client.render({
          template,
          data,
          format: opts.format,
          options: {
            pageSize: opts.pageSize,
            orientation: opts.orientation,
            verify: opts.verify,
          },
        })

        // Download the rendered document
        const res = await fetch(result.data.url)
        const buffer = new Uint8Array(await res.arrayBuffer())
        await Bun.write(opts.output, buffer)

        console.log(`Rendered ${result.data.metadata.pages} pages in ${result.data.metadata.renderTimeMs}ms`)
        console.log(`Output: ${opts.output}`)
        console.log(`Run: ${result.data.runId}`)
      } else {
        // Local render
        const { BrowserPool, renderHtml, injectData } = await import('@typeset/engine')

        const template = await Bun.file(templatePath).text()
        const data = dataPath ? JSON.parse(await Bun.file(dataPath).text()) : {}

        const html = injectData(template, data)
        const pool = new BrowserPool({ maxBrowsers: 1 })

        console.log('Rendering locally...')
        const { page, context } = await pool.getPage()

        try {
          const result = await renderHtml(page, html, {
            pageSize: opts.pageSize,
            orientation: opts.orientation,
            margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
          })

          await Bun.write(opts.output, result.buffer)
          console.log(`Rendered ${result.pages} pages in ${result.renderTimeMs}ms`)
          console.log(`Output: ${opts.output}`)
        } finally {
          await pool.releasePage(page, context)
          await pool.shutdown()
        }
      }
    } catch (err) {
      console.error('Render failed:', err instanceof Error ? err.message : err)
      process.exit(1)
    }
  })
