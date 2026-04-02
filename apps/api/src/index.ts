import { Hono } from 'hono'
import { createDb } from '@typeset/db'
import { BrowserPool } from '@typeset/engine'
import { requestId } from './middleware/requestId'
import { version } from './middleware/version'
import { auth } from './middleware/auth'
import { rateLimit } from './middleware/rateLimit'
import { idempotency } from './middleware/idempotency'
import { createRedis } from './lib/redis'
import { createStorage, createLocalStorage } from './lib/storage'
import { problemDetails } from './lib/errors'
import { renderRoutes } from './routes/render'
import { asyncRenderRoutes } from './routes/async'
import { runRoutes } from './routes/runs'
import { extractRoutes } from './routes/extract'
import { templateRoutes } from './routes/templates'
import { templateFromDocRoutes } from './routes/templateFromDoc'

// ── Dependencies ───────────────────────────────────────

const db = createDb(Bun.env.DATABASE_URL!)

const redis = createRedis(
  Bun.env.UPSTASH_REDIS_REST_URL!,
  Bun.env.UPSTASH_REDIS_REST_TOKEN!
)

const isLocal = Bun.env.R2_ACCESS_KEY_ID === 'placeholder' || !Bun.env.R2_ACCESS_KEY_ID

const storage = isLocal
  ? createLocalStorage('.storage', `http://localhost:${Bun.env.PORT ?? '3000'}`)
  : createStorage({
      accountId: Bun.env.R2_ACCOUNT_ID!,
      accessKeyId: Bun.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: Bun.env.R2_SECRET_ACCESS_KEY!,
      bucket: Bun.env.R2_BUCKET_NAME ?? 'typeset-docs',
    })

const pool = new BrowserPool()

// ── App ────────────────────────────────────────────────

const app = new Hono()

// Global middleware
app.use('*', requestId)
app.use('*', version)
app.use('/v1/*', auth(db))
app.use('/v1/*', rateLimit(redis))
app.use('/v1/*', idempotency(redis))

// Routes
app.route('/v1', renderRoutes({ db, pool, storage }))
app.route('/v1', asyncRenderRoutes({ db }))
app.route('/v1', runRoutes({ db }))
app.route('/v1', extractRoutes({ db }))
app.route('/v1', templateRoutes({ db }))
app.route('/v1', templateFromDocRoutes({ db }))

// Local file serving (dev only)
if (isLocal) {
  app.get('/files/*', async (c) => {
    const key = c.req.path.replace('/files/', '')
    const path = require('node:path') as typeof import('node:path')
    const file = Bun.file(path.join('.storage', key))
    if (!(await file.exists())) {
      return c.json({ error: 'Not found' }, 404)
    }
    return new Response(file.stream(), {
      headers: { 'Content-Type': 'application/pdf' },
    })
  })
}

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }))

// Global error handler
app.onError((err, c) => {
  console.error(`[${c.get('requestId')}] Unhandled error:`, err)
  return problemDetails(c, 500, {
    type: 'https://typeset.dev/errors/internal',
    title: 'Internal server error',
    detail: 'An unexpected error occurred',
  })
})

// 404
app.notFound((c) =>
  problemDetails(c, 404, {
    type: 'https://typeset.dev/errors/not-found',
    title: 'Not found',
    detail: `${c.req.method} ${c.req.path} not found`,
  })
)

// ── Server ─────────────────────────────────────────────

const port = parseInt(Bun.env.PORT ?? '3000')
console.log(`Typeset API listening on :${port}`)

export default {
  port,
  fetch: app.fetch,
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down...')
  await pool.shutdown()
  process.exit(0)
})
