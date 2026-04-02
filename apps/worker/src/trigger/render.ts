import { task, logger } from "@trigger.dev/sdk"
import { createDb, eq } from "@typeset/db"
import { runs } from "@typeset/db/schema"
import { injectData, renderHtml } from "@typeset/engine"
import type { RenderOptions } from "@typeset/engine"
import { getBrowser } from "./browser"
import { verifyRenderTask } from "./verify"
import { deliverWebhookTask } from "./webhook"
import { uploadToStorage, getSignedUrl } from "../lib/storage"

interface RenderPayload {
  runId: string
  orgId: string
  template: string
  data: Record<string, unknown>
  format: "pdf" | "docx" | "html"
  options: {
    pageSize: "a4" | "letter" | "legal"
    orientation: "portrait" | "landscape"
    margin: { top: string; right: string; bottom: string; left: string }
    locale?: string
    smartLayout?: boolean
    verify?: boolean
  }
  webhookUrl?: string
  webhookSecret?: string
  webhookHeaders?: Record<string, string>
}

export const renderTask = task({
  id: "document-render",
  queue: { concurrencyLimit: 10 },
  run: async (payload: RenderPayload) => {
    const db = createDb(process.env.DATABASE_URL!)

    // Update status to rendering
    await db
      .update(runs)
      .set({ status: "rendering" })
      .where(eq(runs.id, payload.runId))

    logger.info("Starting render", { runId: payload.runId })

    try {
      // Inject data into template
      const html = injectData(payload.template, payload.data)

      // Get browser from middleware
      const browser = getBrowser()
      const context = await browser.newContext()
      const page = await context.newPage()

      const renderOptions: RenderOptions = {
        pageSize: payload.options.pageSize,
        orientation: payload.options.orientation,
        margin: payload.options.margin,
        locale: payload.options.locale,
        smartLayout: payload.options.smartLayout,
      }

      let result
      try {
        result = await renderHtml(page, html, renderOptions)
      } finally {
        await page.close()
        await context.close()
      }

      logger.info("Render complete", {
        runId: payload.runId,
        pages: result.pages,
        renderTimeMs: result.renderTimeMs,
      })

      // Upload to R2
      const storageKey = `${payload.orgId}/${payload.runId}.${payload.format}`
      await uploadToStorage(storageKey, result.buffer, "application/pdf")
      const url = await getSignedUrl(storageKey)

      // Update run with render results
      await db
        .update(runs)
        .set({
          status: payload.options.verify ? "verifying" : "completed",
          storageKey,
          pages: result.pages,
          sizeBytes: result.buffer.length,
          renderTimeMs: result.renderTimeMs,
          verificationStatus: payload.options.verify ? undefined : "skipped",
          completedAt: payload.options.verify ? undefined : new Date(),
        })
        .where(eq(runs.id, payload.runId))

      // Chain verification if requested
      if (payload.options.verify) {
        await verifyRenderTask.trigger({
          runId: payload.runId,
          storageKey,
          inputData: payload.data,
          pdfBuffer: Buffer.from(result.buffer).toString("base64"),
        })
      }

      // Deliver webhook if configured
      if (payload.webhookUrl) {
        await deliverWebhookTask.trigger({
          runId: payload.runId,
          url: payload.webhookUrl,
          secret: payload.webhookSecret,
          headers: payload.webhookHeaders,
        })
      }

      return {
        runId: payload.runId,
        url,
        pages: result.pages,
        sizeBytes: result.buffer.length,
        renderTimeMs: result.renderTimeMs,
      }
    } catch (err) {
      logger.error("Render failed", { runId: payload.runId, error: String(err) })

      await db
        .update(runs)
        .set({
          status: "failed",
          errorType: err instanceof Error ? err.name : "UnknownError",
          errorDetail: err instanceof Error ? err.message : String(err),
          completedAt: new Date(),
        })
        .where(eq(runs.id, payload.runId))

      throw err
    }
  },
})
