import { test, expect } from "./base";
import type { Page } from "@playwright/test";
import { loginAsAdmin, loginAsVolunteer } from "./helpers/auth";
import { createTestUser, deleteTestUsers } from "./helpers/test-helpers";
import { randomUUID } from "crypto";

// Helper function to wait for page to load completely
async function waitForPageLoad(page: Page) {
  await page.waitForLoadState("load");
  await page.waitForTimeout(500); // Small buffer for animations
}

// Helper function to select date of birth using the hidden input for tests
async function selectDateOfBirth(page: Page, birthYear: number) {
  // Use the hidden date input for reliable test interaction
  // Format: YYYY-MM-DD (July 15th of the birth year)
  const month = "07"; // July
  const day = "15";
  const dateString = `${birthYear}-${month}-${day}`;

  // Use force: true since the input is visually hidden but functional
  await page
    .getByTestId("date-of-birth-hidden-input")
    .fill(dateString, { force: true });
  await waitForPageLoad(page);
}

// Helper function to create and login as an underage user
async function createAndLoginAsUnderageUser(page: Page) {
  const userEmail = `underage.test.${randomUUID().slice(0, 8)}@example.com`;

  // Create underage user via API (much faster than UI registration)
  const fifteenYearsAgo = new Date();
  fifteenYearsAgo.setFullYear(fifteenYearsAgo.getFullYear() - 15);

  await createTestUser(page, userEmail, "VOLUNTEER", {
    firstName: "Emma",
    lastName: "Parker",
    dateOfBirth: fifteenYearsAgo.toISOString(),
    requiresParentalConsent: true,
    parentalConsentReceived: false,
  });

  // Login as the underage user
  await loginAsVolunteer(page, userEmail);
  await waitForPageLoad(page);

  return userEmail;
}

test.describe("Parental Consent System", () => {
  test.describe("Registration Flow for Minors", () => {
    test("should show parental consent notice during registration for users under 16", async ({
      page,
    }) => {
      await page.goto("/register");
      await waitForPageLoad(page);

      // Step 1: Account credentials
      await page.getByTestId("email-input").fill("minor.test@example.com");
      await page.getByTestId("password-input").fill("Password123!");
      await page.getByTestId("confirm-password-input").fill("Password123!");
      await page.getByTestId("next-submit-button").click();
      await waitForPageLoad(page);

      // Step 2: Enter birth date that makes user 16 years old
      await page.getByRole("textbox", { name: /first name/i }).fill("Test");
      await page.getByRole("textbox", { name: /last name/i }).fill("Minor");
      await page
        .getByRole("textbox", { name: /mobile number/i })
        .fill("(555) 123-4567");

      const birthYear = new Date().getFullYear() - 16;
      await selectDateOfBirth(page, birthYear);

      // Should show parental consent notice
      await expect(page.getByTestId("parental-consent-notice")).toBeVisible();
      await expect(page.getByText("Parental Consent Required")).toBeVisible();
      await expect(
        page.getByText("You can continue registering now")
      ).toBeVisible();
      await expect(
        page.getByTestId("download-consent-form-button")
      ).toBeVisible();
    });

    test("should allow downloading parental consent form during registration", async ({
      page,
    }) => {
      await page.goto("/register");
      await waitForPageLoad(page);

      // Navigate to step 2 with underage user
      await page.getByTestId("email-input").fill("minor.test2@example.com");
      await page.getByTestId("password-input").fill("Password123!");
      await page.getByTestId("confirm-password-input").fill("Password123!");
      await page.getByTestId("next-submit-button").click();
      await waitForPageLoad(page);

      await page.getByRole("textbox", { name: /first name/i }).fill("Test");
      await page.getByRole("textbox", { name: /last name/i }).fill("Minor");
      await page
        .getByRole("textbox", { name: /mobile number/i })
        .fill("(555) 123-4567");

      // Use age offset that makes user UNDER 16 (e.g., 15 years old)
      const birthYear = new Date().getFullYear() - 15;
      await selectDateOfBirth(page, birthYear);

      // Test PDF download
      const downloadPromise = page.waitForEvent("download");
      await page.getByTestId("download-consent-form-button").click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe("parental-consent-form.pdf");
    });

    test("should allow underage users to complete registration despite parental consent requirement", async ({
      page,
    }) => {
      // Use dynamic email to avoid conflicts with previous test runs
      const email = `complete.minor.${Date.now()}@example.com`;

      // Complete registration steps up to the final submit
      await page.goto("/register");
      await waitForPageLoad(page);

      // Step 1: Account credentials
      await page.getByTestId("email-input").fill(email);
      await page.getByTestId("password-input").fill("Password123!");
      await page.getByTestId("confirm-password-input").fill("Password123!");
      await page.getByTestId("next-submit-button").click();
      await waitForPageLoad(page);

      // Step 2: Personal information with underage birth date
      await page.getByRole("textbox", { name: /first name/i }).fill("Emma");
      await page.getByRole("textbox", { name: /last name/i }).fill("Parker");
      await page
        .getByRole("textbox", { name: /mobile number/i })
        .fill("(555) 123-4567");

      const birthYear = new Date().getFullYear() - 15;
      await selectDateOfBirth(page, birthYear);

      await page.getByTestId("next-submit-button").click();
      await waitForPageLoad(page);

      // Step 3: Emergency contact
      await page
        .getByRole("textbox", { name: /emergency contact name/i })
        .fill("Sarah Parker");
      await page
        .getByRole("textbox", { name: /emergency contact phone/i })
        .fill("(555) 987-6543");
      await page.getByTestId("next-submit-button").click();
      await waitForPageLoad(page);

      // Step 4: Medical & Background
      await page
        .getByRole("combobox", { name: /how did you hear about us/i })
        .click();
      await page.getByRole("option", { name: /friend/i }).click();
      await page.getByTestId("next-submit-button").click();
      await waitForPageLoad(page);

      // Step 5: Availability
      await page.getByTestId("next-submit-button").click();
      await waitForPageLoad(page);

      // Step 6: Agreements
      await page
        .getByText(/I have read and agree with the Volunteer Agreement/)
        .click();
      await waitForPageLoad(page);
      await page.evaluate(() => {
        const scrollContainer = document.querySelector(".overflow-y-auto");
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
      });
      await page
        .getByRole("button", { name: /i agree to these terms/i })
        .click();
      await waitForPageLoad(page);

      await page
        .getByText(/I have read and agree with the Health and Safety Policy/)
        .click();
      await waitForPageLoad(page);
      await page.evaluate(() => {
        const scrollContainer = document.querySelector(".overflow-y-auto");
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
      });
      await page
        .getByRole("button", { name: /i agree to these terms/i })
        .click();
      await waitForPageLoad(page);

      // Wait for Create Account button to be enabled and click it
      const createAccountButton = page.getByRole("button", {
        name: /create account/i,
      });
      await createAccountButton.waitFor({ state: "visible" });
      await expect(createAccountButton).toBeEnabled();

      // Click and wait for redirect (use separate click then wait to avoid race)
      await createAccountButton.click();

      // Wait for either login page or dashboard redirect
      await page.waitForURL(/\/(login|dashboard)/, { timeout: 30000 });
      await waitForPageLoad(page);

      // Should be on login or dashboard
      const currentUrl = page.url();
      expect(currentUrl).toMatch(/\/(login|dashboard)/);
    });
  });

  test.describe("Dashboard Experience for Minors", () => {
    test("should show parental consent banner for underage users without approval", async ({
      page,
    }) => {
      await createAndLoginAsUnderageUser(page);
      await waitForPageLoad(page);

      // Should show parental consent banner
      await expect(page.getByTestId("parental-consent-banner")).toBeVisible();
      await expect(page.getByText("Parental consent required")).toBeVisible();
      await expect(page.getByText("volunteer@everybodyeats.nz")).toBeVisible();
      await expect(page.getByText("Download Consent Form")).toBeVisible();
    });

    test("should allow downloading consent form from dashboard banner", async ({
      page,
    }) => {
      await createAndLoginAsUnderageUser(page);
      await waitForPageLoad(page);

      // Test PDF download from dashboard
      const downloadPromise = page.waitForEvent("download");
      await page.locator('button:has-text("Download Consent Form")').click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe("parental-consent-form.pdf");
    });
  });

  test.describe("Shift Access Restrictions", () => {
    test("should prevent underage users from signing up for shifts without parental consent", async ({
      page,
    }) => {
      await createAndLoginAsUnderageUser(page);
      await waitForPageLoad(page);

      // Navigate directly to Wellington shifts calendar
      await page.goto("/shifts?location=Wellington");
      await waitForPageLoad(page);

      // Click on a calendar day with shifts to navigate to details page
      const calendarDayLink = page
        .locator('a[href*="/shifts/details"]')
        .first();
      await expect(calendarDayLink).toBeVisible();
      await calendarDayLink.click();
      await waitForPageLoad(page);

      // Should show disabled signup button with parental consent message
      const disabledButton = page
        .getByTestId("shift-signup-button-disabled")
        .first();
      await expect(disabledButton).toBeVisible();
      await expect(disabledButton).toContainText("Parental Consent Required");
    });

    test("should show disabled signup buttons on shifts listing page for underage users", async ({
      page,
    }) => {
      await createAndLoginAsUnderageUser(page);
      await waitForPageLoad(page);

      // Navigate directly to Wellington shifts calendar
      await page.goto("/shifts?location=Wellington");
      await waitForPageLoad(page);

      // Click on a calendar day with shifts to navigate to details page
      const calendarDayLink = page
        .locator('a[href*="/shifts/details"]')
        .first();
      await expect(calendarDayLink).toBeVisible();
      await calendarDayLink.click();
      await waitForPageLoad(page);

      // Should show disabled buttons with parental consent message
      const disabledButton = page
        .getByTestId("shift-signup-button-disabled")
        .first();
      await expect(disabledButton).toBeVisible();
      await expect(disabledButton).toBeDisabled();
      await expect(disabledButton).toContainText("Parental Consent Required");
    });

    test("should show parental consent restrictions on shifts details page", async ({
      page,
    }) => {
      await createAndLoginAsUnderageUser(page);
      await waitForPageLoad(page);

      // Navigate directly to Wellington shifts calendar
      await page.goto("/shifts?location=Wellington");
      await waitForPageLoad(page);

      // Click on a calendar day with shifts to navigate to details page
      const calendarDayLink = page
        .locator('a[href*="/shifts/details"]')
        .first();
      await expect(calendarDayLink).toBeVisible();
      await calendarDayLink.click();
      await waitForPageLoad(page);

      // Should show disabled signup button indicating parental consent required
      const disabledButton = page
        .getByTestId("shift-signup-button-disabled")
        .first();
      await expect(disabledButton).toBeVisible();
      await expect(disabledButton).toContainText("Parental Consent Required");
    });
  });

  test.describe("Admin Parental Consent Management", () => {
    test("should allow admin to view parental consent requests", async ({
      page,
    }) => {
      await loginAsAdmin(page);
      await waitForPageLoad(page);

      // Navigate to admin parental consent page
      await page.goto("/admin/parental-consent");
      await waitForPageLoad(page);

      // Should show parental consent management page
      await expect(page.getByText("Parental Consent Management")).toBeVisible();
      await expect(page.getByText("volunteer@everybodyeats.nz")).toBeVisible();

      // Should show list of users requiring consent (use exact text match to avoid ambiguity)
      await expect(
        page.getByRole("heading", { name: "Pending Approval", exact: true })
      ).toBeVisible();
    });

    test("should show underage users in parental consent table", async ({
      page,
    }) => {
      await loginAsAdmin(page);
      await waitForPageLoad(page);

      // Navigate to parental consent management
      await page.getByTestId("sidebar-parental-consent").click();
      await waitForPageLoad(page);

      // Verify the pending table has at least one user row with name, age, and email
      const pendingTable = page.locator("table").first();
      const rows = pendingTable.locator("tbody tr");
      await expect(rows.first()).toBeVisible({ timeout: 10000 });

      // Each row should display user age in "N years" format
      await expect(rows.first().getByText(/\d+ years/)).toBeVisible();

      // Each row should have an email link
      await expect(
        rows.first().locator("a[href^='mailto:']").first()
      ).toBeVisible();
    });

    test("should allow admin to approve parental consent", async ({ page }) => {
      const testUnderageEmail = `underage-approve-${Date.now()}@example.com`;

      // Create test underage user with parental consent required but not received
      const fifteenYearsAgo = new Date();
      fifteenYearsAgo.setFullYear(fifteenYearsAgo.getFullYear() - 15);

      await createTestUser(page, testUnderageEmail, "VOLUNTEER", {
        firstName: "Underage",
        lastName: "Approvetest",
        dateOfBirth: fifteenYearsAgo.toISOString(),
        requiresParentalConsent: true,
        parentalConsentReceived: false,
      });

      await loginAsAdmin(page);
      await waitForPageLoad(page);

      // Navigate to parental consent management
      await page.getByTestId("sidebar-parental-consent").click();
      await waitForPageLoad(page);

      // Find the approve button for our test user
      const approveButton = page
        .getByRole("button", { name: /Approve/i })
        .first();
      await approveButton.click();

      // Confirm in dialog (button text is "Approve Consent")
      await page.getByRole("button", { name: "Approve Consent" }).click();
      await waitForPageLoad(page);

      // Should show success toast
      await expect(
        page.getByText(/Parental consent approved for/)
      ).toBeVisible();

      // Clean up
      await deleteTestUsers(page, [testUnderageEmail]);
    });

    test("should show approved users section when approved users exist", async ({
      page,
    }) => {
      // Create an approved underage user to ensure the section renders
      const approvedEmail = `underage-approved-${Date.now()}@example.com`;
      const fifteenYearsAgo = new Date();
      fifteenYearsAgo.setFullYear(fifteenYearsAgo.getFullYear() - 15);

      await createTestUser(page, approvedEmail, "VOLUNTEER", {
        firstName: "Approved",
        lastName: "Minor",
        dateOfBirth: fifteenYearsAgo.toISOString(),
        requiresParentalConsent: true,
        parentalConsentReceived: true,
      });

      await loginAsAdmin(page);
      await waitForPageLoad(page);

      // Navigate to parental consent management
      await page.getByTestId("sidebar-parental-consent").click();
      await waitForPageLoad(page);

      // Wait for the page content to load
      await page.waitForLoadState("networkidle");

      // The approved section should now render with our test user
      const approvedHeading = page
        .locator("h3")
        .filter({ hasText: /^Approved \(/ });
      await expect(approvedHeading).toBeVisible({ timeout: 10000 });

      // Approved table should have at least one user row
      const approvedSection = approvedHeading.locator("../..");
      const approvedTable = approvedSection.locator("table");
      const approvedRows = approvedTable.locator("tbody tr");
      await expect(approvedRows.first()).toBeVisible();

      // Clean up
      await deleteTestUsers(page, [approvedEmail]);
    });
  });

  test.describe("Age-Based Logic", () => {
    test("should not show parental consent notices for users 18 and older", async ({
      page,
    }) => {
      // Register user who is exactly 18
      await page.goto("/register");
      await waitForPageLoad(page);

      await page.getByTestId("email-input").fill("adult.user@example.com");
      await page.getByTestId("password-input").fill("Password123!");
      await page.getByTestId("confirm-password-input").fill("Password123!");
      await page.getByTestId("next-submit-button").click();
      await waitForPageLoad(page);

      await page.getByRole("textbox", { name: /first name/i }).fill("Adult");
      await page.getByRole("textbox", { name: /last name/i }).fill("User");
      await page
        .getByRole("textbox", { name: /mobile number/i })
        .fill("(555) 123-4567");

      // Set birth date to exactly 18 years ago
      const birthYear = new Date().getFullYear() - 18;
      await selectDateOfBirth(page, birthYear);

      // Should NOT show parental consent notice
      await expect(
        page.getByTestId("parental-consent-notice")
      ).not.toBeVisible();
    });
  });
});
