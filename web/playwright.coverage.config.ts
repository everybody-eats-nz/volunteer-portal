import { defineConfig, devices } from "@playwright/test";
import baseConfig from "./playwright.config";

export default defineConfig({
  ...baseConfig,

  // Use Playwright's native coverage collection
  use: {
    ...baseConfig.use,
    // Enable JavaScript coverage collection
    coverage: {
      enabled: true,
      outputDir: '.coverage',
      reportOnFailure: true,
    },
    // Disable trace for coverage runs to reduce overhead
    trace: 'off',
  },

  // Only run on Chromium for coverage
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Enable coverage collection
        contextOptions: {
          // Coverage collection settings
          coverage: {
            enabled: true,
          }
        }
      },
    }
  ],
});