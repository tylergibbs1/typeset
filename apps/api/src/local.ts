import { Hono } from "hono";
import { createLocalDb } from "@typeset/db/sqlite";
import { BrowserPool } from "@typeset/engine";
import { requestId } from "./middleware/requestId";
import { version } from "./middleware/version";
import { auth } from "./middleware/auth";
import { rateLimit } from "./middleware/rateLimit";
import { idempotency } from "./middleware/idempotency";
import { createMemoryKV } from "./lib/memory-kv";
import { createLocalStorage } from "./lib/storage";
import { problemDetails } from "./lib/errors";
import { renderRoutes } from "./routes/render";
import { asyncRenderRoutes } from "./routes/async";
import { runRoutes } from "./routes/runs";
import { extractRoutes } from "./routes/extract";
import { templateRoutes } from "./routes/templates";
import { templateFromDocRoutes } from "./routes/templateFromDoc";
import { seedLocal } from "./seed-local";

// ── Dependencies (all local) ─────────────────────────────

const db = createLocalDb("typeset.db");
const redis = createMemoryKV();
const port = parseInt(Bun.env.PORT ?? "3000");
const storage = createLocalStorage(".storage", `http://localhost:${port}`);
const pool = new BrowserPool();

// Seed a default org + API key on first run
seedLocal(db);

// ── App ──────────────────────────────────────────────────

const app = new Hono();

// Global middleware
app.use("*", requestId);
app.use("*", version);
app.use("/v1/*", auth(db as any));
app.use("/v1/*", rateLimit(redis));
app.use("/v1/*", idempotency(redis));

// Routes
app.route("/v1", renderRoutes({ db: db as any, pool, storage }));
app.route("/v1", asyncRenderRoutes({ db: db as any }));
app.route("/v1", runRoutes({ db: db as any }));
app.route("/v1", extractRoutes({ db: db as any }));
app.route("/v1", templateRoutes({ db: db as any }));
app.route("/v1", templateFromDocRoutes({ db: db as any }));

// Local file serving
app.get("/files/*", async (c) => {
	const key = c.req.path.replace("/files/", "");
	const path = require("node:path") as typeof import("node:path");
	const file = Bun.file(path.join(".storage", key));
	if (!(await file.exists())) {
		return c.json({ error: "Not found" }, 404);
	}
	return new Response(file.stream(), {
		headers: { "Content-Type": "application/pdf" },
	});
});

// Health check
app.get("/health", (c) => c.json({ status: "ok", mode: "local", db: "sqlite" }));

// Global error handler
app.onError((err, c) => {
	console.error(`[${c.get("requestId")}] Unhandled error:`, err);
	return problemDetails(c, 500, {
		type: "https://typeset.dev/errors/internal",
		title: "Internal server error",
		detail: "An unexpected error occurred",
	});
});

app.notFound((c) =>
	problemDetails(c, 404, {
		type: "https://typeset.dev/errors/not-found",
		title: "Not found",
		detail: `${c.req.method} ${c.req.path} not found`,
	}),
);

// ── Server ───────────────────────────────────────────────

console.log(`Typeset API (local mode) listening on :${port}`);
console.log(`  Database: typeset.db (SQLite)`);
console.log(`  Storage:  .storage/ (local filesystem)`);
console.log(`  Redis:    in-memory`);
console.log(`  API key:  ts_test_full_localdev0000000000000000`);

export default {
	port,
	fetch: app.fetch,
};

process.on("SIGTERM", async () => {
	console.log("Shutting down...");
	await pool.shutdown();
	process.exit(0);
});
