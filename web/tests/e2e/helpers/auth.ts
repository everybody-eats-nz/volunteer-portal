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

    await page.waitForURL((url) => !url.pathname.includes("/login"), {
      timeout: 15000,
    });
    await page.waitForLoadState("load");
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

    await page.waitForURL((url) => !url.pathname.includes("/login"), {
      timeout: 15000,
    });
    await page.waitForLoadState("load");
  } catch (error) {
    console.log("Error during volunteer login:", error);
    throw error;
  }
}

/**
 * Helper function to logout
 */
export async function logout(page: Page) {
  try {
    // Click user menu
    await page.getByTestId("user-menu-button").click();

    // Click logout
    await page.getByText("Logout").click();

    // Wait for redirect to login page
    await page.waitForURL("**/login");
  } catch (error) {
    console.log("Error during logout:", error);
    throw error;
  }
}
