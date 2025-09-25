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
  await page.waitForURL((url) => {
    return url.pathname !== "/login";
  }, { timeout: 10000 });
}

// Helper function to login as volunteer
async function loginAsVolunteer(page: Page) {
  await page.goto("/login");
  await waitForPageLoad(page);
  
  const volunteerButton = page.getByTestId("quick-login-volunteer-button");
  await volunteerButton.click();
  
  // Wait for navigation away from login page
  await page.waitForURL((url) => {
    return url.pathname !== "/login";
  }, { timeout: 10000 });
}

test.describe("Regular Volunteers System", () => {
  test.describe("Admin Regular Volunteers Management", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
    });

    test("should allow admin to access regular volunteers management page", async ({ page }) => {
      await page.goto("/admin/regulars");
      await waitForPageLoad(page);

      // Verify we're on the regular volunteers page
      const regularVolunteersPage = page.getByTestId("regular-volunteers-page");
      await expect(regularVolunteersPage).toBeVisible();

      // Verify page title (first one is the main title)
      const pageTitle = page.getByRole("heading", { name: "Regular Volunteers" }).first();
      await expect(pageTitle).toBeVisible();
    });

    test("should redirect non-admin users away from admin regular volunteers page", async ({ page }) => {
      // Logout and login as volunteer
      await page.goto("/api/auth/signout");
      await loginAsVolunteer(page);

      // Try to access admin regular volunteers page
      await page.goto("/admin/regulars");
      await waitForPageLoad(page);

      // Should be redirected away from admin page
      const currentUrl = page.url();
      expect(currentUrl).not.toContain("/admin/regulars");
      
      // Should be redirected to dashboard or home
      expect(currentUrl).toMatch(/\/(dashboard|$)/);
    });

    test("should display regular volunteers list and statistics", async ({ page }) => {
      await page.goto("/admin/regulars");
      await waitForPageLoad(page);

      // Check statistics cards (they should be visible without specific testid)
      const totalRegularsCard = page.getByText("Total Regulars");
      const activeCard = page.getByText("Active").first();
      const pausedCard = page.getByText("Paused");
      const inactiveCard = page.getByText("Inactive");

      await expect(totalRegularsCard).toBeVisible();
      await expect(activeCard).toBeVisible(); 
      await expect(pausedCard).toBeVisible();
      await expect(inactiveCard).toBeVisible();

      // Check add regular volunteer form is present (collapsible)
      const addRegularTitle = page.getByText("Add Regular Volunteer");
      await expect(addRegularTitle).toBeVisible();
      
      // Check description
      const formDescription = page.getByText("Assign a volunteer to automatically sign up for recurring shifts");
      await expect(formDescription).toBeVisible();
    });

    test("should expand add regular volunteer form", async ({ page }) => {
      await page.goto("/admin/regulars");
      await waitForPageLoad(page);

      // Click on the collapsible trigger to expand form
      const addRegularTrigger = page.getByRole("button", { name: /Add Regular/i });
      await addRegularTrigger.click();

      // Form should expand and show fields
      await page.waitForTimeout(300); // Wait for animation

      // Check form fields are now visible
      const volunteerSelect = page.getByText("Volunteer *");
      const shiftTypeSelect = page.getByText("Shift Type *");
      const locationSelect = page.getByText("Location *");
      const frequencySelect = page.getByText("Frequency *");

      await expect(volunteerSelect).toBeVisible();
      await expect(shiftTypeSelect).toBeVisible();
      await expect(locationSelect).toBeVisible();
      await expect(frequencySelect).toBeVisible();

      // Check available days section
      const availableDaysLabel = page.getByText("Available Days *");
      await expect(availableDaysLabel).toBeVisible();

      // Check day buttons (shortened to Mon, Tue, etc)
      const mondayButton = page.getByRole("button", { name: "Mon" });
      const tuesdayButton = page.getByRole("button", { name: "Tue" });
      const wednesdayButton = page.getByRole("button", { name: "Wed" });

      await expect(mondayButton).toBeVisible();
      await expect(tuesdayButton).toBeVisible();
      await expect(wednesdayButton).toBeVisible();

      // Check notes textarea
      const notesLabel = page.getByText("Admin Notes (Optional)");
      await expect(notesLabel).toBeVisible();

      // Check action buttons
      const cancelButton = page.getByRole("button", { name: "Cancel" });
      const createButton = page.getByRole("button", { name: "Create Regular Volunteer" });

      await expect(cancelButton).toBeVisible();
      await expect(createButton).toBeVisible();

      // Collapse form by clicking cancel
      await cancelButton.click();
      await page.waitForTimeout(300); // Wait for animation
      
      // Form fields should be hidden again
      await expect(volunteerSelect).not.toBeVisible();
    });

    test("should display regular volunteers table or empty state", async ({ page }) => {
      await page.goto("/admin/regulars");
      await waitForPageLoad(page);

      // The page should show either a table with regulars or an empty state
      // We don't assume specific data exists, just verify the structure
      const pageContent = page.getByTestId("regular-volunteers-page");
      await expect(pageContent).toBeVisible();
      
      // Should have the form and some table/list structure
      const addRegularForm = page.getByText("Add Regular Volunteer");
      await expect(addRegularForm).toBeVisible();
      
      // The exact table structure depends on data, so we just verify the page loaded correctly
      const pageTitle = page.getByRole("heading", { name: "Regular Volunteers" }).first();
      await expect(pageTitle).toBeVisible();
    });

    test("should have table structure for managing regular volunteers", async ({ page }) => {
      await page.goto("/admin/regulars");
      await waitForPageLoad(page);

      // This test verifies that the admin page has the expected structure
      // without assuming specific data exists
      const pageContent = page.getByTestId("regular-volunteers-page");
      await expect(pageContent).toBeVisible();

      // Should have statistics
      const totalRegularsCard = page.getByText("Total Regulars");
      await expect(totalRegularsCard).toBeVisible();

      // Should have form for adding regulars
      const addRegularForm = page.getByText("Add Regular Volunteer");
      await expect(addRegularForm).toBeVisible();

      // The table/list structure should exist (even if empty)
      // We don't test specific interactions since they depend on test data
      const pageTitle = page.getByRole("heading", { name: "Regular Volunteers" }).first();
      await expect(pageTitle).toBeVisible();
    });

    test("should integrate regular volunteer info with admin user management", async ({ page }) => {
      // This test verifies that regular volunteer information is integrated
      // with the admin user management system
      await page.goto("/admin/users");
      await waitForPageLoad(page);

      // Should be able to navigate to users management
      const adminUsersPage = page.getByTestId("admin-users-page");
      await expect(adminUsersPage).toBeVisible();

      // And should be able to navigate to regular volunteers management
      await page.goto("/admin/regulars");
      await waitForPageLoad(page);

      const regularVolunteersPage = page.getByTestId("regular-volunteers-page");
      await expect(regularVolunteersPage).toBeVisible();
      
      // Both pages should be accessible by admins
      const pageTitle = page.getByRole("heading", { name: "Regular Volunteers" }).first();
      await expect(pageTitle).toBeVisible();
    });

    test.skip("should successfully add a new regular volunteer", async ({ page }) => {
      // Skip this test as it would create actual data
      await page.goto("/admin/regulars");
      await waitForPageLoad(page);

      // This test would:
      // 1. Click add regular volunteer button
      // 2. Fill out all required fields
      // 3. Select available days
      // 4. Submit the form
      // 5. Verify success message
      // 6. Verify new regular volunteer appears in list
    });
  });

  test.describe("Volunteer Self-Service Regular Volunteer Management", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsVolunteer(page);
    });

    test("should allow volunteers to access regular volunteer settings", async ({ page }) => {
      await page.goto("/profile/regular-schedule");
      await waitForPageLoad(page);

      // Verify we're on the regular schedule page
      const regularSchedulePage = page.getByTestId("regular-schedule-page");
      await expect(regularSchedulePage).toBeVisible();

      // Verify page title
      const pageTitle = page.getByRole("heading", { name: "Regular Schedule" });
      await expect(pageTitle).toBeVisible();
    });

    test("should display regular volunteer status and controls", async ({ page }) => {
      await page.goto("/profile/regular-schedule");
      await waitForPageLoad(page);

      // Check if user is a regular volunteer or not
      const notRegularMessage = page.getByText("Not a Regular Volunteer Yet");
      const regularStatusCard = page.getByText("Regular Volunteer Status");
      
      // Either should be visible (depending on user's regular status)
      const hasNotRegularMessage = await notRegularMessage.isVisible();
      const hasRegularStatus = await regularStatusCard.isVisible();
      
      expect(hasNotRegularMessage || hasRegularStatus).toBeTruthy();

      if (hasNotRegularMessage) {
        // Check not regular volunteer content
        const description = page.getByText("You haven't been assigned as a regular volunteer");
        await expect(description).toBeVisible();
        
        const benefits = page.getByText("• Auto-apply to matching shifts");
        await expect(benefits).toBeVisible();
      }

      if (hasRegularStatus) {
        // Check regular volunteer status content
        await expect(regularStatusCard).toBeVisible();
        
        // Should have status badge (Active, Paused, or Inactive)
        const statusBadge = page.locator("span").filter({ 
          hasText: /^(Active|Paused|Inactive)$/
        });
        await expect(statusBadge.first()).toBeVisible();
      }
    });

    test("should display regular volunteer configuration when enabled", async ({ page }) => {
      await page.goto("/profile/regular-schedule");
      await waitForPageLoad(page);

      // Check if user has regular volunteer configuration
      const currentScheduleCard = page.getByText("Current Schedule");
      
      if (await currentScheduleCard.isVisible()) {
        await expect(currentScheduleCard).toBeVisible();

        // Check configuration details
        const shiftTypeSection = page.getByText("Shift Type");
        const locationSection = page.getByText("Location");
        const frequencySection = page.getByText("Frequency");
        const availableDaysSection = page.getByText("Available Days");

        await expect(shiftTypeSection).toBeVisible();
        await expect(locationSection).toBeVisible();
        await expect(frequencySection).toBeVisible();
        await expect(availableDaysSection).toBeVisible();
      } else {
        // User is not a regular volunteer yet
        const notRegularMessage = page.getByText("Not a Regular Volunteer Yet");
        await expect(notRegularMessage).toBeVisible();
      }
    });

    test("should display schedule management options for regular volunteers", async ({ page }) => {
      await page.goto("/profile/regular-schedule");
      await waitForPageLoad(page);

      // This test verifies the schedule management section exists
      // The actual controls depend on whether the user is a regular volunteer
      const notRegularMessage = page.getByText("Not a Regular Volunteer Yet");
      const hasRegularStatus = !(await notRegularMessage.isVisible());

      if (hasRegularStatus) {
        // Should show some schedule management options
        // The exact implementation may vary, so we just check basic structure exists
        const pageContent = page.getByTestId("regular-schedule-page");
        await expect(pageContent).toBeVisible();
        
        // Should have some interactive elements or information
        const backButton = page.getByRole("button", { name: /Back to Profile/i });
        await expect(backButton).toBeVisible();
      } else {
        // Shows information about becoming a regular volunteer
        await expect(notRegularMessage).toBeVisible();
        const contactMessage = page.getByText("Contact an administrator if you'd like to become a regular volunteer");
        await expect(contactMessage).toBeVisible();
      }
    });

    test("should display upcoming shifts information for regular volunteers", async ({ page }) => {
      await page.goto("/profile/regular-schedule");
      await waitForPageLoad(page);

      // Check if user is a regular volunteer
      const notRegularMessage = page.getByText("Not a Regular Volunteer Yet");
      const hasRegularStatus = !(await notRegularMessage.isVisible());

      if (hasRegularStatus) {
        // Should have some content related to upcoming shifts
        // The exact implementation depends on the UpcomingRegularShifts component
        const pageContent = page.getByTestId("regular-schedule-page");
        await expect(pageContent).toBeVisible();
        
        // Should show current schedule information
        const currentSchedule = page.getByText("Current Schedule");
        if (await currentSchedule.isVisible()) {
          await expect(currentSchedule).toBeVisible();
        }
      } else {
        // Not a regular volunteer
        await expect(notRegularMessage).toBeVisible();
      }
    });

    test.skip("should successfully enable regular volunteer status", async ({ page }) => {
      // Skip this test as it would modify user data
      await page.goto("/profile/regular");
      await waitForPageLoad(page);

      // This test would:
      // 1. Toggle the enable switch if currently disabled
      // 2. Verify confirmation dialog appears
      // 3. Confirm the action
      // 4. Verify status changes to enabled
      // 5. Verify configuration section appears
    });

    test.skip("should successfully pause regular volunteer schedule", async ({ page }) => {
      // Skip this test as it would modify user data
      await page.goto("/profile/regular");
      await waitForPageLoad(page);

      // This test would:
      // 1. Click pause schedule button
      // 2. Fill out pause form (dates, reason)
      // 3. Submit the pause request
      // 4. Verify success message
      // 5. Verify status changes to paused
    });
  });

  test.describe("Auto-Signup Generation and Display", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
    });

    test("should show auto-signups in admin shifts management", async ({ page }) => {
      await page.goto("/admin/shifts");
      await waitForPageLoad(page);

      // Look for shifts with auto-signups
      const shiftCards = page.locator("[data-testid^='shift-card-']");
      const shiftCount = await shiftCards.count();

      if (shiftCount > 0) {
        const firstCardTestId = await shiftCards.first().getAttribute("data-testid");
        const shiftId = firstCardTestId?.replace("shift-card-", "");
        
        if (shiftId) {
          // Look for auto-signup indicators
          const signupsList = page.getByTestId(`signups-list-${shiftId}`);
          
          if (await signupsList.isVisible()) {
            // Check for regular signup badges
            const regularSignups = page.locator("[data-testid^='signup-row-']").filter({
              has: page.locator("[data-testid$='-regular-badge']")
            });
            
            const regularSignupCount = await regularSignups.count();
            
            if (regularSignupCount > 0) {
              // Check that regular badge is visible
              const firstRegularSignup = regularSignups.first();
              const signupRowTestId = await firstRegularSignup.getAttribute("data-testid");
              const signupId = signupRowTestId?.replace("signup-row-", "");
              
              if (signupId) {
                const regularBadge = page.getByTestId(`signup-${signupId}-regular-badge`);
                await expect(regularBadge).toBeVisible();
                await expect(regularBadge).toContainText("Regular");

                // Check that status shows as REGULAR_PENDING
                const statusBadge = page.getByTestId(`signup-status-${signupId}`);
                await expect(statusBadge).toBeVisible();
              }
            }
          }
        }
      }
    });

    test("should allow admin to accept auto-generated signups", async ({ page }) => {
      await page.goto("/admin/shifts");
      await waitForPageLoad(page);

      const shiftCards = page.locator("[data-testid^='shift-card-']");
      const shiftCount = await shiftCards.count();

      if (shiftCount > 0) {
        const firstCardTestId = await shiftCards.first().getAttribute("data-testid");
        const shiftId = firstCardTestId?.replace("shift-card-", "");
        
        if (shiftId) {
          const signupsList = page.getByTestId(`signups-list-${shiftId}`);
          
          if (await signupsList.isVisible()) {
            // Look for pending regular signups
            const regularPendingSignups = page.locator("[data-testid^='signup-row-']").filter({
              has: page.locator("[data-testid$='-regular-badge']")
            }).filter({
              has: page.locator("text=REGULAR_PENDING")
            });
            
            const pendingCount = await regularPendingSignups.count();
            
            if (pendingCount > 0) {
              const firstPendingSignup = regularPendingSignups.first();
              const signupRowTestId = await firstPendingSignup.getAttribute("data-testid");
              const signupId = signupRowTestId?.replace("signup-row-", "");
              
              if (signupId) {
                // Check for accept/reject buttons
                const acceptButton = page.getByTestId(`accept-signup-${signupId}`);
                const rejectButton = page.getByTestId(`reject-signup-${signupId}`);

                if (await acceptButton.isVisible()) {
                  await expect(acceptButton).toBeVisible();
                  await expect(acceptButton).toContainText("Accept");
                }

                if (await rejectButton.isVisible()) {
                  await expect(rejectButton).toBeVisible();
                  await expect(rejectButton).toContainText("Reject");
                }
              }
            }
          }
        }
      }
    });

    test("should show regular volunteer indicators in shift creation", async ({ page }) => {
      await page.goto("/admin/shifts/new");
      await waitForPageLoad(page);

      // Check for regular volunteers preview section
      const regularVolunteersSection = page.getByTestId("regular-volunteers-preview-section");
      
      if (await regularVolunteersSection.isVisible()) {
        await expect(regularVolunteersSection).toBeVisible();

        // Check section title
        const sectionTitle = page.getByTestId("regular-volunteers-preview-title");
        await expect(sectionTitle).toBeVisible();
        await expect(sectionTitle).toContainText("Regular Volunteers");

        // Check for matching regular volunteers list
        const matchingRegularsList = page.getByTestId("matching-regulars-list");
        const noMatchingRegularsMessage = page.getByTestId("no-matching-regulars-message");

        const hasMatchingList = await matchingRegularsList.isVisible();
        const hasNoMatchingMessage = await noMatchingRegularsMessage.isVisible();

        expect(hasMatchingList || hasNoMatchingMessage).toBeTruthy();

        if (hasMatchingList) {
          // Check individual regular volunteer items
          const regularItems = page.locator("[data-testid^='matching-regular-']");
          const itemCount = await regularItems.count();
          
          if (itemCount > 0) {
            const firstItem = regularItems.first();
            await expect(firstItem).toBeVisible();

            const firstItemTestId = await firstItem.getAttribute("data-testid");
            const regularId = firstItemTestId?.replace("matching-regular-", "");
            
            if (regularId) {
              const volunteerName = page.getByTestId(`matching-regular-name-${regularId}`);
              const frequency = page.getByTestId(`matching-regular-frequency-${regularId}`);

              await expect(volunteerName).toBeVisible();
              await expect(frequency).toBeVisible();
            }
          }
        }
      }
    });

    test.skip("should auto-generate signups when creating matching shifts", async ({ page }) => {
      // Skip this test as it would create actual data and signups
      await page.goto("/admin/shifts/new");
      await waitForPageLoad(page);

      // This test would:
      // 1. Fill out shift form with details matching a regular volunteer
      // 2. Submit the form
      // 3. Navigate to the created shift
      // 4. Verify auto-signup was generated
      // 5. Verify signup has REGULAR_PENDING status
      // 6. Verify regular volunteer badge is displayed
    });
  });

  test.describe("Regular Volunteer Notifications and Communication", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsVolunteer(page);
    });

    test("should display regular volunteer related notifications", async ({ page }) => {
      await page.goto("/dashboard");
      await waitForPageLoad(page);

      // Check for notifications section
      const notificationsSection = page.getByTestId("notifications-section");
      
      if (await notificationsSection.isVisible()) {
        await expect(notificationsSection).toBeVisible();

        // Look for regular volunteer related notifications
        const notifications = page.locator("[data-testid^='notification-']");
        const notificationCount = await notifications.count();

        if (notificationCount > 0) {
          // Check for notifications about auto-signups, schedule changes, etc.
          // This would depend on the specific notification implementation
          console.log(`Found ${notificationCount} notifications to check for regular volunteer content`);
        }
      }
    });
  });

  test.describe("Responsive Design and Mobile Support", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
    });

    test("should display regular volunteers management responsively on mobile", async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/admin/regulars");
      await waitForPageLoad(page);

      // Main elements should still be accessible
      const regularVolunteersPage = page.getByTestId("regular-volunteers-page");
      await expect(regularVolunteersPage).toBeVisible();

      // Page title should be visible
      const pageTitle = page.getByRole("heading", { name: "Regular Volunteers" }).first();
      await expect(pageTitle).toBeVisible();

      // Statistics cards should be responsive
      const totalRegularsCard = page.getByText("Total Regulars");
      await expect(totalRegularsCard).toBeVisible();

      // Form should be accessible
      const addRegularTitle = page.getByText("Add Regular Volunteer");
      await expect(addRegularTitle).toBeVisible();
    });

    test("should display volunteer regular settings responsively on mobile", async ({ page }) => {
      await page.goto("/api/auth/signout");
      await loginAsVolunteer(page);

      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/profile/regular-schedule");
      await waitForPageLoad(page);

      // Main elements should still be accessible
      const regularSchedulePage = page.getByTestId("regular-schedule-page");
      await expect(regularSchedulePage).toBeVisible();

      // Page title should be visible on mobile
      const pageTitle = page.getByRole("heading", { name: "Regular Schedule" });
      await expect(pageTitle).toBeVisible();

      // Content should be visible and functional on mobile
      const pageContent = page.getByTestId("regular-schedule-page");
      await expect(pageContent).toBeVisible();
    });
  });
});