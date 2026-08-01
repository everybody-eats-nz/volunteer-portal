import type { Page } from "@playwright/test";

/**
 * Helper function to login as admin user
 * Uses the quick-login button with test ID for reliability
 */
export async function loginAsAdmin(page: Page) {
  try {
    await logout(page);
  } catch {
    console.warn("Couldn't logout - might not be logged in");
  }

  try {
    await page.goto("/login");
    await page.waitForLoadState("load");

    // Use .first() because for ~130ms after every load the subtree also
    // exists in React's hidden streaming staging container, so the testid
    // resolves to two elements. See helpers/streaming.ts for the full
    // explanation (and `waitForStreamSettled`, the cleaner fix).
    const adminLoginButton = page
      .getByTestId("quick-login-admin-button")
      .first();
    await adminLoginButton.waitFor({ state: "visible", timeout: 10000 });
    await adminLoginButton.click();

    await page.waitForURL("/admin");
    await page.waitForLoadState("load");
    // Wait for admin dashboard content — confirms the session is fully active.
    // Use .first() for the same streaming reason as above. Any match is
    // sufficient: if the session were invalid we'd be at /login instead of
    // /admin, so this element wouldn't appear at all.
    await page
      .getByTestId("admin-dashboard-page")
      .first()
      .waitFor({ state: "attached", timeout: 15000 });
  } catch (error) {
    console.log("Error during admin login:", error);
    throw error;
  }
}

/**
 * Helper function to login as volunteer user
 * Uses the quick-login button with test ID for reliability
 * If customEmail is provided, uses credentials login instead
 */
export async function loginAsVolunteer(page: Page, customEmail?: string) {
  try {
    await logout(page);
  } catch {
    console.warn("Couldn't logout - might not be logged in");
  }

  try {
    await page.goto("/login");
    await page.waitForLoadState("load");

    if (customEmail) {
      // Use credentials form for custom email
      // Clear the pre-filled email and enter custom email
      await page.getByLabel("Email address").fill(customEmail);

      // Fill in password (test users have password "Test123456")
      await page.getByLabel("Password").fill("Test123456");

      // Click login button
      await page.getByTestId("login-submit-button").click();
    } else {
      // Use quick login for default volunteer
      const volunteerLoginButton = page.getByTestId(
        "quick-login-volunteer-button"
      );
      await volunteerLoginButton.waitFor({ state: "visible", timeout: 10000 });
      await volunteerLoginButton.click();
    }

    await page.waitForURL("/dashboard");
    await page.waitForLoadState("load");
    await page.waitForTimeout(1000);
  } catch (error) {
    console.log("Error during volunteer login:", error);
    throw error;
  }
}

/**
 * Helper function to logout
 * Uses server-side logout page for reliability
 */
export async function logout(page: Page) {
  try {
    // Navigate to logout page which handles signout server-side
    await page.goto("/logout");

    // Wait for redirect to login page
    await page.waitForURL("**/login", { timeout: 10000 });
    await page.waitForLoadState("load");
  } catch (error) {
    console.log("Error during logout:", error);
    throw error;
  }
}
