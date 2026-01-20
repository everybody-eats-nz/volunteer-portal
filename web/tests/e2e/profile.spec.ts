import { test, expect } from "./base";
import { loginAsVolunteer } from "./helpers/auth";

test.describe("Profile Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsVolunteer(page);

    // Navigate to profile and wait for it to load
    await page.goto("/profile");
    await page.waitForLoadState("domcontentloaded");
  });

  test("should display profile page with all main elements", async ({
    page,
  }) => {
    // Check page loads successfully
    await expect(page).toHaveURL("/profile");

    // Check main heading
    const pageHeading = page.getByRole("heading", { name: /your profile/i });
    await expect(pageHeading).toBeVisible();

    // Check description
    const description = page.getByText(
      /manage your volunteer account and track your impact/i
    );
    await expect(description.first()).toBeVisible();

    // Check profile header card is visible by finding the "Active Member" badge
    const activeMemberBadge = page.getByText("Active Member");
    await expect(activeMemberBadge.first()).toBeVisible();

    // Check edit profile button
    const editButton = page.getByRole("link", { name: /edit profile/i });
    await expect(editButton).toBeVisible();
    await expect(editButton).toHaveAttribute("href", "/profile/edit");
  });

  test("should display user information correctly", async ({ page }) => {
    // Check main profile avatar is visible (not the header avatar)
    const mainProfileAvatar = page
      .getByTestId("profile-page")
      .getByRole("img", { name: /profile/i });
    if ((await mainProfileAvatar.count()) > 0) {
      await expect(mainProfileAvatar).toBeVisible();
    }

    // Check user name is displayed
    const userName = page.locator("h2").filter({ hasText: /volunteer|admin/i });
    if ((await userName.count()) === 0) {
      // Fallback: look for any h2 that might contain the user name
      const anyH2 = page.locator("h2").first();
      await expect(anyH2).toBeVisible();
    } else {
      await expect(userName).toBeVisible();
    }

    // Check role badge
    const roleBadge = page.getByTestId("user-role");
    await expect(roleBadge).toBeVisible();

    // Check active member badge
    const activeBadge = page.getByText("Active Member");
    await expect(activeBadge.first()).toBeVisible();
  });

  test("should display personal information section", async ({ page }) => {
    // Check personal information heading
    const personalInfoHeading = page.getByTestId("personal-info-heading");
    await expect(personalInfoHeading).toBeVisible();

    // Check account details subheading
    const accountDetails = page.getByText("Your account details");
    await expect(accountDetails.first()).toBeVisible();

    // Check common fields that should always be present
    const nameLabel = page.getByTestId("personal-info-name-label");
    await expect(nameLabel).toBeVisible();

    const emailLabel = page.getByTestId("personal-info-email-label");
    await expect(emailLabel).toBeVisible();

    const accountTypeLabel = page.getByTestId(
      "personal-info-account-type-label"
    );
    await expect(accountTypeLabel).toBeVisible();
  });

  test("should display emergency contact section", async ({ page }) => {
    // Check emergency contact heading
    const emergencyHeading = page.getByTestId("emergency-contact-heading");
    await expect(emergencyHeading).toBeVisible();

    // Check section description
    const emergencyDescription = page.getByText(
      "Emergency contact information"
    );
    await expect(emergencyDescription.first()).toBeVisible();

    // Check either emergency contact info or empty state message
    const hasEmergencyContact =
      (await page
        .getByText("No emergency contact information provided")
        .count()) === 0;

    if (hasEmergencyContact) {
      // If emergency contact exists, check for name field
      const contactNameLabel = page.getByTestId("emergency-contact-name-label");
      await expect(contactNameLabel).toBeVisible();
    } else {
      // If no emergency contact, check for empty state message
      const noContactMessage = page.getByText(
        "No emergency contact information provided"
      );
      await expect(noContactMessage.first()).toBeVisible();
    }
  });

  test("should display availability section", async ({ page }) => {
    // Check availability heading
    const availabilityHeading = page.getByTestId("availability-heading");
    await expect(availabilityHeading).toBeVisible();

    // Check section description
    const availabilityDescription = page.getByText(
      "When and where you can volunteer"
    );
    await expect(availabilityDescription.first()).toBeVisible();

    // Check either availability info or empty state
    const hasAvailability =
      (await page.getByText("No availability preferences set").count()) === 0;

    if (hasAvailability) {
      // If availability exists, check for available days or locations
      const availableDaysLabel = page.getByText("Available Days:");
      const availableLocationsLabel = page.getByText("Available Locations:");

      const hasDays = (await availableDaysLabel.count()) > 0;
      const hasLocations = (await availableLocationsLabel.count()) > 0;

      expect(hasDays || hasLocations).toBe(true);
    } else {
      // If no availability, check for empty state message
      const noAvailabilityMessage = page.getByText(
        "No availability preferences set"
      );
      await expect(noAvailabilityMessage.first()).toBeVisible();
    }
  });

  test("should display quick actions section", async ({ page }) => {
    // Check quick actions heading
    const quickActionsHeading = page.getByTestId("quick-actions-heading");
    await expect(quickActionsHeading).toBeVisible();

    // Check section description
    const quickActionsDescription = page.getByText(
      "Manage your volunteer experience"
    );
    await expect(quickActionsDescription.first()).toBeVisible();

    // Check action buttons exist
    const browseShiftsButton = page.getByTestId("browse-shifts-button");
    await expect(browseShiftsButton).toBeVisible();
    await expect(browseShiftsButton).toContainText("Browse Available Shifts");

    const viewScheduleButton = page.getByTestId("view-schedule-button");
    await expect(viewScheduleButton).toBeVisible();
    await expect(viewScheduleButton).toContainText("View My Schedule");
  });

  test("should navigate to edit profile page", async ({ page }) => {
    const editButton = page.getByRole("link", { name: /edit profile/i });
    await editButton.click();

    await expect(page).toHaveURL("/profile/edit");
  });

  test("should navigate to browse shifts from quick actions", async ({
    page,
  }) => {
    // Check that the link exists and is clickable
    const browseShiftsLink = page
      .locator('a[href="/shifts"]')
      .filter({ hasText: "Browse Available Shifts" });
    await expect(browseShiftsLink.first()).toBeVisible();

    await browseShiftsLink.click();
    await page.waitForLoadState("load");

    await expect(page).toHaveURL("/shifts");
  });

  test("should navigate to my schedule from quick actions", async ({
    page,
  }) => {
    // Check that the link exists and is clickable
    const viewScheduleLink = page
      .locator('a[href="/shifts/mine"]')
      .filter({ hasText: "View My Schedule" });
    await expect(viewScheduleLink.first()).toBeVisible();

    await viewScheduleLink.click();
    await page.waitForLoadState("load");

    await expect(page).toHaveURL("/shifts/mine");
  });

  test("should be responsive on mobile viewport", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Check that main elements are still visible
    const pageHeading = page.getByRole("heading", { name: /your profile/i });
    await expect(pageHeading).toBeVisible();

    // Check profile card is visible
    const editButton = page.getByRole("link", { name: /edit profile/i });
    await expect(editButton).toBeVisible();

    // Check sections are accessible
    const personalInfoHeading = page.getByTestId("personal-info-heading");
    await expect(personalInfoHeading).toBeVisible();

    const quickActionsHeading = page.getByTestId("quick-actions-heading");
    await expect(quickActionsHeading).toBeVisible();
  });

  test("should require authentication", async ({ context }) => {
    // Create a new context (fresh browser session)
    const newContext = await context.browser()?.newContext();
    if (!newContext) throw new Error("Could not create new context");

    const newPage = await newContext.newPage();

    // Try to access profile directly without authentication
    await newPage.goto("/profile");

    // Should show sign in required message or redirect to login
    const signInRequired = newPage.getByText("Sign in required");
    const signInButton = newPage.getByRole("link", {
      name: /sign in to your account/i,
    });

    // Either we see the sign-in required message on the profile page
    // or we get redirected to login page
    try {
      await expect(signInRequired).toBeVisible({ timeout: 3000 });
      await expect(signInButton).toBeVisible();
    } catch {
      // If not on profile with sign-in message, should be redirected to login
      await expect(newPage).toHaveURL(/\/login/);
    }

    await newPage.close();
    await newContext.close();
  });

  test("should display badges correctly", async ({ page }) => {
    // Check role badge
    const badges = page
      .locator('[class*="badge"]')
      .or(page.getByText("Administrator").or(page.getByText("Volunteer")));
    const badgeCount = await badges.count();
    expect(badgeCount).toBeGreaterThan(0);

    // Check active member badge
    const activeBadge = page.getByText("Active Member");
    await expect(activeBadge.first()).toBeVisible();

    // Check for agreement signed badge if present
    const agreementBadge = page.getByText("Agreement Signed");
    if ((await agreementBadge.count()) > 0) {
      await expect(agreementBadge.first()).toBeVisible();
    }
  });

  test("should handle loading state gracefully", async ({ page }) => {
    // Navigate to profile and verify it loads without errors
    await page.goto("/profile");

    // Wait for the main content to be visible
    const pageHeading = page.getByRole("heading", { name: /your profile/i });
    await expect(pageHeading).toBeVisible({ timeout: 10000 });

    // Check that no error messages are displayed
    const errorMessage = page.getByText(/error|failed|something went wrong/i);
    await expect(errorMessage).not.toBeVisible();
  });

  test("should display accessibility attributes correctly", async ({
    page,
  }) => {
    // Check main landmark
    const main = page.locator("main").or(page.locator('[role="main"]'));
    if ((await main.count()) > 0) {
      await expect(main).toBeVisible();
    }

    // Check headings have proper hierarchy
    const headings = page.locator("h1, h2, h3, h4, h5, h6");
    const headingCount = await headings.count();
    expect(headingCount).toBeGreaterThan(0);

    // Check that links have accessible names
    const links = page.locator("a");
    const linkCount = await links.count();

    for (let i = 0; i < Math.min(linkCount, 5); i++) {
      // Check first 5 to avoid timeout
      const link = links.nth(i);
      const text = await link.textContent();
      const ariaLabel = await link.getAttribute("aria-label");

      // Link should have either text content or aria-label
      expect(text || ariaLabel).toBeTruthy();
    }
  });

  test("should display profile photo or initials", async ({ page }) => {
    // Check for avatar/profile image
    const avatar = page
      .locator('[data-slot="avatar"]')
      .or(page.locator('[class*="avatar"]'));

    if ((await avatar.count()) > 0) {
      await expect(avatar).toBeVisible();

      // Check if it has an image or shows initials
      const avatarImage = avatar.locator("img");
      const avatarFallback = avatar
        .locator('[class*="fallback"]')
        .or(page.locator('[class*="Avatar"][class*="Fallback"]'));

      const hasImage = (await avatarImage.count()) > 0;
      const hasFallback = (await avatarFallback.count()) > 0;

      expect(hasImage || hasFallback).toBe(true);
    }
  });

  test("should validate profile data display", async ({ page }) => {
    // Check name field - should not be empty
    const nameLabel = page.getByTestId("personal-info-name-label");
    await expect(nameLabel).toBeVisible();
    await expect(nameLabel).toContainText("Name");

    // Check email field - should not be empty
    const emailLabel = page.getByTestId("personal-info-email-label");
    await expect(emailLabel).toBeVisible();
    await expect(emailLabel).toContainText("Email");

    // Check account type - should be Volunteer or Administrator
    const accountTypeLabel = page.getByTestId(
      "personal-info-account-type-label"
    );
    await expect(accountTypeLabel).toBeVisible();
    await expect(accountTypeLabel).toContainText("Account Type");
  });

  test("should show complete profile reminder only for incomplete profiles", async ({ page }) => {
    // The "Complete your profile!" reminder only shows when profile is incomplete
    // (missing phone, date of birth, emergency contact, or agreements)
    const completeProfileMessage = page.getByText("Complete your profile!");

    // Check if reminder exists - it should only appear for incomplete profiles
    const reminderCount = await completeProfileMessage.count();

    if (reminderCount > 0) {
      // If reminder is shown, verify the full message is present
      const reminderText = page.getByText(
        /add your emergency contact, availability, and preferences/i
      );
      await expect(reminderText.first()).toBeVisible();
    }
    // If reminder is not shown, profile is complete - this is valid behavior
  });
});
