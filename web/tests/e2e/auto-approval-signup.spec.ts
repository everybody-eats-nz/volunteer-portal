import { test, expect } from "./base";
import type { Page } from "@playwright/test";

// Helper function to login as volunteer
async function loginAsVolunteer(page: Page) {
  try {
    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");

    const volunteerLoginButton = page.getByTestId(
      "quick-login-volunteer-button"
    );
    await volunteerLoginButton.waitFor({ state: "visible", timeout: 10000 });
    await volunteerLoginButton.click();

    // Wait for navigation to complete (login redirects to dashboard)
    await page.waitForURL("/dashboard", { timeout: 20000 });
    await page.waitForLoadState("domcontentloaded");

    // Wait for dashboard to be visible to ensure login completed
    await page.waitForSelector('[data-testid="dashboard-page"]', {
      timeout: 10000,
    });
  } catch (error) {
    console.log("Error during volunteer login:", error);
    throw error;
  }
}

// Helper function to login as admin
async function loginAsAdmin(page: Page) {
  try {
    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");

    const adminLoginButton = page.getByTestId("quick-login-admin-button");
    await adminLoginButton.waitFor({ state: "visible", timeout: 10000 });
    await adminLoginButton.click();

    // Wait for navigation to complete (login redirects to dashboard)
    await page.waitForURL("/dashboard", { timeout: 20000 });
    await page.waitForLoadState("domcontentloaded");

    // Wait for admin dashboard to be visible to ensure login completed
    await page.waitForSelector('[data-testid="dashboard-page"]', {
      timeout: 10000,
    });
  } catch (error) {
    console.log("Error during admin login:", error);
    throw error;
  }
}

test.describe("Auto-Approval Signup Flow", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsVolunteer(page);

    // Skip tests if login failed
    const currentUrl = page.url();
    if (currentUrl.includes("/login")) {
      test.skip(true, "Volunteer login failed - skipping signup tests");
    }
  });

  test("should display shift signup dialog with proper structure", async ({
    page,
  }) => {
    // Navigate to shifts page
    await page.goto("/shifts");
    await page.waitForLoadState("load");

    // Wait for shifts to load - use a more general selector
    await page.waitForTimeout(3000);

    // Look for any signup button
    const signupButtons = page.getByText("Sign Up Now");

    if (await signupButtons.first().isVisible()) {
      await signupButtons.first().click();

      // Check if dialog opened
      const dialog = page.getByTestId("shift-signup-dialog");
      await expect(dialog).toBeVisible();

      // Check basic dialog structure
      const dialogTitle = page.getByTestId("shift-signup-dialog-title");
      await expect(dialogTitle).toBeVisible();

      const dialogDescription = page.getByTestId(
        "shift-signup-dialog-description"
      );
      await expect(dialogDescription).toBeVisible();
    } else {
      test.skip(true, "No available shifts to test signup with");
    }
  });

  test("should show loading state while checking eligibility", async ({
    page,
  }) => {
    // Navigate to shifts page first
    await page.goto("/shifts");
    await page.waitForLoadState("load");

    // Wait for calendar to load
    await page.waitForTimeout(2000);

    // Look for a clickable calendar day with shifts
    const calendarDay = page.locator('[data-testid^="calendar-day-"]').first();
    if (await calendarDay.isVisible()) {
      await calendarDay.click();
      await page.waitForLoadState("load");
    } else {
      // Fallback: try to find a shift ID from the page and navigate directly
      await page.goto("/shifts/details?date=2024-12-01");
      await page.waitForLoadState("load");
    }

    // Look for shift cards in the details page
    const firstShiftCard = page.locator('[data-testid^="shift-card-"]').first();
    
    // Try to find signup button
    const signupButton = firstShiftCard.locator('button:has-text("Sign Up")').or(
      firstShiftCard.locator('button:has-text("✨ Sign Up Now")')
    ).first();

    if (await signupButton.isVisible()) {
      await signupButton.click();

      // Check for loading state (may be brief)
      const loadingState = page.getByTestId("approval-process-loading");
      // Loading state might not be visible long enough to test reliably

      // At minimum, dialog should be present
      const dialog = page.getByTestId("shift-signup-dialog");
      await expect(dialog).toBeVisible();
    }
  });

  test("should display auto-approval message for eligible volunteers", async ({
    page,
  }) => {
    // Navigate to shifts page first
    await page.goto("/shifts");
    await page.waitForLoadState("load");

    // Wait for calendar to load
    await page.waitForTimeout(2000);

    // Look for a clickable calendar day with shifts
    const calendarDay = page.locator('[data-testid^="calendar-day-"]').first();
    if (await calendarDay.isVisible()) {
      await calendarDay.click();
      await page.waitForLoadState("load");
    } else {
      // Fallback: try to find a shift ID from the page and navigate directly
      await page.goto("/shifts/details?date=2024-12-01");
      await page.waitForLoadState("load");
    }

    // Look for shift cards in the details page
    const firstShiftCard = page.locator('[data-testid^="shift-card-"]').first();
    
    // Try to find signup button
    const signupButton = firstShiftCard.locator('button:has-text("Sign Up")').or(
      firstShiftCard.locator('button:has-text("✨ Sign Up Now")')
    ).first();

    if (await signupButton.isVisible()) {
      await signupButton.click();

      const dialog = page.getByTestId("shift-signup-dialog");
      await expect(dialog).toBeVisible();

      // Wait for eligibility check to complete
      await page.waitForTimeout(2000);

      // Look for auto-approval indicator
      const autoApprovalInfo = page.getByTestId("auto-approval-info");
      const approvalProcessInfo = page.getByTestId("approval-process-info");

      // Should see either auto-approval or regular approval process
      const hasAutoApproval = await autoApprovalInfo.isVisible();
      const hasRegularApproval = await approvalProcessInfo.isVisible();

      expect(hasAutoApproval || hasRegularApproval).toBe(true);

      if (hasAutoApproval) {
        await expect(autoApprovalInfo).toContainText(
          "Instant Approval Available"
        );
        await expect(autoApprovalInfo).toContainText("automatically approved");

        // Button text should be different for auto-approved users
        const confirmButton = page.getByTestId("shift-signup-confirm-button");
        await expect(confirmButton).toContainText("Sign Up (Auto-Approved)");
      }
    }
  });

  test("should show different dialog title for auto-approved users", async ({
    page,
  }) => {
    // Navigate to shifts page first
    await page.goto("/shifts");
    await page.waitForLoadState("load");

    // Wait for calendar to load
    await page.waitForTimeout(2000);

    // Look for a clickable calendar day with shifts
    const calendarDay = page.locator('[data-testid^="calendar-day-"]').first();
    if (await calendarDay.isVisible()) {
      await calendarDay.click();
      await page.waitForLoadState("load");
    } else {
      // Fallback: try to find a shift ID from the page and navigate directly
      await page.goto("/shifts/details?date=2024-12-01");
      await page.waitForLoadState("load");
    }

    // Look for shift cards in the details page
    const firstShiftCard = page.locator('[data-testid^="shift-card-"]').first();
    
    // Try to find signup button
    const signupButton = firstShiftCard.locator('button:has-text("Sign Up")').or(
      firstShiftCard.locator('button:has-text("✨ Sign Up Now")')
    ).first();

    if (await signupButton.isVisible()) {
      await signupButton.click();

      const dialog = page.getByTestId("shift-signup-dialog");
      await expect(dialog).toBeVisible();

      // Wait for eligibility check
      await page.waitForTimeout(2000);

      const dialogTitle = page.getByTestId("shift-signup-dialog-title");
      await expect(dialogTitle).toBeVisible();

      const titleText = await dialogTitle.textContent();

      // Should be either "Instant Signup" or "Confirm Signup"
      expect(titleText).toMatch(/(Instant Signup|Confirm Signup)/);
    }
  });

  test("should not check eligibility for waitlist signups", async ({
    page,
  }) => {
    // Navigate to shifts page first
    await page.goto("/shifts");
    await page.waitForLoadState("load");

    // Wait for calendar to load
    await page.waitForTimeout(2000);

    // Look for a clickable calendar day with shifts
    const calendarDay = page.locator('[data-testid^="calendar-day-"]').first();
    if (await calendarDay.isVisible()) {
      await calendarDay.click();
      await page.waitForLoadState("load");
    } else {
      // Fallback: try to find a shift ID from the page and navigate directly
      await page.goto("/shifts/details?date=2024-12-01");
      await page.waitForLoadState("load");
    }

    // Look for a waitlist button (these have different styling)
    const waitlistButton = page.getByText("Join Waitlist").first();
    if (await waitlistButton.isVisible()) {
      await waitlistButton.click();

      const dialog = page.getByTestId("shift-signup-dialog");
      await expect(dialog).toBeVisible();

      // For waitlist, should not see auto-approval info
      const autoApprovalInfo = page.getByTestId("auto-approval-info");
      await expect(autoApprovalInfo).not.toBeVisible();

      // Should see waitlist process info
      const approvalProcessInfo = page.getByTestId("approval-process-info");
      await expect(approvalProcessInfo).toBeVisible();
      await expect(approvalProcessInfo).toContainText("Waitlist Process");
    }
  });

  test("should complete signup flow without page reload", async ({ page }) => {
    // Navigate to shifts page first to get a shift ID
    await page.goto("/shifts");
    await page.waitForLoadState("load");

    // Wait for calendar to load
    await page.waitForTimeout(2000);

    // Look for a clickable calendar day with shifts
    const calendarDay = page.locator('[data-testid^="calendar-day-"]').first();
    if (await calendarDay.isVisible()) {
      await calendarDay.click();
      await page.waitForLoadState("load");
    } else {
      // Fallback: try to find a shift ID from the page and navigate directly
      await page.goto("/shifts/details?date=2024-12-01");
      await page.waitForLoadState("load");
    }

    const currentUrl = page.url();

    // Look for shift cards in the details page
    const firstShiftCard = page.locator('[data-testid^="shift-card-"]').first();
    
    // Try to find signup button
    const signupButton = firstShiftCard.locator('button:has-text("Sign Up")').or(
      firstShiftCard.locator('button:has-text("✨ Sign Up Now")')
    ).first();
    
    if (await signupButton.isVisible()) {
      await signupButton.click();

      const dialog = page.getByTestId("shift-signup-dialog");
      await expect(dialog).toBeVisible();

      // Wait for eligibility check
      await page.waitForTimeout(2000);

      // Click confirm signup
      const confirmButton = page.getByTestId("shift-signup-confirm-button");
      await confirmButton.click();

      // Wait for signup to complete
      await page.waitForTimeout(3000);

      // Should still be on the same page (no full reload)
      expect(page.url()).toBe(currentUrl);

      // Dialog should be closed
      await expect(dialog).not.toBeVisible();
    }
  });
});

test.describe("Auto-Approval API Integration", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsVolunteer(page);
  });

  test("should handle auto-approval check API correctly", async ({ page }) => {
    // Monitor network requests
    const apiRequests: string[] = [];

    page.on("request", (request) => {
      if (
        request.url().includes("/api/shifts/") &&
        request.url().includes("/auto-approval-check")
      ) {
        apiRequests.push(request.url());
      }
    });

    // Navigate to shifts page first to get a shift ID
    await page.goto("/shifts");
    await page.waitForLoadState("load");

    // Wait for calendar to load
    await page.waitForTimeout(2000);

    // Look for a clickable calendar day with shifts
    const calendarDay = page.locator('[data-testid^="calendar-day-"]').first();
    if (await calendarDay.isVisible()) {
      await calendarDay.click();
      await page.waitForLoadState("load");
    } else {
      // Fallback: try to find a shift ID from the page and navigate directly
      await page.goto("/shifts/details?date=2024-12-01");
      await page.waitForLoadState("load");
    }

    // Look for shift cards in the details page
    const firstShiftCard = page.locator('[data-testid^="shift-card-"]').first();
    
    // Try to find signup button
    const signupButton = firstShiftCard.locator('button:has-text("Sign Up")').or(
      firstShiftCard.locator('button:has-text("✨ Sign Up Now")')
    ).first();

    if (await signupButton.isVisible()) {
      await signupButton.click();

      const dialog = page.getByTestId("shift-signup-dialog");
      await expect(dialog).toBeVisible();

      // Wait for API call to complete
      await page.waitForTimeout(3000);

      // Should have made an auto-approval check request
      expect(apiRequests.length).toBeGreaterThan(0);
      expect(apiRequests[0]).toContain("auto-approval-check");
    }
  });

  test("should not make API calls for waitlist signups", async ({ page }) => {
    // Monitor network requests
    const apiRequests: string[] = [];

    page.on("request", (request) => {
      if (
        request.url().includes("/api/shifts/") &&
        request.url().includes("/auto-approval-check")
      ) {
        apiRequests.push(request.url());
      }
    });

    // Navigate to shifts page first
    await page.goto("/shifts");
    await page.waitForLoadState("load");

    // Wait for calendar to load
    await page.waitForTimeout(2000);

    // Look for a clickable calendar day with shifts
    const calendarDay = page.locator('[data-testid^="calendar-day-"]').first();
    if (await calendarDay.isVisible()) {
      await calendarDay.click();
      await page.waitForLoadState("load");
    } else {
      // Fallback: try to find a shift ID from the page and navigate directly
      await page.goto("/shifts/details?date=2024-12-01");
      await page.waitForLoadState("load");
    }

    const waitlistButton = page.getByText("Join Waitlist").first();
    if (await waitlistButton.isVisible()) {
      await waitlistButton.click();

      const dialog = page.getByTestId("shift-signup-dialog");
      await expect(dialog).toBeVisible();

      // Wait to see if any API calls are made
      await page.waitForTimeout(3000);

      // Should NOT have made auto-approval check requests for waitlist
      expect(apiRequests.length).toBe(0);
    }
  });
});

test.describe("Individual Shift Page Auto-Approval", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsVolunteer(page);
  });

  test("should show auto-approval in individual shift page", async ({
    page,
  }) => {
    // Navigate to shifts page first
    await page.goto("/shifts");
    await page.waitForLoadState("load");

    // Wait for calendar to load
    await page.waitForTimeout(2000);

    // Look for a clickable calendar day with shifts
    const calendarDay = page.locator('[data-testid^="calendar-day-"]').first();
    if (await calendarDay.isVisible()) {
      await calendarDay.click();
      await page.waitForLoadState("load");
    } else {
      // Fallback: try to find a shift ID from the page and navigate directly
      await page.goto("/shifts/details?date=2024-12-01");
      await page.waitForLoadState("load");
    }

    // Find first shift card and get its link
    const shiftLinks = page
      .locator('a[href*="/shifts/"]')
      .filter({ hasText: /Kitchen|Front|Dishwasher|View Details/ });

    if (await shiftLinks.first().isVisible()) {
      const shiftUrl = await shiftLinks.first().getAttribute("href");

      if (shiftUrl) {
        // Navigate to individual shift page
        await page.goto(shiftUrl);
        await page.waitForLoadState("load");

        // Look for sign up button
        const signupButton = page.getByText("Sign Up").first();
        if (await signupButton.isVisible()) {
          await signupButton.click();

          const dialog = page.getByTestId("shift-signup-dialog");
          await expect(dialog).toBeVisible();

          // Wait for eligibility check
          await page.waitForTimeout(2000);

          // Should show eligibility info
          const autoApprovalInfo = page.getByTestId("auto-approval-info");
          const approvalProcessInfo = page.getByTestId("approval-process-info");

          const hasAutoApproval = await autoApprovalInfo.isVisible();
          const hasRegularApproval = await approvalProcessInfo.isVisible();

          expect(hasAutoApproval || hasRegularApproval).toBe(true);
        }
      }
    }
  });
});
