import { defineConfig } from "@trigger.dev/sdk"
import { additionalPackages } from "@trigger.dev/build/extensions/core"

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? "proj_ronvdeaorluyaszsumaa",
  runtime: "bun",
  dirs: ["./src/trigger"],
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 30000,
      factor: 2,
      randomize: true,
    },
  },
  build: {
    external: [
      "playwright-core",
      "playwright",
      "chromium-bidi",
    ],
    extensions: [
      additionalPackages({ packages: ["playwright@1.40.0"] }),
    ],
  },
  maxDuration: 300,
})
