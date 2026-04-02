import { chromium, type Browser, type Page, type BrowserContext } from 'playwright'

export class BrowserPool {
  private browsers: Browser[] = []
  private readonly maxPagesPerBrowser: number
  private readonly maxBrowsers: number

  constructor(opts?: { maxPagesPerBrowser?: number; maxBrowsers?: number }) {
    this.maxPagesPerBrowser = opts?.maxPagesPerBrowser ?? 20
    this.maxBrowsers = opts?.maxBrowsers ?? 4
  }

  async getPage(): Promise<{ page: Page; context: BrowserContext }> {
    for (const browser of this.browsers) {
      const pages = browser.contexts().flatMap((c) => c.pages())
      if (pages.length < this.maxPagesPerBrowser) {
        const context = await browser.newContext()
        const page = await context.newPage()
        return { page, context }
      }
    }

    if (this.browsers.length < this.maxBrowsers) {
      const browser = await chromium.launch({
        args: [
          '--no-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-web-security',
        ],
      })
      this.browsers.push(browser)
      const context = await browser.newContext()
      const page = await context.newPage()
      return { page, context }
    }

    throw new Error('Render queue full, retry later')
  }

  async releasePage(page: Page, context: BrowserContext): Promise<void> {
    await page.close()
    await context.close()
  }

  async shutdown(): Promise<void> {
    await Promise.all(this.browsers.map((b) => b.close()))
    this.browsers = []
  }
}
