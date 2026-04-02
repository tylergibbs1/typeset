import { task, logger } from "@trigger.dev/sdk"
import { createDb, eq } from "@typeset/db"
import { runs } from "@typeset/db/schema"

interface WebhookPayload {
  runId: string
  url: string
  secret?: string
  headers?: Record<string, string>
}

export const deliverWebhookTask = task({
  id: "webhook-deliver",
  retry: {
    maxAttempts: 5,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 60000,
    factor: 2,
  },
  run: async (payload: WebhookPayload) => {
    const db = createDb(process.env.DATABASE_URL!)

    // Fetch the completed run
    const [run] = await db
      .select()
      .from(runs)
      .where(eq(runs.id, payload.runId))
      .limit(1)

    if (!run) {
      logger.error("Run not found for webhook", { runId: payload.runId })
      return
    }

    const body = JSON.stringify({
      event: "run.completed",
      data: run,
    })

    const timestamp = Math.floor(Date.now() / 1000)

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Typeset-Run-Id": payload.runId,
      "X-Typeset-Timestamp": String(timestamp),
      ...(payload.headers ?? {}),
    }

    // Sign the webhook if a secret is provided
    if (payload.secret) {
      const message = `${timestamp}.${body}`
      const enc = new TextEncoder()
      const key = await crypto.subtle.importKey(
        "raw",
        enc.encode(payload.secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      )
      const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message))
      const hex = Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
      headers["X-Typeset-Signature"] = `sha256=${hex}`
    }

    logger.info("Delivering webhook", { runId: payload.runId, url: payload.url })

    const res = await fetch(payload.url, {
      method: "POST",
      headers,
      body,
    })

    if (!res.ok) {
      const text = await res.text()
      logger.error("Webhook delivery failed", {
        runId: payload.runId,
        status: res.status,
        body: text.slice(0, 500),
      })
      throw new Error(`Webhook delivery failed: ${res.status} ${text.slice(0, 200)}`)
    }

    logger.info("Webhook delivered", { runId: payload.runId, status: res.status })
    return { status: res.status }
  },
})
