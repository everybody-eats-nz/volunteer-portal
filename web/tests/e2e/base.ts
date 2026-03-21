import { test as base } from "@playwright/test";

// Extend base test to add e2e-testing class and suppress Next.js dev overlay
export const test = base.extend({
  page: async ({ page }, pageHandler) => {
    // Add e2e-testing class to disable animations and remove Next.js dev overlay
    await page.addInitScript(() => {
      function setup() {
        document.body.classList.add("e2e-testing");

        // Remove Next.js dev error overlay to prevent it from interfering with tests.
        // The overlay adds role="dialog" elements inside shadow DOM that cause
        // strict mode violations when tests look for app dialogs.
        const observer = new MutationObserver((mutations) => {
          for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
              if (
                node instanceof HTMLElement &&
                node.tagName === "NEXTJS-DEV-OVERLAY"
              ) {
                node.remove();
              }
            }
          }
        });
        observer.observe(document.documentElement, {
          childList: true,
          subtree: true,
        });
      }

      if (document.documentElement) {
        if (document.body) {
          setup();
        } else {
          document.addEventListener("DOMContentLoaded", setup);
        }
      } else {
        document.addEventListener("DOMContentLoaded", setup);
      }
    });

    await pageHandler(page);
  },
});

export { expect } from "@playwright/test";
