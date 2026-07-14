import { test, expect } from "./base";
import type { Page } from "@playwright/test";
import { createTestUser, deleteTestUsers } from "./helpers/test-helpers";

const PASSWORD = "Test123456";

// Tests in this file run in parallel workers, so each test uses its own
// email - sharing one would race (creating a test user deletes any existing
// user with the same email first).
let createdEmails: string[] = [];

async function createUser(page: Page, email: string, emailVerified: boolean) {
  await createTestUser(page, email, "VOLUNTEER", { emailVerified });
  createdEmails.push(email);
}

async function loginViaForm(page: Page, email: string) {
  await page.goto("/login");
  await page.waitForLoadState("load");

  await page.getByTestId("email-input").fill(email);
  await page.getByTestId("password-input").fill(PASSWORD);
  await page.getByTestId("login-submit-button").click();

  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 20000,
  });
}

test.describe("Email verification banner", () => {
  test.afterEach(async ({ page }) => {
    await deleteTestUsers(page, createdEmails);
    createdEmails = [];
  });

  test("unverified volunteer can log in and sees the banner across pages", async ({
    page,
  }) => {
    const email = "banner-unverified-nav@example.com";
    await createUser(page, email, false);

    // Login must succeed even though the email is unverified - verification
    // is enforced at shift signup, not at login.
    await loginViaForm(page, email);
    await expect(page).toHaveURL(/\/dashboard/);

    const banner = page.getByTestId("email-verification-banner");
    await expect(banner).toBeVisible({ timeout: 15000 });
    await expect(banner).toContainText("Verify your email address");
    await expect(banner).toContainText(email);

    // Banner persists on other volunteer pages
    await page.goto("/shifts");
    await page.waitForLoadState("load");
    await expect(banner).toBeVisible({ timeout: 15000 });
  });

  test("resend button sends a verification email and confirms", async ({
    page,
  }) => {
    const email = "banner-unverified-resend@example.com";
    await createUser(page, email, false);
    await loginViaForm(page, email);

    const banner = page.getByTestId("email-verification-banner");
    await expect(banner).toBeVisible({ timeout: 15000 });

    const resendButton = page.getByTestId("email-verification-resend-button");
    await expect(resendButton).toBeVisible();
    await resendButton.click();

    // Success confirmation replaces the button
    const success = page.getByTestId("email-verification-resend-success");
    await expect(success).toBeVisible({ timeout: 15000 });
    await expect(success).toContainText("Email sent");
    await expect(resendButton).not.toBeVisible();
  });

  test("verified volunteer does not see the banner", async ({ page }) => {
    const email = "banner-verified@example.com";
    await createUser(page, email, true);
    await loginViaForm(page, email);
    await expect(page).toHaveURL(/\/dashboard/);

    // Give the page a moment to settle so a late-appearing banner would show.
    // (networkidle never fires here - the dashboard holds an SSE stream open.)
    await page.waitForLoadState("load");
    await page.waitForTimeout(2000);
    await expect(
      page.getByTestId("email-verification-banner")
    ).not.toBeVisible();
  });
});
