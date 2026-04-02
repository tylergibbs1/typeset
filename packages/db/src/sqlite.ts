import { Database as BunSQLite } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./sqlite-schema";

export function createLocalDb(path = "typeset.db") {
	const sqlite = new BunSQLite(path);
	sqlite.exec("PRAGMA journal_mode = WAL");
	sqlite.exec("PRAGMA foreign_keys = ON");

	const db = drizzle(sqlite, { schema });

	// Auto-create tables if they don't exist
	sqlite.exec(`
		CREATE TABLE IF NOT EXISTS organizations (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			created_at TEXT NOT NULL
		);

		CREATE TABLE IF NOT EXISTS api_keys (
			id TEXT PRIMARY KEY,
			key_hash TEXT NOT NULL UNIQUE,
			key_prefix TEXT NOT NULL,
			org_id TEXT NOT NULL REFERENCES organizations(id),
			name TEXT,
			scopes TEXT NOT NULL DEFAULT 'full',
			tier TEXT NOT NULL DEFAULT 'free',
			rate_limit_rpm INTEGER NOT NULL DEFAULT 10,
			created_at TEXT NOT NULL,
			revoked_at TEXT
		);

		CREATE TABLE IF NOT EXISTS templates (
			id TEXT PRIMARY KEY,
			org_id TEXT NOT NULL REFERENCES organizations(id),
			name TEXT NOT NULL,
			content TEXT NOT NULL,
			engine TEXT NOT NULL DEFAULT 'html',
			content_hash TEXT NOT NULL,
			description TEXT,
			version INTEGER NOT NULL DEFAULT 1,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		);

		CREATE TABLE IF NOT EXISTS runs (
			id TEXT PRIMARY KEY,
			org_id TEXT NOT NULL REFERENCES organizations(id),
			api_key_id TEXT NOT NULL REFERENCES api_keys(id),
			status TEXT NOT NULL DEFAULT 'queued',
			template_id TEXT REFERENCES templates(id),
			template_hash TEXT NOT NULL,
			data_hash TEXT NOT NULL,
			format TEXT NOT NULL DEFAULT 'pdf',
			engine TEXT NOT NULL DEFAULT 'html',
			options TEXT,
			storage_key TEXT,
			pages INTEGER,
			size_bytes INTEGER,
			render_time_ms INTEGER,
			verification_status TEXT,
			verification_score REAL,
			verification_issues TEXT,
			error_type TEXT,
			error_detail TEXT,
			webhook_url TEXT,
			created_at TEXT NOT NULL,
			completed_at TEXT
		);

		CREATE INDEX IF NOT EXISTS idx_runs_org_status ON runs(org_id, status);
		CREATE INDEX IF NOT EXISTS idx_runs_template ON runs(template_id);
		CREATE INDEX IF NOT EXISTS idx_runs_created ON runs(org_id, created_at);

		CREATE TABLE IF NOT EXISTS usage (
			id TEXT PRIMARY KEY,
			org_id TEXT NOT NULL REFERENCES organizations(id),
			month TEXT NOT NULL,
			render_count INTEGER NOT NULL DEFAULT 0,
			extract_count INTEGER NOT NULL DEFAULT 0,
			verify_count INTEGER NOT NULL DEFAULT 0
		);

		CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_org_month ON usage(org_id, month);
	`);

	return db;
}

export type LocalDatabase = ReturnType<typeof createLocalDb>;

export * from "./sqlite-schema";
export { sql, eq, and, or, desc, asc, gt, gte, lt, lte, ne, inArray, isNull, isNotNull } from "drizzle-orm";
