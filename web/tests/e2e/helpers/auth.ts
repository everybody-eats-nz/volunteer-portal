import type { Page } from "@playwright/test";

/**
 * Helper function to login as admin user
 * Uses the quick-login button with test ID for reliability
 */
export async function loginAsAdmin(page: Page) {
  try {
    await page.goto("/login");
    await page.waitForLoadState("load");

    const adminLoginButton = page.getByTestId("quick-login-admin-button");
    await adminLoginButton.waitFor({ state: "visible", timeout: 10000 });
    await adminLoginButton.click();

    await page.waitForURL("/admin");
    await page.waitForLoadState("load");
    await page.waitForTimeout(1000);
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
