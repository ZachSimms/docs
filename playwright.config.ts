import { defineConfig, devices } from "@playwright/test";

const port = 3100;
const baseURL = `http://localhost:${port}`;
/** Phone-only specs run on emulated Android (Chromium) and iPhone (WebKit) as well. */
const MOBILE_SPECS = /\.mobile\.spec\.ts$/;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, testIgnore: MOBILE_SPECS },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] }, testMatch: MOBILE_SPECS },
    { name: "mobile-safari", use: { ...devices["iPhone 14"] }, testMatch: MOBILE_SPECS },
  ],
  webServer: {
    command: `bun run build && bunx next start -p ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
