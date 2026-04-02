import { Command } from 'commander'
import { getClient } from '../lib/client'

export const extractCommand = new Command('extract')
  .description('Extract structured data from a document')
  .argument('<document>', 'Path to document file or URL')
  .option('--schema <path>', 'Path to JSON schema file')
  .option('--table-format <format>', 'Table format (markdown, html)', 'html')
  .option('--json', 'Output raw JSON')
  .action(async (documentPath: string, opts) => {
    try {
      const client = getClient()

      let document: { type: 'url' | 'base64'; url?: string; data?: string; mimeType?: string }
      if (documentPath.startsWith('http://') || documentPath.startsWith('https://')) {
        document = { type: 'url', url: documentPath }
      } else {
        const file = Bun.file(documentPath)
        const buffer = new Uint8Array(await file.arrayBuffer())
        const base64 = Buffer.from(buffer).toString('base64')
        document = { type: 'base64', data: base64, mimeType: file.type }
      }

      const schema = opts.schema ? JSON.parse(await Bun.file(opts.schema).text()) : undefined

      console.log('Extracting...')
      const result = await client.extract({
        document,
        schema,
        options: { tableFormat: opts.tableFormat },
      })

      if (opts.json) {
        console.log(JSON.stringify(result.data, null, 2))
      } else {
        for (const page of result.data.pages) {
          console.log(`\n--- Page ${page.index + 1} ---\n`)
          console.log(page.markdown)
        }
        if (result.data.annotation) {
          console.log('\n--- Extracted Fields ---\n')
          console.log(JSON.stringify(result.data.annotation, null, 2))
        }
      }
    } catch (err) {
      console.error('Extraction failed:', err instanceof Error ? err.message : err)
      process.exit(1)
    }
  })
