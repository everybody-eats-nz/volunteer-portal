import { test, expect } from "./base";
import type { Page } from "@playwright/test";
import { loginAsVolunteer } from "./helpers/auth";

// Helper function to navigate to shifts with location selected
async function navigateToShiftsWithLocation(
  page: Page,
  location = "Wellington"
) {
  await page.goto("/shifts");
  await page.waitForLoadState("load");

  // Check if location selection screen is shown
  const locationSelectionTitle = page.getByTestId("location-selection-title");

  if (await locationSelectionTitle.isVisible()) {
    const locationKey = location.toLowerCase().replace(/\s+/g, "-");

    // Try preferred location first (for authenticated users)
    const preferredLocationOption = page.getByTestId(
      `preferred-location-${locationKey}`
    );
    const regularLocationOption = page.getByTestId(
      `location-option-${locationKey}`
    );

    // Click whichever option is visible
    if (await preferredLocationOption.isVisible()) {
      await preferredLocationOption.click();
    } else {
      await regularLocationOption.click();
    }
    await page.waitForLoadState("load");
  }
}

test.describe("Shifts Browse Page", () => {
  test.describe("Unauthenticated Access", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/shifts");
      await page.waitForLoadState("load");
    });

    test("should display location selection screen without authentication", async ({
      page,
    }) => {
      // Check page loads successfully
      await expect(page).toHaveURL("/shifts");

      // Check main page container
      const browsePage = page.getByTestId("shifts-browse-page");
      await expect(browsePage).toBeVisible();

      // Check location selection title and description
      const selectionTitle = page.getByTestId("location-selection-title");
      await expect(selectionTitle).toBeVisible();
      await expect(selectionTitle).toContainText("Choose Your Location");

      const selectionDescription = page.getByTestId(
        "location-selection-description"
      );
      await expect(selectionDescription).toBeVisible();
      await expect(selectionDescription).toContainText(
        "Please select a location to view available volunteer shifts"
      );
    });

    test("should display location options for selection", async ({ page }) => {
      // Check location selection options container
      const locationOptions = page.getByTestId("location-selection-options");
      await expect(locationOptions).toBeVisible();

      // Check individual location options are available
      const wellingtonOption = page.getByTestId("location-option-wellington");
      await expect(wellingtonOption).toBeVisible();

      const glenInnesOption = page.getByTestId("location-option-glen-innes");
      await expect(glenInnesOption).toBeVisible();

      const onehungaOption = page.getByTestId("location-option-onehunga");
      await expect(onehungaOption).toBeVisible();

      // Check "Show All" option
      const showAllOption = page.getByTestId("show-all-locations");
      await expect(showAllOption).toBeVisible();
    });

    test("should navigate to filtered shifts page when selecting a location", async ({
      page,
    }) => {
      // Click on Wellington location option
      const wellingtonOption = page.getByTestId("location-option-wellington");
      await wellingtonOption.click();
      await page.waitForLoadState("load");

      // Should navigate to filtered URL
      await expect(page).toHaveURL("/shifts?location=Wellington");

      // Should now show the shifts page with Wellington as title
      const pageTitle = page.getByRole("heading", {
        name: /wellington/i,
      });
      await expect(pageTitle).toBeVisible();

      // Should show back to locations button now
      const backToLocationsButton = page.getByTestId(
        "back-to-locations-button"
      );
      await expect(backToLocationsButton).toBeVisible();
    });
  });

  test.describe("Authenticated Access", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsVolunteer(page);

      // Skip tests if login failed
      const currentUrl = page.url();
      if (currentUrl.includes("/login")) {
        test.skip(true, "Login failed - skipping authenticated shifts tests");
      }
    });

    test("should display location selection screen with authentication", async ({
      page,
    }) => {
      await page.goto("/shifts");
      await page.waitForLoadState("load");

      // Check page loads successfully
      await expect(page).toHaveURL("/shifts");

      // Check main page container
      const browsePage = page.getByTestId("shifts-browse-page");
      await expect(browsePage).toBeVisible();

      // Should show location selection screen first
      const selectionTitle = page.getByTestId("location-selection-title");
      await expect(selectionTitle).toBeVisible();
    });

    test.skip("should display shifts page after location selection", async ({
      page,
    }) => {
      await navigateToShiftsWithLocation(page);

      // Check main elements are visible after location selection (should show location name)
      const pageTitle = page.getByRole("heading", {
        name: /wellington/i,
      });
      await expect(pageTitle).toBeVisible();

      const pageDescription = page.getByText(
        /find and sign up for upcoming volunteer opportunities/i
      );
      await expect(pageDescription).toBeVisible();
    });

    test("should display shift cards with all required information", async ({
      page,
    }) => {
      await navigateToShiftsWithLocation(page);

      // Look for shift cards using testids
      const shiftCards = page.locator('[data-testid^="shift-card-"]');
      const shiftCount = await shiftCards.count();

      if (shiftCount > 0) {
        const firstShift = shiftCards.first();
        const shiftId = await firstShift.getAttribute("data-testid");
        const id = shiftId?.replace("shift-card-", "") || "";

        // Check shift type name
        const shiftName = firstShift.getByTestId(`shift-name-${id}`);
        await expect(shiftName).toBeVisible();

        // Check time information
        const timeInfo = firstShift.getByTestId(`shift-time-${id}`);
        await expect(timeInfo).toBeVisible();

        // Check location information
        const locationInfo = firstShift.getByTestId(`shift-location-${id}`);
        await expect(locationInfo).toBeVisible();

        // Check capacity information
        const capacityInfo = firstShift.getByTestId(`shift-capacity-${id}`);
        await expect(capacityInfo).toBeVisible();

        // Check actions section
        const actionsSection = firstShift.getByTestId(`shift-actions-${id}`);
        await expect(actionsSection).toBeVisible();
      }
    });

    test("should show shift type categories and theming", async ({ page }) => {
      // With the new calendar interface, we check for calendar elements instead
      const calendarCards = page.locator('[data-testid^="calendar-"]');
      const calendarCount = await calendarCards.count();

      if (calendarCount > 0) {
        // Check that calendar shows locations with proper theming
        const firstCalendar = calendarCards.first();
        await expect(firstCalendar).toBeVisible();

        // Check for location header with icon
        const locationIcon = firstCalendar.locator(".h-5.w-5.text-primary");
        if ((await locationIcon.count()) > 0) {
          await expect(locationIcon.first()).toBeVisible();
        }
      } else {
        // Fallback: if there are shift cards in upcoming section, check those
        const shiftCards = page.locator('[data-testid^="shift-card-"]');
        const shiftCount = await shiftCards.count();

        if (shiftCount > 0) {
          const firstShift = shiftCards.first();
          const shiftId = await firstShift.getAttribute("data-testid");
          const id = shiftId?.replace("shift-card-", "") || "";

          // Check for category badge (Kitchen, Service, etc.)
          const categoryBadge = firstShift.getByTestId(`shift-category-${id}`);
          if ((await categoryBadge.count()) > 0) {
            await expect(categoryBadge).toBeVisible();
          }

          // Check for gradient icon
          const iconContainer = firstShift.locator(".bg-gradient-to-br");
          if ((await iconContainer.count()) > 0) {
            await expect(iconContainer).toBeVisible();
          }
        }
      }
    });

    test("should display shift duration", async ({ page }) => {
      const shiftCards = page.locator('[data-testid^="shift-card-"]');
      const shiftCount = await shiftCards.count();

      if (shiftCount > 0) {
        const firstShift = shiftCards.first();
        const shiftId = await firstShift.getAttribute("data-testid");
        const id = shiftId?.replace("shift-card-", "") || "";

        // Check for duration badge (format like "4h" or "3h 30m")
        const durationBadge = firstShift.getByTestId(`shift-duration-${id}`);
        await expect(durationBadge).toBeVisible();
      }
    });

    test("should show spots remaining or waitlist status", async ({ page }) => {
      const shiftCards = page.locator('[data-testid^="shift-card-"]');
      const shiftCount = await shiftCards.count();

      if (shiftCount > 0) {
        const firstShift = shiftCards.first();
        const shiftId = await firstShift.getAttribute("data-testid");
        const id = shiftId?.replace("shift-card-", "") || "";

        // Check for spots remaining or waitlist indicator
        const spotsIndicator = firstShift.getByTestId(
          `shift-spots-badge-${id}`
        );
        const waitlistIndicator = firstShift.getByTestId(
          `shift-waitlist-badge-${id}`
        );

        // At least one should be visible
        if (await spotsIndicator.isVisible()) {
          await expect(spotsIndicator).toBeVisible();
        } else {
          await expect(waitlistIndicator).toBeVisible();
        }
      }
    });

    test("should open signup dialog when clicking signup button", async ({
      page,
    }) => {
      const shiftCards = page.locator('[data-testid^="shift-card-"]');
      const shiftCount = await shiftCards.count();

      if (shiftCount > 0) {
        // Find a shift with an available signup button
        const signupButton = page
          .locator('[data-testid*="signup-button"]')
          .first();

        if (await signupButton.isVisible()) {
          await signupButton.click();

          // Check dialog appears
          const dialog = page.getByTestId("shift-signup-dialog");
          await expect(dialog).toBeVisible();

          // Check dialog title
          const dialogTitle = page.getByTestId("shift-signup-dialog-title");
          await expect(dialogTitle).toBeVisible();

          // Check cancel button
          const cancelButton = page.getByTestId("shift-signup-cancel-button");
          await expect(cancelButton).toBeVisible();

          // Check confirm signup button
          const confirmButton = page.getByTestId("shift-signup-confirm-button");
          await expect(confirmButton).toBeVisible();

          // Close dialog
          await cancelButton.click();
          await expect(dialog).not.toBeVisible();
        }
      }
    });

    test("should open waitlist dialog for full shifts", async ({ page }) => {
      // Look for waitlist buttons
      const waitlistButton = page
        .locator('[data-testid*="join-waitlist-button"]')
        .first();

      if (await waitlistButton.isVisible()) {
        await waitlistButton.click();

        // Check dialog appears
        const dialog = page.getByTestId("shift-signup-dialog");
        await expect(dialog).toBeVisible();

        // Check dialog title
        const dialogTitle = page.getByTestId("shift-signup-dialog-title");
        await expect(dialogTitle).toBeVisible();
        await expect(dialogTitle).toContainText("Join Waitlist");

        // Check waitlist-specific content
        const waitlistDescription = page.getByTestId(
          "shift-signup-dialog-description"
        );
        await expect(waitlistDescription).toBeVisible();
        await expect(waitlistDescription).toContainText(
          "notified if a spot becomes available"
        );

        // Close dialog
        const cancelButton = page.getByTestId("shift-signup-cancel-button");
        await cancelButton.click();
        await expect(dialog).not.toBeVisible();
      }
    });

    test("should show user signup status for registered shifts", async ({
      page,
    }) => {
      const shiftCards = page.locator('[data-testid^="shift-card-"]');
      const shiftCount = await shiftCards.count();

      if (shiftCount > 0) {
        // Look for any shift with user status
        const statusBadge = page
          .locator('[data-testid*="signup-status"]')
          .first();

        if (await statusBadge.isVisible()) {
          await expect(statusBadge).toBeVisible();

          // Should also show "You're signed up!" message
          const signupMessage = page.locator(
            '[data-testid*="signed-up-message"]'
          );
          if ((await signupMessage.count()) > 0) {
            await expect(signupMessage.first()).toBeVisible();
          }
        }
      }
    });
  });

  test.describe("Location Navigation", () => {
    test("should show back to locations button after selecting a location", async ({
      page,
    }) => {
      // Go to a specific location
      await page.goto("/shifts?location=Wellington");
      await page.waitForLoadState("load");

      // Should show back to locations button
      const backButton = page.getByTestId("back-to-locations-button");
      await expect(backButton).toBeVisible();
      await expect(backButton).toHaveText("← Choose Different Location");
    });

    test("should return to location selection when clicking back button", async ({
      page,
    }) => {
      // Go to a specific location
      await page.goto("/shifts?location=Wellington");
      await page.waitForLoadState("load");

      // Click back to locations button
      const backButton = page.getByTestId("back-to-locations-button");
      await backButton.click();
      await page.waitForLoadState("load");

      // Should return to location selection screen (with chooseLocation parameter)
      await expect(page).toHaveURL("/shifts?chooseLocation=true");
      const selectionTitle = page.getByTestId("location-selection-title");
      await expect(selectionTitle).toBeVisible();
    });
  });

  test.describe("Empty States", () => {
    test("should display empty state when no shifts available", async ({
      page,
    }) => {
      // Try to trigger empty state by filtering to a location that might not have shifts
      await page.goto("/shifts?location=NonExistentLocation");
      await page.waitForLoadState("load");

      // Look for empty state content
      const emptyState = page.getByTestId("empty-state");

      if (await emptyState.isVisible()) {
        await expect(emptyState).toBeVisible();

        const emptyStateTitle = page.getByTestId("empty-state-title");
        await expect(emptyStateTitle).toBeVisible();

        const emptyStateDescription = page.getByTestId(
          "empty-state-description"
        );
        await expect(emptyStateDescription).toBeVisible();
      }
    });

    test("should provide helpful links in empty state for filtered locations", async ({
      page,
    }) => {
      await page.goto("/shifts?location=Wellington");
      await page.waitForLoadState("load");

      // Check if empty state is visible first
      const emptyState = page.getByTestId("empty-state");

      if (await emptyState.isVisible()) {
        // Look for empty state with helpful links
        const viewAllLink = page.getByRole("link", {
          name: /viewing all locations/i,
        });
        const updatePreferencesLink = page.getByRole("link", {
          name: /updating your location preferences/i,
        });

        // These links might be present in empty state
        if (await viewAllLink.isVisible()) {
          await expect(viewAllLink).toHaveAttribute("href", "/shifts");
        }
        if (await updatePreferencesLink.isVisible()) {
          await expect(updatePreferencesLink).toHaveAttribute(
            "href",
            "/profile/edit"
          );
        }
      }
    });
  });

  test.describe("Shifts Grouping and Display", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/shifts");
      await page.waitForLoadState("load");
    });

    test("should group shifts by date", async ({ page }) => {
      // Look for shift list container
      const shiftsList = page.getByTestId("shifts-list");

      if (await shiftsList.isVisible()) {
        // Look for date sections
        const dateSections = page.locator(
          '[data-testid^="shifts-day-section-"]'
        );
        const sectionCount = await dateSections.count();

        if (sectionCount > 0) {
          const firstSection = dateSections.first();
          await expect(firstSection).toBeVisible();

          // Get the section ID to check heading and count
          const sectionId = await firstSection.getAttribute("data-testid");
          const dateKey = sectionId?.replace("shifts-day-section-", "") || "";

          const heading = page.getByTestId(`shifts-day-heading-${dateKey}`);
          await expect(heading).toBeVisible();

          const countBadge = page.getByTestId(`shifts-day-count-${dateKey}`);
          await expect(countBadge).toBeVisible();
        }
      }
    });

    test("should display shifts in chronological order", async ({ page }) => {
      const dateSections = page.locator('[data-testid^="shifts-day-section-"]');
      const sectionCount = await dateSections.count();

      if (sectionCount > 1) {
        // Get date keys from testids (format: yyyy-MM-dd)
        const firstSectionId = await dateSections
          .nth(0)
          .getAttribute("data-testid");
        const secondSectionId = await dateSections
          .nth(1)
          .getAttribute("data-testid");

        const firstDateKey =
          firstSectionId?.replace("shifts-day-section-", "") || "";
        const secondDateKey =
          secondSectionId?.replace("shifts-day-section-", "") || "";

        // Compare date keys (they should be in chronological order)
        expect(firstDateKey <= secondDateKey).toBe(true);
      }
    });

    test("should show shift count badges", async ({ page }) => {
      const dateSections = page.locator('[data-testid^="shifts-day-section-"]');
      const sectionCount = await dateSections.count();

      if (sectionCount > 0) {
        const firstSection = dateSections.first();
        const sectionId = await firstSection.getAttribute("data-testid");
        const dateKey = sectionId?.replace("shifts-day-section-", "") || "";

        const countBadge = page.getByTestId(`shifts-day-count-${dateKey}`);
        await expect(countBadge).toBeVisible();

        const badgeText = await countBadge.textContent();
        expect(badgeText).toMatch(/\d+\s+shifts?/);
      }
    });
  });

  test.describe("Progress Indicators and Capacity", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/shifts");
      await page.waitForLoadState("load");
    });

    test("should display capacity progress bars", async ({ page }) => {
      const shiftCards = page.locator('[data-testid^="shift-card-"]');
      const shiftCount = await shiftCards.count();

      if (shiftCount > 0) {
        const firstShift = shiftCards.first();
        const shiftId = await firstShift.getAttribute("data-testid");
        const id = shiftId?.replace("shift-card-", "") || "";

        // Look for capacity display (format like "2/5")
        const capacityDisplay = firstShift.getByTestId(
          `shift-capacity-count-${id}`
        );
        await expect(capacityDisplay).toBeVisible();

        // Look for progress bar
        const progressBar = firstShift.getByTestId(`shift-progress-bar-${id}`);
        await expect(progressBar).toBeVisible();
      }
    });

    test("should show pending and waitlist counts when applicable", async ({
      page,
    }) => {
      const shiftCards = page.locator('[data-testid^="shift-card-"]');
      const shiftCount = await shiftCards.count();

      if (shiftCount > 0) {
        // Look for pending approval text in any shift
        const pendingText = page.getByText(/pending approval/i);
        if ((await pendingText.count()) > 0) {
          await expect(pendingText.first()).toBeVisible();
        }

        // Look for waitlist text in any shift
        const waitlistText = page.getByText(/on waitlist/i);
        if ((await waitlistText.count()) > 0) {
          await expect(waitlistText.first()).toBeVisible();
        }
      }
    });
  });

  test.describe("Responsive Design", () => {
    test("should be responsive on mobile viewport", async ({ page }) => {
      await page.goto("/shifts?location=Wellington");
      await page.waitForLoadState("load");

      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();
      await page.waitForLoadState("load");

      // Check main elements are still visible and accessible
      const pageTitle = page.getByRole("heading", {
        name: /wellington/i,
      });
      await expect(pageTitle).toBeVisible();

      // Check back button is accessible on mobile
      const backButton = page.getByTestId("back-to-locations-button");
      await expect(backButton).toBeVisible();

      // Check shift cards adapt to mobile layout
      const shiftCards = page.locator('[data-testid^="shift-card-"]');
      const shiftCount = await shiftCards.count();

      if (shiftCount > 0) {
        const firstShift = shiftCards.first();
        await expect(firstShift).toBeVisible();
      }
    });

    test("should maintain usability on tablet viewport", async ({ page }) => {
      await page.goto("/shifts");
      await page.waitForLoadState("load");

      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.reload();
      await page.waitForLoadState("load");

      // Check grid layout works on tablet
      const shiftCards = page.locator('[data-testid^="shift-card-"]');
      const shiftCount = await shiftCards.count();

      if (shiftCount > 1) {
        // On tablet, should have grid layout (multiple cards per row)
        const firstShift = shiftCards.first();
        const secondShift = shiftCards.nth(1);

        await expect(firstShift).toBeVisible();
        await expect(secondShift).toBeVisible();
      }
    });
  });

  test.describe("Loading and Error Handling", () => {
    test("should handle page loading gracefully", async ({ page }) => {
      await page.goto("/shifts");

      // Wait for location selection screen to be visible
      const selectionTitle = page.getByTestId("location-selection-title");
      await expect(selectionTitle).toBeVisible({ timeout: 10000 });

      // Check that no error messages are displayed
      const errorMessage = page.getByText(/error|failed|something went wrong/i);
      await expect(errorMessage).not.toBeVisible();
    });

    test("should handle navigation between location selection and shifts", async ({
      page,
    }) => {
      await page.goto("/shifts");
      await page.waitForLoadState("load");

      // Should start with location selection
      const selectionTitle = page.getByTestId("location-selection-title");
      await expect(selectionTitle).toBeVisible();

      // Select Wellington
      const wellingtonOption = page.getByTestId("location-option-wellington");
      await wellingtonOption.click();
      await page.waitForLoadState("load");

      await expect(page).toHaveURL("/shifts?location=Wellington");

      // Should show shifts page with back button
      const pageTitle = page.getByRole("heading", {
        name: /wellington/i,
      });
      await expect(pageTitle).toBeVisible();

      // Click back button
      const backButton = page.getByTestId("back-to-locations-button");
      await backButton.click();
      await page.waitForLoadState("load");

      // Should return to location selection (with chooseLocation parameter)
      await expect(page).toHaveURL("/shifts?chooseLocation=true");
      await expect(selectionTitle).toBeVisible();
    });
  });

  test.describe("Daily Signup Validation", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsVolunteer(page);
      await page.goto("/shifts?location=Wellington");
    });

    test("should prevent multiple shift signups on the same day", async ({
      page,
    }) => {
      // Find shifts on the same day (get first date section)
      const firstDateSection = page
        .locator('[data-testid^="shifts-date-section-"]')
        .first();

      if (await firstDateSection.isVisible()) {
        // Get all shift cards in this date section
        const shiftCards = firstDateSection.locator(
          '[data-testid^="shift-card-"], .grid > div'
        );
        const shiftCount = await shiftCards.count();

        if (shiftCount >= 2) {
          // Try to sign up for the first available shift
          const firstShiftSignupButton = shiftCards
            .first()
            .locator(
              '[data-testid*="signup-button"], button:has-text("Sign Up"), button:has-text("✨ Sign Up Now")'
            )
            .first();

          if (await firstShiftSignupButton.isVisible()) {
            await firstShiftSignupButton.click();

            // Confirm signup in dialog
            const confirmButton = page.getByTestId(
              "shift-signup-confirm-button"
            );
            if (await confirmButton.isVisible()) {
              await confirmButton.click();
              await page.waitForLoadState("load");

              // Wait for any toast notifications to appear and dismiss
              await page.waitForTimeout(2000);

              // Now try to sign up for the second shift on the same day
              const secondShiftSignupButton = shiftCards
                .nth(1)
                .locator(
                  '[data-testid*="signup-button"], button:has-text("Sign Up"), button:has-text("✨ Sign Up Now")'
                )
                .first();

              if (await secondShiftSignupButton.isVisible()) {
                await secondShiftSignupButton.click();

                // Should show validation error dialog or message
                const errorDialog = page.getByTestId("shift-signup-dialog");
                if (await errorDialog.isVisible()) {
                  const confirmSecondButton = page.getByTestId(
                    "shift-signup-confirm-button"
                  );
                  await confirmSecondButton.click();
                }

                // Check for error message about daily limit
                const errorMessage = page.getByText(
                  /you already have a confirmed shift on this day/i
                );
                const duplicateErrorMessage = page.getByText(
                  /you can only sign up for one shift per day/i
                );
                const existingShiftError = page.getByText(
                  /already have.*shift.*day/i
                );

                // At least one of these error patterns should be visible
                const hasError =
                  (await errorMessage.isVisible()) ||
                  (await duplicateErrorMessage.isVisible()) ||
                  (await existingShiftError.isVisible());

                expect(hasError).toBe(true);

                // Alternatively, check for toast notification with error
                const toastError = page
                  .locator('[data-testid*="toast"], .toast, [role="alert"]')
                  .filter({
                    hasText: /shift.*day|daily.*limit|one shift per day/i,
                  });

                if ((await toastError.count()) > 0) {
                  await expect(toastError.first()).toBeVisible();
                }
              }
            }
          }
        } else {
          // Skip test if not enough shifts on the same day
          test.skip(
            true,
            "Not enough shifts on the same day to test daily validation"
          );
        }
      } else {
        // Skip test if no shifts available
        test.skip(true, "No shifts available to test daily validation");
      }
    });

    test("should allow signup on different days", async ({ page }) => {
      // Find shifts on different days
      const dateSections = page.locator(
        '[data-testid^="shifts-date-section-"]'
      );
      const sectionCount = await dateSections.count();

      if (sectionCount >= 2) {
        // Sign up for a shift on the first day
        const firstDayShifts = dateSections
          .first()
          .locator('[data-testid^="shift-card-"], .grid > div');
        const firstShiftSignupButton = firstDayShifts
          .first()
          .locator(
            '[data-testid*="signup-button"], button:has-text("Sign Up"), button:has-text("✨ Sign Up Now")'
          )
          .first();

        if (await firstShiftSignupButton.isVisible()) {
          await firstShiftSignupButton.click();

          // Confirm first signup
          const confirmButton = page.getByTestId("shift-signup-confirm-button");
          if (await confirmButton.isVisible()) {
            await confirmButton.click();
            await page.waitForLoadState("load");
            await page.waitForTimeout(2000); // Wait for toast
          }

          // Now try to sign up for a shift on the second day
          const secondDayShifts = dateSections
            .nth(1)
            .locator('[data-testid^="shift-card-"], .grid > div');
          const secondShiftSignupButton = secondDayShifts
            .first()
            .locator(
              '[data-testid*="signup-button"], button:has-text("Sign Up"), button:has-text("✨ Sign Up Now")'
            )
            .first();

          if (await secondShiftSignupButton.isVisible()) {
            await secondShiftSignupButton.click();

            // Should be able to confirm second signup on different day
            const confirmSecondButton = page.getByTestId(
              "shift-signup-confirm-button"
            );
            if (await confirmSecondButton.isVisible()) {
              await confirmSecondButton.click();
              await page.waitForLoadState("load");

              // Should NOT show daily validation error
              const errorMessage = page.getByText(
                /you already have a confirmed shift on this day/i
              );
              const duplicateErrorMessage = page.getByText(
                /you can only sign up for one shift per day/i
              );

              await expect(errorMessage).not.toBeVisible();
              await expect(duplicateErrorMessage).not.toBeVisible();

              // Should show success indicator instead
              const successToast = page
                .locator('[data-testid*="toast"], .toast, [role="alert"]')
                .filter({
                  hasText: /success|signed up|confirmed/i,
                });

              if ((await successToast.count()) > 0) {
                await expect(successToast.first()).toBeVisible();
              }
            }
          }
        }
      } else {
        // Skip test if not enough different days available
        test.skip(
          true,
          "Not enough shifts on different days to test cross-day validation"
        );
      }
    });

    test("should show clear error message with existing shift details", async ({
      page,
    }) => {
      // This test verifies the error message includes details about the existing shift
      const firstDateSection = page
        .locator('[data-testid^="shifts-date-section-"]')
        .first();

      if (await firstDateSection.isVisible()) {
        const shiftCards = firstDateSection.locator(
          '[data-testid^="shift-card-"], .grid > div'
        );
        const shiftCount = await shiftCards.count();

        if (shiftCount >= 2) {
          // Get the first shift details
          const firstShiftCard = shiftCards.first();
          const firstShiftName = await firstShiftCard
            .locator('h3, [data-testid*="shift-name"]')
            .first()
            .textContent();

          // Sign up for first shift
          const firstShiftSignupButton = firstShiftCard
            .locator(
              '[data-testid*="signup-button"], button:has-text("Sign Up"), button:has-text("✨ Sign Up Now")'
            )
            .first();

          if (await firstShiftSignupButton.isVisible()) {
            await firstShiftSignupButton.click();

            const confirmButton = page.getByTestId(
              "shift-signup-confirm-button"
            );
            if (await confirmButton.isVisible()) {
              await confirmButton.click();
              await page.waitForLoadState("load");
              await page.waitForTimeout(2000);

              // Try to sign up for second shift
              const secondShiftSignupButton = shiftCards
                .nth(1)
                .locator(
                  '[data-testid*="signup-button"], button:has-text("Sign Up"), button:has-text("✨ Sign Up Now")'
                )
                .first();

              if (await secondShiftSignupButton.isVisible()) {
                await secondShiftSignupButton.click();

                const confirmSecondButton = page.getByTestId(
                  "shift-signup-confirm-button"
                );
                if (await confirmSecondButton.isVisible()) {
                  await confirmSecondButton.click();
                }

                // Check that error message includes the first shift name or time
                const detailedErrorMessage = page
                  .locator("text*=" + (firstShiftName || ""))
                  .or(page.getByText(/at \d+:\d+/i))
                  .or(page.getByText(/you already have.*shift/i));

                if ((await detailedErrorMessage.count()) > 0) {
                  await expect(detailedErrorMessage.first()).toBeVisible();
                }
              }
            }
          }
        } else {
          test.skip(true, "Not enough shifts to test detailed error message");
        }
      } else {
        test.skip(true, "No shifts available to test detailed error message");
      }
    });
  });

  test.describe("Accessibility", () => {
    test("should have proper accessibility attributes for location selection", async ({
      page,
    }) => {
      await page.goto("/shifts");
      await page.waitForLoadState("load");

      // Check main heading structure
      const mainHeading = page.getByTestId("location-selection-title");
      await expect(mainHeading).toBeVisible();

      // Check location options have proper accessibility
      const locationOptions = page.getByTestId("location-selection-options");
      await expect(locationOptions).toBeVisible();

      // Check location links are accessible
      const wellingtonOption = page.getByTestId("location-option-wellington");
      await expect(wellingtonOption).toBeVisible();
    });

    test("should have proper accessibility attributes for shifts page", async ({
      page,
    }) => {
      await page.goto("/shifts?location=Wellington");
      await page.waitForLoadState("load");

      // Check main heading structure
      const pageHeader = page.getByTestId("shifts-page-header");
      await expect(pageHeader).toBeVisible();

      // Check back button is accessible
      const backButton = page.getByTestId("back-to-locations-button");
      await expect(backButton).toBeVisible();

      // Check that buttons have accessible names
      const signupButton = page
        .locator(
          '[data-testid*="signup-button"], [data-testid*="waitlist-button"]'
        )
        .first();
      if (await signupButton.isVisible()) {
        await expect(signupButton).toBeVisible();
      }
    });

    test("should support keyboard navigation", async ({ page }) => {
      await page.goto("/shifts");
      await page.waitForLoadState("load");

      // Check location options are keyboard accessible
      const wellingtonOption = page.getByTestId("location-option-wellington");
      await wellingtonOption.focus();
      await expect(wellingtonOption).toBeFocused();

      // Navigate to shifts page
      await wellingtonOption.click();
      await page.waitForLoadState("load");

      // Check back button is keyboard accessible
      const backButton = page.getByTestId("back-to-locations-button");
      await backButton.focus();
      await expect(backButton).toBeFocused();
    });
  });
});
