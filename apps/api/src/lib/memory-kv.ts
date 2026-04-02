import type { Redis } from "./redis";

/**
 * In-memory key-value store that implements the Redis interface.
 * Used for local development without Upstash.
 */
export function createMemoryKV(): Redis {
	const store = new Map<string, { value: string; expiresAt?: number }>();

	function cleanup(key: string) {
		const entry = store.get(key);
		if (entry?.expiresAt && Date.now() > entry.expiresAt) {
			store.delete(key);
			return true;
		}
		return false;
	}

	return {
		async get(key) {
			if (cleanup(key)) return null;
			return store.get(key)?.value ?? null;
		},
		async set(key, value, opts) {
			store.set(key, {
				value,
				expiresAt: opts?.ex ? Date.now() + opts.ex * 1000 : undefined,
			});
		},
		async incr(key) {
			if (cleanup(key)) {
				store.set(key, { value: "1" });
				return 1;
			}
			const entry = store.get(key);
			const next = (parseInt(entry?.value ?? "0", 10) + 1).toString();
			store.set(key, { value: next, expiresAt: entry?.expiresAt });
			return parseInt(next, 10);
		},
		async expire(key, seconds) {
			const entry = store.get(key);
			if (entry) {
				entry.expiresAt = Date.now() + seconds * 1000;
			}
		},
		async del(key) {
			store.delete(key);
		},
	};
}
