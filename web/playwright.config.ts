import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? "blob" : "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // Enable coverage collection
    ...(process.env.COLLECT_COVERAGE && {
      contextOptions: {
        // Collect JS coverage for all pages
        recordVideo: undefined, // Disable video to save space when collecting coverage
        recordHar: undefined,   // Disable HAR to save space when collecting coverage
      },
    }),
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],

  webServer: process.env.SKIP_WEBSERVER
    ? undefined
    : {
        command: "NEXT_PUBLIC_DISABLE_ANIMATIONS=true PLAYWRIGHT_TEST=true npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
      },
});
