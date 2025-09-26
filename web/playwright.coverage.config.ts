import { defineConfig, devices } from "playwright-test-coverage";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined, // Use single worker for coverage to avoid conflicts
  reporter: [
    ['json', { outputFile: 'test-results/results.json' }],
    ['html']
  ],

  use: {
    baseURL: "http://localhost:3000",
    trace: "off", // Disable trace for coverage runs to reduce overhead
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium-coverage",
      use: {
        ...devices["Desktop Chrome"],
      },
    }
  ],

  webServer: {
    command: "NEXT_PUBLIC_DISABLE_ANIMATIONS=true PLAYWRIGHT_TEST=true COVERAGE=true npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: {
      COVERAGE: "true",
      NODE_ENV: "test"
    }
  },
});