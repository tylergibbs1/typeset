import { logger, tasks, locals } from "@trigger.dev/sdk"
import { chromium, type Browser } from "playwright"

const PlaywrightBrowserLocal = locals.create<{ browser: Browser }>("playwright-browser")

export function getBrowser() {
  return locals.getOrThrow(PlaywrightBrowserLocal).browser
}

tasks.middleware("playwright-browser", async ({ next }) => {
  const browser = await chromium.launch({
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  })
  locals.set(PlaywrightBrowserLocal, { browser })
  logger.log("[chromium] Browser launched")

  try {
    await next()
  } finally {
    await browser.close()
    logger.log("[chromium] Browser closed")
  }
})

tasks.onWait("playwright-browser", async () => {
  const browser = getBrowser()
  await browser.close()
  logger.log("[chromium] Browser closed (onWait)")
})

tasks.onResume("playwright-browser", async () => {
  const browser = await chromium.launch({
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  })
  locals.set(PlaywrightBrowserLocal, { browser })
  logger.log("[chromium] Browser launched (onResume)")
})
