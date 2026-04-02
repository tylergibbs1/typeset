import { eq } from "drizzle-orm";
import { organizations, apiKeys } from "@typeset/db/sqlite-schema";
import { sha256 } from "./lib/hash";
import type { LocalDatabase } from "@typeset/db/sqlite";

const TEST_KEY = "ts_test_full_localdev0000000000000000";

export async function seedLocal(db: LocalDatabase) {
	// Check if already seeded
	const existing = await db.select().from(organizations).limit(1);
	if (existing.length > 0) return;

	const orgId = crypto.randomUUID();
	const keyHash = await sha256(TEST_KEY);

	db.insert(organizations).values({
		id: orgId,
		name: "Local Development",
	}).run();

	db.insert(apiKeys).values({
		id: crypto.randomUUID(),
		keyHash,
		keyPrefix: "ts_test_full_",
		orgId,
		name: "Local Dev Key",
		scopes: "full",
		tier: "free",
		rateLimitRpm: 1000,
	}).run();

	console.log("  Seeded local org + API key");
}
