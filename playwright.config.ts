import { defineConfig, devices } from "@playwright/test";

const port = 3100;
const baseURL = `http://localhost:${port}`;
/** Phone-only specs run on emulated Android (Chromium) and iPhone (WebKit) as well. */
const MOBILE_SPECS = /\.mobile\.spec\.ts$/;
/**
 * Opt-in: a Chromium already on the machine (a CI image or cloud sandbox whose browser
 * build doesn't match this Playwright version), instead of `playwright install`.
 */
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const chromium = chromiumPath ? { launchOptions: { executablePath: chromiumPath } } : {};

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], ...chromium },
      testIgnore: MOBILE_SPECS,
    },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"], ...chromium }, testMatch: MOBILE_SPECS },
    { name: "mobile-safari", use: { ...devices["iPhone 14"] }, testMatch: MOBILE_SPECS },
  ],
  webServer: {
    command: `bun run build && bunx next start -p ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
