import { Command } from 'commander'

export const devCommand = new Command('dev')
  .description('Start a local dev server with hot reload')
  .option('-p, --port <port>', 'Port number', '3333')
  .option('-t, --template <path>', 'Path to HTML template file')
  .option('-d, --data <path>', 'Path to JSON data file')
  .action(async (opts) => {
    const port = parseInt(opts.port)

    console.log(`Starting Typeset dev server on http://localhost:${port}`)
    console.log('Press Ctrl+C to stop\n')

    const server = Bun.serve({
      port,
      async fetch(req) {
        const url = new URL(req.url)

        if (url.pathname === '/') {
          // Serve a simple preview page
          const html = `<!DOCTYPE html>
<html>
<head>
  <title>Typeset Dev Server</title>
  <style>
    body { font-family: system-ui; max-width: 800px; margin: 40px auto; padding: 0 20px; }
    h1 { color: #1a1a1a; }
    .info { color: #666; }
    pre { background: #f5f5f5; padding: 16px; border-radius: 8px; overflow-x: auto; }
  </style>
</head>
<body>
  <h1>Typeset Dev Server</h1>
  <p class="info">Local rendering engine running on port ${port}</p>
  <h2>Endpoints</h2>
  <pre>
POST /render  — Render HTML template to PDF
  Body: { "template": "...", "data": {...} }

GET  /health  — Health check
  </pre>
</body>
</html>`
          return new Response(html, { headers: { 'Content-Type': 'text/html' } })
        }

        if (url.pathname === '/health') {
          return Response.json({ status: 'ok' })
        }

        if (url.pathname === '/render' && req.method === 'POST') {
          try {
            const { BrowserPool, renderHtml, injectData } = await import('@typeset/engine')
            const body = (await req.json()) as { template: string; data: Record<string, unknown> }

            const html = injectData(body.template, body.data ?? {})
            const pool = new BrowserPool({ maxBrowsers: 1 })
            const { page, context } = await pool.getPage()

            try {
              const result = await renderHtml(page, html, {
                pageSize: 'a4',
                orientation: 'portrait',
                margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
              })

              return new Response(result.buffer as BodyInit, {
                headers: {
                  'Content-Type': 'application/pdf',
                  'Content-Disposition': 'inline; filename="output.pdf"',
                  'X-Render-Pages': String(result.pages),
                  'X-Render-Time-Ms': String(result.renderTimeMs),
                },
              })
            } finally {
              await pool.releasePage(page, context)
              await pool.shutdown()
            }
          } catch (err) {
            return Response.json(
              { error: err instanceof Error ? err.message : 'Render failed' },
              { status: 500 }
            )
          }
        }

        return Response.json({ error: 'Not found' }, { status: 404 })
      },
    })

    console.log(`Dev server ready at http://localhost:${port}`)
  })
