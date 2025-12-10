import { test, expect } from "./base";
import { loginAsAdmin, loginAsVolunteer } from "./helpers/auth";
import {
  createTestUser,
  getUserByEmail,
  deleteTestUsers,
} from "./helpers/test-helpers";

test.describe("Admin User Impersonation", () => {
  let testVolunteerId: string | null = null;
  const testEmail = "impersonation-test@example.com";

  test.beforeAll(async ({ browser }) => {
    // Create a test volunteer for all tests in this suite
    const context = await browser.newContext();
    const page = await context.newPage();

    // Create test user
    await createTestUser(page, testEmail, "VOLUNTEER");

    // Get the user ID
    const user = await getUserByEmail(page, testEmail);
    testVolunteerId = user?.id || null;

    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test.describe("Impersonation Access and Visibility", () => {
    test("should show impersonate button on volunteer profile page for admins", async ({
      page,
    }) => {
      // Navigate to test volunteer profile
      await page.goto(`/admin/volunteers/${testVolunteerId}`);
      await page.waitForLoadState("load");

      // Check that admin actions card is visible
      const adminActionsCard = page.getByTestId("admin-actions-card");
      await expect(adminActionsCard).toBeVisible();

      // Check that impersonate button is visible
      const impersonateButton = page.getByTestId("impersonate-user-button");
      await expect(impersonateButton).toBeVisible();
      await expect(impersonateButton).toHaveText(/impersonate user/i);
    });

    test("should not show impersonate button for non-admin users", async ({
      page,
      context,
    }) => {
      // Logout and login as volunteer
      await context.clearCookies();
      await loginAsVolunteer(page);

      // Try to access the volunteer profile page directly
      await page.goto(`/admin/volunteers/${testVolunteerId}`);

      // Should be redirected away from admin page
      const currentUrl = page.url();
      expect(currentUrl).not.toContain("/admin/volunteers/");
    });
  });

  test.describe("Starting Impersonation", () => {
    test("should show confirmation dialog when clicking impersonate button", async ({
      page,
    }) => {
      // Navigate to test volunteer profile
      await page.goto(`/admin/volunteers/${testVolunteerId}`);
      await page.waitForLoadState("load");

      // Click impersonate button
      const impersonateButton = page.getByTestId("impersonate-user-button");
      await impersonateButton.click();

      // Check that confirmation dialog appears
      const dialog = page.getByRole("alertdialog");
      await expect(dialog).toBeVisible();

      // Verify dialog content
      await expect(dialog).toContainText(/impersonate user/i);
      await expect(dialog).toContainText(/you are about to impersonate/i);

      // Check for cancel and confirm buttons
      const cancelButton = page.getByRole("button", { name: /cancel/i });
      const confirmButton = page.getByTestId("confirm-impersonate");

      await expect(cancelButton).toBeVisible();
      await expect(confirmButton).toBeVisible();
    });

    test("should allow canceling impersonation from dialog", async ({
      page,
    }) => {
      // Navigate to test volunteer profile
      await page.goto(`/admin/volunteers/${testVolunteerId}`);
      await page.waitForLoadState("load");

      const currentUrl = page.url();

      // Click impersonate button
      const impersonateButton = page.getByTestId("impersonate-user-button");
      await impersonateButton.click();

      // Cancel the dialog
      const cancelButton = page.getByRole("button", { name: /cancel/i });
      await cancelButton.click();

      // Dialog should close and we should still be on the same page
      await page.waitForTimeout(500);
      expect(page.url()).toBe(currentUrl);

      // Impersonation banner should not appear
      const banner = page.getByTestId("impersonation-banner");
      await expect(banner).not.toBeVisible();
    });

    test("should successfully start impersonation and redirect to dashboard", async ({
      page,
    }) => {
      // Navigate to test volunteer profile
      await page.goto(`/admin/volunteers/${testVolunteerId}`);
      await page.waitForLoadState("load");

      // Click impersonate button
      const impersonateButton = page.getByTestId("impersonate-user-button");
      await impersonateButton.click();

      // Confirm impersonation
      const confirmButton = page.getByTestId("confirm-impersonate");
      await confirmButton.click();

      // Should redirect to dashboard
      await page.waitForURL("**/dashboard", { timeout: 10000 });
      expect(page.url()).toContain("/dashboard");

      // Impersonation banner should appear
      const banner = page.getByTestId("impersonation-banner");
      await expect(banner).toBeVisible({ timeout: 10000 });

      // Banner should contain the impersonated user's name (Test User from createTestUser)
      await expect(banner).toContainText("Test User");
      await expect(banner).toContainText(/impersonating/i);
    });
  });

  test.describe("Impersonation Banner", () => {
    test("should display impersonation banner with correct information", async ({
      page,
    }) => {
      // Start impersonation
      await page.goto(`/admin/volunteers/${testVolunteerId}`);
      await page.waitForLoadState("load");

      const impersonateButton = page.getByTestId("impersonate-user-button");
      await impersonateButton.click();
      const confirmButton = page.getByTestId("confirm-impersonate");
      await confirmButton.click();

      await page.waitForURL("**/dashboard");

      // Check banner visibility and content
      const banner = page.getByTestId("impersonation-banner");
      await expect(banner).toBeVisible();

      // Should show who we're impersonating
      await expect(banner).toContainText(/impersonating/i);
      await expect(banner).toContainText("Test User");

      // Should show who is logged in (admin)
      await expect(banner).toContainText(/logged in as/i);

      // Should have stop button
      const stopButton = page.getByTestId("stop-impersonation-button");
      await expect(stopButton).toBeVisible();
      await expect(stopButton).toHaveText(/stop impersonating/i);
    });

    test("should persist impersonation banner across page navigation", async ({
      page,
    }) => {
      // Start impersonation
      await page.goto(`/admin/volunteers/${testVolunteerId}`);
      await page.waitForLoadState("load");

      const impersonateButton = page.getByTestId("impersonate-user-button");
      await impersonateButton.click();
      const confirmButton = page.getByTestId("confirm-impersonate");
      await confirmButton.click();

      await page.waitForURL("**/dashboard");

      // Verify banner is visible on dashboard
      let banner = page.getByTestId("impersonation-banner");
      await expect(banner).toBeVisible();

      // Navigate to shifts page
      await page.goto("/shifts");
      await page.waitForLoadState("load");

      // Banner should still be visible
      banner = page.getByTestId("impersonation-banner");
      await expect(banner).toBeVisible();

      // Navigate to profile page
      await page.goto("/profile");
      await page.waitForLoadState("load");

      // Banner should still be visible
      banner = page.getByTestId("impersonation-banner");
      await expect(banner).toBeVisible();
    });
  });

  test.describe("Stopping Impersonation", () => {
    test("should stop impersonation and return to admin users page", async ({
      page,
    }) => {
      // Start impersonation
      await page.goto(`/admin/volunteers/${testVolunteerId}`);
      await page.waitForLoadState("load");

      const impersonateButton = page.getByTestId("impersonate-user-button");
      await impersonateButton.click();
      const confirmButton = page.getByTestId("confirm-impersonate");
      await confirmButton.click();

      await page.waitForURL("**/dashboard");

      // Verify impersonation is active
      const banner = page.getByTestId("impersonation-banner");
      await expect(banner).toBeVisible();

      // Click stop impersonation button
      const stopButton = page.getByTestId("stop-impersonation-button");
      await stopButton.click();

      // Should redirect to admin users page
      await page.waitForURL("**/admin/users", { timeout: 10000 });
      expect(page.url()).toContain("/admin/users");

      // Banner should disappear
      await expect(banner).not.toBeVisible();

      // Should be back as admin - verify by checking for admin-only elements
      await page.waitForLoadState("load");
      const adminUsersPage = page.getByTestId("admin-users-page");
      await expect(adminUsersPage).toBeVisible();
    });

    test("should restore admin session after stopping impersonation", async ({
      page,
    }) => {
      // Start impersonation
      await page.goto(`/admin/volunteers/${testVolunteerId}`);
      await page.waitForLoadState("load");

      const impersonateButton = page.getByTestId("impersonate-user-button");
      await impersonateButton.click();
      const confirmButton = page.getByTestId("confirm-impersonate");
      await confirmButton.click();

      await page.waitForURL("**/dashboard");

      // Stop impersonation
      const stopButton = page.getByTestId("stop-impersonation-button");
      await stopButton.click();
      await page.waitForURL("**/admin/users");

      // Verify admin can access admin pages
      await page.goto("/admin");
      await page.waitForLoadState("load");

      // Should not be redirected away
      expect(page.url()).toContain("/admin");

      // Try accessing another admin page
      await page.goto("/admin/shifts");
      await page.waitForLoadState("load");

      // Should have access
      expect(page.url()).toContain("/admin/shifts");
    });
  });

  test.describe("Impersonation as User", () => {
    test("should see volunteer dashboard when impersonating volunteer", async ({
      page,
    }) => {
      // Start impersonation of test volunteer
      await page.goto(`/admin/volunteers/${testVolunteerId}`);
      await page.waitForLoadState("load");

      const impersonateButton = page.getByTestId("impersonate-user-button");
      await impersonateButton.click();
      const confirmButton = page.getByTestId("confirm-impersonate");
      await confirmButton.click();

      await page.waitForURL("**/dashboard");

      // Should see volunteer dashboard elements (not admin dashboard)
      const dashboardPage = page.getByTestId("dashboard-page");
      await expect(dashboardPage).toBeVisible();

      // Should not see admin navigation
      const adminNavItems = page.getByRole("link", { name: /admin/i });
      await expect(adminNavItems).not.toBeVisible();
    });

    test("should not be able to access admin pages while impersonating volunteer", async ({
      page,
    }) => {
      // Start impersonation of test volunteer
      await page.goto(`/admin/volunteers/${testVolunteerId}`);
      await page.waitForLoadState("load");

      const impersonateButton = page.getByTestId("impersonate-user-button");
      await impersonateButton.click();
      const confirmButton = page.getByTestId("confirm-impersonate");
      await confirmButton.click();

      await page.waitForURL("**/dashboard");

      // Try to access admin page
      await page.goto("/admin/users");

      // Should be redirected away
      const currentUrl = page.url();
      expect(currentUrl).not.toContain("/admin/users");
      expect(currentUrl).toMatch(/\/(dashboard|login)/);
    });
  });

  test.describe("Edge Cases", () => {
    test("should not allow impersonating while already impersonating", async ({
      page,
    }) => {
      // Start first impersonation
      await page.goto(`/admin/volunteers/${testVolunteerId}`);
      await page.waitForLoadState("load");

      const impersonateButton = page.getByTestId("impersonate-user-button");
      await impersonateButton.click();
      const confirmButton = page.getByTestId("confirm-impersonate");
      await confirmButton.click();

      await page.waitForURL("**/dashboard");

      // Verify impersonation is active
      const banner = page.getByTestId("impersonation-banner");
      await expect(banner).toBeVisible();

      // Try to access another user's profile page
      // This should not work since volunteers can't access admin pages
      await page.goto("/admin/users");

      // Should be redirected away since impersonating a volunteer
      const currentUrl = page.url();
      expect(currentUrl).not.toContain("/admin/users");
    });
  });
});
