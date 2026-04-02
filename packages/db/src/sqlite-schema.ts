import { sqliteTable, text, integer, uniqueIndex, index, real } from "drizzle-orm/sqlite-core";

// ── Organizations ──────────────────────────────────────

export const organizations = sqliteTable("organizations", {
	id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
	name: text("name").notNull(),
	createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// ── API keys ───────────────────────────────────────────

export const apiKeys = sqliteTable("api_keys", {
	id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
	keyHash: text("key_hash").notNull().unique(),
	keyPrefix: text("key_prefix").notNull(),
	orgId: text("org_id").notNull().references(() => organizations.id),
	name: text("name"),
	scopes: text("scopes").notNull().default("full"), // comma-separated
	tier: text("tier").notNull().default("free"),
	rateLimitRpm: integer("rate_limit_rpm").notNull().default(10),
	createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
	revokedAt: text("revoked_at"),
});

// ── Templates ──────────────────────────────────────────

export const templates = sqliteTable("templates", {
	id: text("id").primaryKey(),
	orgId: text("org_id").notNull().references(() => organizations.id),
	name: text("name").notNull(),
	content: text("content").notNull(),
	engine: text("engine").notNull().default("html"),
	contentHash: text("content_hash").notNull(),
	description: text("description"),
	version: integer("version").notNull().default(1),
	createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
	updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// ── Pipeline runs ──────────────────────────────────────

export const runs = sqliteTable(
	"runs",
	{
		id: text("id").primaryKey(),
		orgId: text("org_id").notNull().references(() => organizations.id),
		apiKeyId: text("api_key_id").notNull().references(() => apiKeys.id),
		status: text("status").notNull().default("queued"),
		templateId: text("template_id").references(() => templates.id),
		templateHash: text("template_hash").notNull(),
		dataHash: text("data_hash").notNull(),
		format: text("format").notNull().default("pdf"),
		engine: text("engine").notNull().default("html"),
		options: text("options"), // JSON string
		storageKey: text("storage_key"),
		pages: integer("pages"),
		sizeBytes: integer("size_bytes"),
		renderTimeMs: integer("render_time_ms"),
		verificationStatus: text("verification_status"),
		verificationScore: real("verification_score"),
		verificationIssues: text("verification_issues"), // JSON array string
		errorType: text("error_type"),
		errorDetail: text("error_detail"),
		webhookUrl: text("webhook_url"),
		createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
		completedAt: text("completed_at"),
	},
	(table) => [
		index("idx_runs_org_status").on(table.orgId, table.status),
		index("idx_runs_template").on(table.templateId),
		index("idx_runs_created").on(table.orgId, table.createdAt),
	],
);

// ── Usage tracking ─────────────────────────────────────

export const usage = sqliteTable(
	"usage",
	{
		id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
		orgId: text("org_id").notNull().references(() => organizations.id),
		month: text("month").notNull(),
		renderCount: integer("render_count").notNull().default(0),
		extractCount: integer("extract_count").notNull().default(0),
		verifyCount: integer("verify_count").notNull().default(0),
	},
	(table) => [uniqueIndex("idx_usage_org_month").on(table.orgId, table.month)],
);
