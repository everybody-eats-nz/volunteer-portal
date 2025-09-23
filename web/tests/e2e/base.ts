import { test as base } from '@playwright/test';

// Extend base test to add e2e-testing class
export const test = base.extend({
  page: async ({ page }, pageHandler) => {
    // Add e2e-testing class to disable animations
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        document.body.classList.add('e2e-testing');
      });
      // Also add immediately in case DOM is already loaded
      if (document.body) {
        document.body.classList.add('e2e-testing');
      }
    });
    
    await pageHandler(page);
  },
});

export { expect } from '@playwright/test';