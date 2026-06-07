import { test, expect } from "./base";
import {
  createTestUser,
  deleteTestUsers,
} from "./helpers/test-helpers";

const ARCHIVED_EMAIL = "archived-reactivation@example.com";
const PASSWORD = "Test123456";

test.describe("Login reactivation flow", () => {
  test.beforeEach(async ({ page }) => {
    // Create an archived volunteer. `additionalData` is spread into the Prisma
    // create payload, so setting archivedAt + archiveReason here is enough to
    // trip the "AccountArchived" branch in the credentials provider.
    await createTestUser(page, ARCHIVED_EMAIL, "VOLUNTEER", {
      archivedAt: new Date().toISOString(),
      archiveReason: "MANUAL",
    });
  });

  test.afterEach(async ({ page }) => {
    await deleteTestUsers(page, [ARCHIVED_EMAIL]);
  });

  test("shows the reactivation banner and reactivates on submit", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.waitForLoadState("load");

    // Fill credentials for the archived user
    const emailInput = page.getByTestId("email-input");
    await emailInput.fill(ARCHIVED_EMAIL);

    const passwordInput = page.getByTestId("password-input");
    await passwordInput.fill(PASSWORD);

    // Submit — expect to land back on /login with the reactivation banner.
    // Use Promise.all to capture the navigation triggered by the click.
    const submitButton = page.getByTestId("login-submit-button");
    await Promise.all([
      page.waitForURL(/error=AccountArchived/, { timeout: 15000 }),
      submitButton.click(),
    ]);

    // Wait for React to hydrate the reloaded page before interacting with
    // controlled inputs. The SSR HTML already contains the banner (since
    // useSearchParams works server-side), so banner visibility alone is not a
    // reliable hydration signal — React event handlers may not yet be attached.
    await page.waitForLoadState("networkidle");

    const banner = page.getByTestId("reactivation-banner");
    await expect(banner).toBeVisible({ timeout: 5000 });

    // Re-enter the archived user's credentials (page reloaded with demo defaults).
    await emailInput.fill(ARCHIVED_EMAIL);
    await passwordInput.fill(PASSWORD);

    // Click "Reactivate my account" — should unarchive + log in + redirect
    const reactivateButton = page.getByTestId("reactivate-account-button");
    await expect(reactivateButton).toBeVisible();
    await reactivateButton.click();

    await page.waitForURL(
      (url) => !url.pathname.startsWith("/login"),
      { timeout: 20000 }
    );
    expect(page.url()).not.toContain("/login");
  });
});
