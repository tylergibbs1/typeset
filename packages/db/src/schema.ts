import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  numeric,
  uniqueIndex,
  index,
  jsonb,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ── Organizations ──────────────────────────────────────

export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const organizationsRelations = relations(organizations, ({ many }) => ({
  apiKeys: many(apiKeys),
  templates: many(templates),
  runs: many(runs),
}))

// ── API keys ───────────────────────────────────────────

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  keyHash: text('key_hash').notNull().unique(),
  keyPrefix: text('key_prefix').notNull(),
  orgId: uuid('org_id')
    .references(() => organizations.id)
    .notNull(),
  name: text('name'),
  scopes: text('scopes').array().notNull().default(['full']),
  tier: text('tier').$type<'free' | 'pro' | 'scale'>().notNull().default('free'),
  rateLimitRpm: integer('rate_limit_rpm').notNull().default(10),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
})

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  organization: one(organizations, {
    fields: [apiKeys.orgId],
    references: [organizations.id],
  }),
}))

// ── Templates ──────────────────────────────────────────

export const templates = pgTable('templates', {
  id: text('id').primaryKey(),
  orgId: uuid('org_id')
    .references(() => organizations.id)
    .notNull(),
  name: text('name').notNull(),
  content: text('content').notNull(),
  engine: text('engine').$type<'html' | 'typst'>().notNull().default('html'),
  contentHash: text('content_hash').notNull(),
  description: text('description'),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const templatesRelations = relations(templates, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [templates.orgId],
    references: [organizations.id],
  }),
  runs: many(runs),
}))

// ── Pipeline runs ──────────────────────────────────────

export const runs = pgTable(
  'runs',
  {
    id: text('id').primaryKey(),
    orgId: uuid('org_id')
      .references(() => organizations.id)
      .notNull(),
    apiKeyId: uuid('api_key_id')
      .references(() => apiKeys.id)
      .notNull(),
    status: text('status')
      .$type<'queued' | 'rendering' | 'verifying' | 'completed' | 'failed'>()
      .notNull()
      .default('queued'),
    templateId: text('template_id').references(() => templates.id),
    templateHash: text('template_hash').notNull(),
    dataHash: text('data_hash').notNull(),
    format: text('format').$type<'pdf' | 'docx' | 'html'>().notNull().default('pdf'),
    engine: text('engine').$type<'html' | 'typst'>().notNull().default('html'),
    options: jsonb('options'),
    storageKey: text('storage_key'),
    pages: integer('pages'),
    sizeBytes: integer('size_bytes'),
    renderTimeMs: integer('render_time_ms'),
    verificationStatus: text('verification_status').$type<'passed' | 'failed' | 'skipped'>(),
    verificationScore: numeric('verification_score', { precision: 3, scale: 2 }),
    verificationIssues: text('verification_issues').array(),
    errorType: text('error_type'),
    errorDetail: text('error_detail'),
    webhookUrl: text('webhook_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_runs_org_status').on(table.orgId, table.status),
    index('idx_runs_template').on(table.templateId),
    index('idx_runs_created').on(table.orgId, table.createdAt),
  ]
)

export const runsRelations = relations(runs, ({ one }) => ({
  organization: one(organizations, {
    fields: [runs.orgId],
    references: [organizations.id],
  }),
  apiKey: one(apiKeys, {
    fields: [runs.apiKeyId],
    references: [apiKeys.id],
  }),
  template: one(templates, {
    fields: [runs.templateId],
    references: [templates.id],
  }),
}))

// ── Usage tracking ─────────────────────────────────────

export const usage = pgTable(
  'usage',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .references(() => organizations.id)
      .notNull(),
    month: text('month').notNull(),
    renderCount: integer('render_count').notNull().default(0),
    extractCount: integer('extract_count').notNull().default(0),
    verifyCount: integer('verify_count').notNull().default(0),
  },
  (table) => [uniqueIndex('idx_usage_org_month').on(table.orgId, table.month)]
)
