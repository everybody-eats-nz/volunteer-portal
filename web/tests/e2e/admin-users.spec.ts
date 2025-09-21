import { test, expect } from "./base";
import type { Page } from "@playwright/test";

// Helper function to wait for page to load completely
async function waitForPageLoad(page: Page) {
  await page.waitForLoadState("load");
  await page.waitForTimeout(500); // Small buffer for animations
}

// Helper function to login as admin
async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  await waitForPageLoad(page);

  const adminButton = page.getByTestId("quick-login-admin-button");
  await adminButton.click();

  // Wait for navigation away from login page
  await page.waitForURL(
    (url) => {
      return url.pathname !== "/login";
    },
    { timeout: 10000 }
  );
}

// Helper function to login as volunteer (for permission tests)
async function loginAsVolunteer(page: Page) {
  await page.goto("/login");
  await waitForPageLoad(page);

  const volunteerButton = page.getByTestId("quick-login-volunteer-button");
  await volunteerButton.click();

  // Wait for navigation away from login page
  await page.waitForURL(
    (url) => {
      return url.pathname !== "/login";
    },
    { timeout: 10000 }
  );
}

test.describe("Admin Users Management", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test.describe("Page Access and Authentication", () => {
    test("should allow admin users to access the users management page", async ({
      page,
    }) => {
      await page.goto("/admin/users");
      await waitForPageLoad(page);

      // Verify we're on the admin users page
      const adminUsersPage = page.getByTestId("admin-users-page");
      await expect(adminUsersPage).toBeVisible();

      // Verify page title
      const pageTitle = page.getByRole("heading", { name: /user management/i });
      await expect(pageTitle).toBeVisible();
    });

    test("should redirect non-admin users away from admin pages", async ({
      page,
    }) => {
      // Logout and login as volunteer
      await page.goto("/api/auth/signout");
      await loginAsVolunteer(page);

      // Try to access admin users page
      await page.goto("/admin/users");
      await waitForPageLoad(page);

      // Should be redirected away from admin page
      const currentUrl = page.url();
      expect(currentUrl).not.toContain("/admin/users");

      // Should be redirected to dashboard or login
      expect(currentUrl).toMatch(/\/(dashboard|login)/);
    });

    test("should redirect unauthenticated users to login", async ({ page }) => {
      // Clear all cookies and session storage to ensure unauthenticated state
      await page.context().clearCookies();
      await page.evaluate(() => {
        sessionStorage.clear();
        localStorage.clear();
      });

      // Try to access admin users page
      await page.goto("/admin/users");
      await waitForPageLoad(page);

      // Check final URL - should be redirected to login or access denied
      const currentUrl = page.url();

      // Should either be redirected to login or not have access to admin users
      if (currentUrl.includes("/login")) {
        expect(currentUrl).toContain("/login");
        // Check for callback URL (may be encoded differently)
        // The callback URL might just be /admin instead of /admin/users due to layout redirect
        expect(currentUrl).toMatch(/callbackUrl.*admin/);
      } else {
        // Alternative: should not be on the admin users page
        expect(currentUrl).not.toContain("/admin/users");
        // Should be on dashboard, home, or similar
        expect(currentUrl).toMatch(/\/(dashboard|$)/);
      }
    });
  });

  test.describe("Page Structure and Statistics", () => {
    test("should display user statistics correctly", async ({ page }) => {
      await page.goto("/admin/users");
      await waitForPageLoad(page);

      // Check that stats grid is visible
      const statsGrid = page.getByTestId("user-stats-grid");
      await expect(statsGrid).toBeVisible();

      // Check individual stat cards
      const totalUsersStat = page.getByTestId("total-users-stat");
      const volunteersStat = page.getByTestId("volunteers-stat");
      const adminsStat = page.getByTestId("admins-stat");
      const newUsersStat = page.getByTestId("new-users-stat");

      await expect(totalUsersStat).toBeVisible();
      await expect(volunteersStat).toBeVisible();
      await expect(adminsStat).toBeVisible();
      await expect(newUsersStat).toBeVisible();

      // Check that counts are numbers and visible
      const totalUsersCount = page.getByTestId("total-users-count");
      const volunteersCount = page.getByTestId("volunteers-count");
      const adminsCount = page.getByTestId("admins-count");
      const newUsersCount = page.getByTestId("new-users-count");

      await expect(totalUsersCount).toBeVisible();
      await expect(volunteersCount).toBeVisible();
      await expect(adminsCount).toBeVisible();
      await expect(newUsersCount).toBeVisible();

      // Verify counts are numeric
      const totalText = await totalUsersCount.textContent();
      const volunteersText = await volunteersCount.textContent();
      const adminsText = await adminsCount.textContent();
      const newUsersText = await newUsersCount.textContent();

      expect(totalText).toMatch(/^\d+$/);
      expect(volunteersText).toMatch(/^\d+$/);
      expect(adminsText).toMatch(/^\d+$/);
      expect(newUsersText).toMatch(/^\d+$/);
    });

    test("should display filters section and invite button", async ({
      page,
    }) => {
      await page.goto("/admin/users");
      await waitForPageLoad(page);

      // Check filters section
      const filtersSection = page.getByTestId("main-role-filter-buttons");
      await expect(filtersSection).toBeVisible();

      // Check search input
      const searchInput = page.getByTestId("search-input");
      await expect(searchInput).toBeVisible();

      // Check invite user button
      const inviteButton = page.getByTestId("invite-user-button");
      await expect(inviteButton).toBeVisible();
      await expect(inviteButton).toContainText("Invite User");
    });

    test("should display users table with proper structure", async ({
      page,
    }) => {
      await page.goto("/admin/users");
      await waitForPageLoad(page);

      // Check users table
      const usersTable = page.getByTestId("users-table");
      await expect(usersTable).toBeVisible();
    });
  });

  test.describe("User List Display", () => {
    test("should display list of users with proper information", async ({
      page,
    }) => {
      await page.goto("/admin/users");
      await waitForPageLoad(page);

      // Check if users list exists
      const usersList = page.getByTestId("users-list");

      if (await usersList.isVisible()) {
        // Get all user rows
        const userRows = page.locator("[data-testid^='user-row-']");
        const userCount = await userRows.count();

        expect(userCount).toBeGreaterThan(0);

        // Check first user row has required elements
        const firstUserRow = userRows.first();
        await expect(firstUserRow).toBeVisible();

        // Extract user ID from the first row's testid
        const firstRowTestId = await firstUserRow.getAttribute("data-testid");
        const userId = firstRowTestId?.replace("user-row-", "");
        expect(userId).toBeTruthy();

        if (userId) {
          // Check user name
          const userName = page.getByTestId(`user-name-${userId}`);
          await expect(userName).toBeVisible();

          // Check user role badge
          const userRoleBadge = page.getByTestId(`user-role-badge-${userId}`);
          await expect(userRoleBadge).toBeVisible();
          const roleBadgeText = await userRoleBadge.textContent();
          expect(roleBadgeText).toMatch(/^(Admin|Volunteer)$/);

          // Check user email
          const userEmail = page.getByTestId(`user-email-${userId}`);
          await expect(userEmail).toBeVisible();
          const emailText = await userEmail.textContent();
          expect(emailText).toContain("@");

          // Check shifts count
          const shiftsCount = page.getByTestId(`user-shifts-count-${userId}`);
          if (await shiftsCount.isVisible()) {
            const shiftsText = await shiftsCount.textContent();
            // Extract just the number from "Xshifts" format
            const numberMatch = shiftsText?.match(/^(\d+)/);
            expect(numberMatch).toBeTruthy();
            if (numberMatch) {
              expect(numberMatch[1]).toMatch(/^\d+$/);
            }
          }

          // Check that the row has actions dropdown (role toggle and view details are now in dropdown)
          const userRow = page.getByTestId(`user-row-${userId}`);
          await expect(userRow).toBeVisible();
        }
      } else {
        // Check for no users message
        const noUsersMessage = page.getByTestId("no-users-message");
        await expect(noUsersMessage).toBeVisible();
        await expect(noUsersMessage).toContainText("No users found");
      }
    });

    test("should handle empty user list state", async ({ page }) => {
      // This test simulates a scenario where no users match filters
      await page.goto("/admin/users?search=nonexistentuserxyz123");
      await waitForPageLoad(page);

      // Should show no users message
      const noUsersMessage = page.getByTestId("no-users-message");
      await expect(noUsersMessage).toBeVisible();
      await expect(noUsersMessage).toContainText("No users found");
      await expect(noUsersMessage).toContainText(
        "Try adjusting your search or filter criteria"
      );

      // Invite first user button should not be visible when searching
      const inviteFirstUserButton = page.getByTestId(
        "invite-first-user-button"
      );
      await expect(inviteFirstUserButton).not.toBeVisible();
    });
  });

  test.describe("User Invitation", () => {
    test("should open invite user dialog", async ({ page }) => {
      await page.goto("/admin/users");
      await waitForPageLoad(page);

      const inviteButton = page.getByTestId("invite-user-button");
      await inviteButton.click();

      // Invite dialog should open
      const inviteDialog = page.getByTestId("invite-user-dialog");
      await expect(inviteDialog).toBeVisible();

      const dialogTitle = page.getByTestId("invite-user-dialog-title");
      await expect(dialogTitle).toBeVisible();
      await expect(dialogTitle).toContainText("Invite New User");

      // Check form elements
      const inviteForm = page.getByTestId("invite-user-form");
      await expect(inviteForm).toBeVisible();

      const emailInput = page.getByTestId("invite-email-input");
      const firstNameInput = page.getByTestId("invite-first-name-input");
      const lastNameInput = page.getByTestId("invite-last-name-input");
      const roleSelection = page.getByTestId("invite-role-selection");

      await expect(emailInput).toBeVisible();
      await expect(firstNameInput).toBeVisible();
      await expect(lastNameInput).toBeVisible();
      await expect(roleSelection).toBeVisible();

      // Check role options
      const volunteerRole = page.getByTestId("invite-role-volunteer");
      const adminRole = page.getByTestId("invite-role-admin");
      await expect(volunteerRole).toBeVisible();
      await expect(adminRole).toBeVisible();

      // Check action buttons
      const cancelButton = page.getByTestId("invite-cancel-button");
      const submitButton = page.getByTestId("invite-submit-button");
      await expect(cancelButton).toBeVisible();
      await expect(submitButton).toBeVisible();

      // Close dialog
      await cancelButton.click();
      await expect(inviteDialog).not.toBeVisible();
    });

    test("should validate required fields in invite form", async ({ page }) => {
      await page.goto("/admin/users");
      await waitForPageLoad(page);

      const inviteButton = page.getByTestId("invite-user-button");
      await inviteButton.click();

      const inviteDialog = page.getByTestId("invite-user-dialog");
      await expect(inviteDialog).toBeVisible();

      // Try to submit empty form
      const submitButton = page.getByTestId("invite-submit-button");
      await submitButton.click();

      // Email field should show validation error
      const emailInput = page.getByTestId("invite-email-input");
      const emailError = await emailInput.evaluate(
        (el: HTMLInputElement) => el.validationMessage
      );
      expect(emailError).toBeTruthy();
    });

    test("should fill out invite form correctly", async ({ page }) => {
      await page.goto("/admin/users");
      await waitForPageLoad(page);

      const inviteButton = page.getByTestId("invite-user-button");
      await inviteButton.click();

      const inviteDialog = page.getByTestId("invite-user-dialog");
      await expect(inviteDialog).toBeVisible();

      // Fill out form
      const emailInput = page.getByTestId("invite-email-input");
      const firstNameInput = page.getByTestId("invite-first-name-input");
      const lastNameInput = page.getByTestId("invite-last-name-input");
      const adminRole = page.getByTestId("invite-role-admin");

      await emailInput.fill("newuser@example.com");
      await firstNameInput.fill("New");
      await lastNameInput.fill("User");
      await adminRole.click();

      // Verify form fields are filled
      await expect(emailInput).toHaveValue("newuser@example.com");
      await expect(firstNameInput).toHaveValue("New");
      await expect(lastNameInput).toHaveValue("User");
      await expect(adminRole).toBeChecked();

      // Cancel without submitting
      const cancelButton = page.getByTestId("invite-cancel-button");
      await cancelButton.click();
      await expect(inviteDialog).not.toBeVisible();
    });

    test.skip("should successfully invite a new user", async ({ page }) => {
      // Skip this test as it would actually send an invitation email
      // In a real scenario, this would test the actual invitation functionality
      await page.goto("/admin/users");
      await waitForPageLoad(page);

      // This test would:
      // 1. Open invite dialog
      // 2. Fill out all required fields
      // 3. Submit the form
      // 4. Verify success message
      // 5. Verify dialog closes
      // 6. Verify user list refreshes
    });
  });

  test.describe("User Navigation and Details", () => {
    test("should navigate to user details page", async ({ page }) => {
      await page.goto("/admin/users");
      await waitForPageLoad(page);

      const usersList = page.getByTestId("users-list");

      if (await usersList.isVisible()) {
        const userRows = page.locator("[data-testid^='user-row-']");
        const userCount = await userRows.count();

        if (userCount > 0) {
          const firstRowTestId = await userRows
            .first()
            .getAttribute("data-testid");
          const userId = firstRowTestId?.replace("user-row-", "");

          if (userId) {
            const viewDetailsButton = page
              .getByTestId(`user-row-${userId}`)
              .getByRole("link");
            await viewDetailsButton.click();

            // Should navigate to user details page
            await page.waitForURL(`**/admin/volunteers/${userId}`, {
              timeout: 10000,
            });

            const currentUrl = page.url();
            expect(currentUrl).toContain(`/admin/volunteers/${userId}`);
          }
        }
      }
    });
  });

  test.describe("Loading States and Error Handling", () => {
    test("should handle slow loading gracefully", async ({ page }) => {
      // Simulate slow network
      await page.route("**/admin/users", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        route.continue();
      });

      await page.goto("/admin/users");

      // Page should eventually load
      await waitForPageLoad(page);

      const adminUsersPage = page.getByTestId("admin-users-page");
      await expect(adminUsersPage).toBeVisible();

      // Clean up route
      await page.unroute("**/admin/users");
    });
  });
});
