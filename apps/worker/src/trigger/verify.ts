import { task, logger } from "@trigger.dev/sdk"
import { createDb, eq } from "@typeset/db"
import { runs } from "@typeset/db/schema"

interface VerifyPayload {
  runId: string
  storageKey: string
  inputData: Record<string, unknown>
  pdfBuffer: string // base64
}

export const verifyRenderTask = task({
  id: "document-verify",
  queue: { concurrencyLimit: 5 },
  run: async (payload: VerifyPayload) => {
    const db = createDb(process.env.DATABASE_URL!)

    logger.info("Starting verification", { runId: payload.runId })

    try {
      const { Mistral } = await import("@mistralai/mistralai")
      const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY! })

      const documentUrl = `data:application/pdf;base64,${payload.pdfBuffer}`

      const ocrResult = await mistral.ocr.process({
        model: "mistral-ocr-latest",
        document: { type: "document_url", documentUrl },
        tableFormat: "html",
      })

      const renderedText = ocrResult.pages.map((p: any) => p.markdown).join("\n")
      const issues: string[] = []

      for (const [key, value] of Object.entries(payload.inputData)) {
        if (typeof value === "string" && !renderedText.includes(value)) {
          issues.push(`Missing field "${key}": expected "${value}"`)
        }
        if (typeof value === "number" && !renderedText.includes(String(value))) {
          issues.push(`Missing field "${key}": expected ${value}`)
        }
      }

      const score = 1 - issues.length / Math.max(Object.keys(payload.inputData).length, 1)
      const status = issues.length === 0 ? "passed" : "failed"

      logger.info("Verification complete", {
        runId: payload.runId,
        status,
        score,
        issueCount: issues.length,
      })

      await db
        .update(runs)
        .set({
          status: "completed",
          verificationStatus: status,
          verificationScore: String(Math.max(0, score)),
          verificationIssues: issues,
          completedAt: new Date(),
        })
        .where(eq(runs.id, payload.runId))

      return { status, score, issues }
    } catch (err) {
      logger.error("Verification failed", { runId: payload.runId, error: String(err) })

      // Still mark as completed but verification failed
      await db
        .update(runs)
        .set({
          status: "completed",
          verificationStatus: "failed",
          verificationScore: "0",
          verificationIssues: [err instanceof Error ? err.message : String(err)],
          completedAt: new Date(),
        })
        .where(eq(runs.id, payload.runId))

      throw err
    }
  },
})
