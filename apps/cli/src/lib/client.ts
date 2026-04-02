import { TypesetClient } from '@typeset/sdk'

export function getClient(): TypesetClient {
  const apiKey = process.env.TYPESET_API_KEY
  if (!apiKey) {
    console.error('Error: TYPESET_API_KEY environment variable is required')
    console.error('Set it with: export TYPESET_API_KEY=ts_live_...')
    process.exit(1)
  }

  const baseUrl = process.env.TYPESET_API_URL ?? 'https://api.typeset.dev'

  return new TypesetClient({ apiKey, baseUrl })
}
