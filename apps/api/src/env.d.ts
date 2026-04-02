import type { Database } from '@typeset/db'

type ApiKeyRecord = {
  id: string
  keyHash: string
  keyPrefix: string
  orgId: string
  name: string | null
  scopes: string[]
  tier: 'free' | 'pro' | 'scale'
  rateLimitRpm: number
  createdAt: Date
  revokedAt: Date | null
}

declare module 'hono' {
  interface ContextVariableMap {
    apiKey: ApiKeyRecord
    apiKeyId: string
    orgId: string
    requestId: string
    runId: string
  }
}
