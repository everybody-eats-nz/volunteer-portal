import { test as base, Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Extend Playwright test to include coverage collection
export const test = base.extend<{
  coveragePage: Page;
}>({
  coveragePage: async ({ page }, use) => {
    // Start coverage collection if enabled
    if (process.env.COLLECT_COVERAGE) {
      await page.coverage.startJSCoverage({
        resetOnNavigation: false,
        includeRawScriptCoverage: true,
      });
      await page.coverage.startCSSCoverage();
    }

    await use(page);

    // Collect coverage after test
    if (process.env.COLLECT_COVERAGE) {
      const jsCoverage = await page.coverage.stopJSCoverage();
      const cssCoverage = await page.coverage.stopCSSCoverage();

      // Create coverage directory
      const coverageDir = path.join(process.cwd(), 'coverage');
      if (!fs.existsSync(coverageDir)) {
        fs.mkdirSync(coverageDir, { recursive: true });
      }

      // Save coverage data
      const testInfo = base.info();
      const timestamp = Date.now();
      const testName = testInfo?.title?.replace(/[^a-zA-Z0-9]/g, '_') || 'unknown';

      const coverageData = {
        timestamp,
        testName,
        url: page.url(),
        jsCoverage: jsCoverage.map(entry => ({
          url: entry.url,
          ranges: entry.ranges,
          text: entry.text,
        })),
        cssCoverage: cssCoverage.map(entry => ({
          url: entry.url,
          ranges: entry.ranges,
          text: entry.text,
        })),
      };

      const fileName = `coverage-${testName}-${timestamp}.json`;
      fs.writeFileSync(
        path.join(coverageDir, fileName),
        JSON.stringify(coverageData, null, 2)
      );
    }
  },
});

export { expect } from '@playwright/test';