import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

export function createDb(url: string) {
  const client = postgres(url, { prepare: false })
  return drizzle({ client, schema })
}

export type Database = ReturnType<typeof createDb>

export * from './schema'
export { sql, eq, and, or, desc, asc, gt, gte, lt, lte, ne, inArray, isNull, isNotNull } from 'drizzle-orm'
