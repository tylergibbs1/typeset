/**
 * Seeds a test organization and API key for local development.
 * Run: bun run scripts/seed.ts
 */
import { createDb } from '../packages/db/src/index'
import { organizations, apiKeys } from '../packages/db/src/schema'

const db = createDb(Bun.env.DATABASE_URL ?? 'postgresql://typeset:typeset@localhost:5432/typeset')

// The raw API key — you'll use this in requests
const RAW_KEY = 'ts_test_full_localdev0000000000000000'

// Hash it the same way the auth middleware does
const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(RAW_KEY))
const keyHash = Array.from(new Uint8Array(hash))
  .map((b) => b.toString(16).padStart(2, '0'))
  .join('')

// Create org
const [org] = await db
  .insert(organizations)
  .values({ name: 'Local Dev' })
  .onConflictDoNothing()
  .returning()

const orgId = org?.id
if (!orgId) {
  console.log('Org already exists, fetching...')
  const [existing] = await db.select().from(organizations).limit(1)
  if (!existing) throw new Error('No org found')
  var finalOrgId = existing.id
} else {
  var finalOrgId = orgId
}

// Create API key
await db
  .insert(apiKeys)
  .values({
    keyHash,
    keyPrefix: 'ts_test_',
    orgId: finalOrgId,
    name: 'Local Dev Key',
    scopes: ['full'],
    tier: 'scale',
    rateLimitRpm: 300,
  })
  .onConflictDoNothing()

console.log('Seeded successfully!')
console.log(`Organization: ${finalOrgId}`)
console.log(`API Key: ${RAW_KEY}`)
console.log(`Key Hash: ${keyHash}`)
console.log('\nUse this in requests:')
console.log(`  curl -H "Authorization: Bearer ${RAW_KEY}" http://localhost:3000/v1/runs`)

process.exit(0)
