import { test, expect, Page } from "@playwright/test";
import { randomBytes } from "crypto";
import { addDays } from "date-fns";
import path from "path";
import { prisma } from "@/lib/prisma";

// Helper function to upload a test profile image
async function uploadTestImage(page: Page) {
  const testImagePath = path.join(__dirname, "../fixtures/test-profile.png");

  // Set up the file input for upload
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(testImagePath);

  // Wait for the cropping dialog to appear
  await page.waitForSelector('[data-testid="crop-dialog"]', { timeout: 10000 });

  // Click "Apply Crop" button in the dialog
  await page.click('[data-testid="apply-crop-button"]');

  // Wait for the dialog to close and image to be processed
  await page.waitForTimeout(2000);
}

// Helper function to accept agreements through dialogs
async function acceptAgreements(page: Page) {
  // Handle Volunteer Agreement
  await page.click("text=I have read and agree with the Volunteer Agreement");

  // Wait for dialog to open and scroll to bottom
  await page.waitForSelector('div[role="dialog"]', { state: "visible" });
  await page.evaluate(() => {
    const scrollContainer = document.querySelector(
      'div[role="dialog"] .overflow-y-auto'
    );
    if (scrollContainer) {
      scrollContainer.scrollTo(0, scrollContainer.scrollHeight);
    }
  });

  // Wait for button to be enabled and click it
  await page.waitForSelector(
    'button:has-text("I agree to these terms"):not([disabled])',
    { timeout: 10000 }
  );
  await page.click('button:has-text("I agree to these terms")');

  // Handle Health Safety Policy
  await page.click(
    "text=I have read and agree with the Health and Safety Policy"
  );

  // Wait for dialog to open and scroll to bottom
  await page.waitForSelector('div[role="dialog"]', { state: "visible" });
  await page.evaluate(() => {
    const scrollContainer = document.querySelector(
      'div[role="dialog"] .overflow-y-auto'
    );
    if (scrollContainer) {
      scrollContainer.scrollTo(0, scrollContainer.scrollHeight);
    }
  });

  // Wait for button to be enabled and click it
  await page.waitForSelector(
    'button:has-text("I agree to these terms"):not([disabled])',
    { timeout: 10000 }
  );
  await page.click('button:has-text("I agree to these terms")');
}

// Utility function to create isolated test user and token
async function createTestUserWithToken(emailPrefix: string) {
  const timestamp = Date.now();
  const randomSuffix = randomBytes(4).toString("hex");
  const email = `${emailPrefix}-${timestamp}-${randomSuffix}@example.com`;
  const token = randomBytes(32).toString("hex");

  // Clean up any existing data for this email
  await prisma.user.deleteMany({
    where: { email },
  });

  const user = await prisma.user.create({
    data: {
      email,
      firstName: "Migration",
      lastName: "Tester",
      name: "Migration Tester",
      phone: "+64 21 555 9999",
      hashedPassword: "temp-password-hash",
      role: "VOLUNTEER",
      isMigrated: true,
      migrationInvitationToken: token,
      migrationTokenExpiresAt: addDays(new Date(), 7),
      profileCompleted: false,
      volunteerAgreementAccepted: false,
      healthSafetyPolicyAccepted: false,
    },
  });

  return { user, token, email };
}

// Utility function to create expired token user
async function createExpiredTokenUser() {
  const timestamp = Date.now();
  const randomSuffix = randomBytes(4).toString("hex");
  const email = `expired-migration-${timestamp}-${randomSuffix}@example.com`;
  const token = randomBytes(32).toString("hex");

  await prisma.user.deleteMany({
    where: { email },
  });

  const user = await prisma.user.create({
    data: {
      email,
      firstName: "Expired",
      lastName: "User",
      name: "Expired User",
      hashedPassword: "temp-password-hash",
      role: "VOLUNTEER",
      isMigrated: true,
      migrationInvitationToken: token,
      migrationTokenExpiresAt: addDays(new Date(), -1), // Expired yesterday
      profileCompleted: false,
      volunteerAgreementAccepted: false,
      healthSafetyPolicyAccepted: false,
    },
  });

  return { user, token, email };
}

test.describe("Migration Registration Flow", () => {
  // Global cleanup to remove any lingering test data
  test.afterAll(async () => {
    // Clean up any test users created during the test run
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: "-test-",
        },
      },
    });
    await prisma.$disconnect();
  });

  test.describe("Token Validation", () => {
    test("should show registration form for valid token", async ({ page }) => {
      const { token } = await createTestUserWithToken("valid-token-test");

      await page.goto(`/register/migrate?token=${token}`);

      // Wait for the form to load and be visible
      await expect(
        page.locator('[data-testid="migration-registration-form"]')
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="step-card-title"]')
      ).toContainText("Review Your Information");

      // Check user info is pre-filled
      await expect(
        page.locator('[data-testid="first-name-input"]')
      ).toHaveValue("Migration");
      await expect(page.locator('[data-testid="last-name-input"]')).toHaveValue(
        "Tester"
      );
      await expect(page.locator('[data-testid="phone-input"]')).toHaveValue(
        "+64 21 555 9999"
      );
    });

    test("should show error for invalid token", async ({ page }) => {
      await page.goto("/register/migrate?token=invalid-token-123");

      // Check error message is displayed
      await expect(page.locator('[data-testid="error-title"]')).toBeVisible();
      await expect(
        page.locator('[data-testid="error-description"]')
      ).toContainText("Please contact the volunteer coordinator");

      // Check registration form is not displayed
      await expect(
        page.locator('[data-testid="migration-registration-form"]')
      ).not.toBeVisible();
    });

    test("should show error for expired token", async ({ page }) => {
      const { token } = await createExpiredTokenUser();

      await page.goto(`/register/migrate?token=${token}`);

      // Check error message is displayed
      await expect(page.locator('[data-testid="error-title"]')).toBeVisible();
      await expect(
        page.locator('[data-testid="error-description"]')
      ).toContainText("Please contact the volunteer coordinator");
    });

    test("should show error when no token provided", async ({ page }) => {
      await page.goto("/register/migrate");

      // Check error message is displayed
      await expect(
        page.locator('[data-testid="no-token-title"]')
      ).toBeVisible();
    });
  });

  test.describe("Multi-Step Registration Form", () => {
    test("should complete step 1: Personal Information", async ({ page }) => {
      const { token } = await createTestUserWithToken("step1-test");

      await page.goto(`/register/migrate?token=${token}`);
      await expect(
        page.locator('[data-testid="migration-registration-form"]')
      ).toBeVisible();

      // Check step indicator - now 6 steps with photo upload
      await expect(
        page.locator('[data-testid="step-indicator"]')
      ).toContainText("Step 1 of 5");
      await expect(page.locator('[data-testid="step-title"]')).toContainText(
        "Review Your Information"
      );

      // Form should be pre-filled, verify values
      await expect(
        page.locator('[data-testid="first-name-input"]')
      ).toHaveValue("Migration");
      await expect(page.locator('[data-testid="last-name-input"]')).toHaveValue(
        "Tester"
      );

      // Proceed to next step
      await page.click('[data-testid="next-step-button"]');

      // Check step 2 is now active
      await expect(
        page.locator('[data-testid="step-indicator"]')
      ).toContainText("Step 2 of 5");
      await expect(page.locator('[data-testid="step-title"]')).toContainText(
        "Emergency Contact"
      );
    });

    test("should validate password requirements", async ({ page }) => {
      const { token } = await createTestUserWithToken(
        "password-validation-test"
      );

      await page.goto(`/register/migrate?token=${token}`);
      await expect(
        page.locator('[data-testid="migration-registration-form"]')
      ).toBeVisible();

      // Navigate to password step (step 5)
      await page.click('[data-testid="next-step-button"]'); // Step 2: Emergency Contact
      // Fill out emergency contact
      await page.fill(
        '[data-testid="emergency-contact-name-input"]',
        "John Emergency"
      );
      await page.fill(
        '[data-testid="emergency-contact-relationship-input"]',
        "Brother"
      );
      await page.fill(
        '[data-testid="emergency-contact-phone-input"]',
        "+64 21 555 8888"
      );
      await page.getByTestId("next-step-button").click({ force: true }); // Step 3: Medical & Availability
      await page.getByTestId("next-step-button").click(); // Step 4: Profile Photo

      // Now we're on step 5: Set Password
      await expect(page.locator('[data-testid="step-title"]')).toContainText(
        "Set Password"
      );

      // Try weak password
      await page.fill('[data-testid="password-input"]', "weak");
      await page.fill('[data-testid="confirm-password-input"]', "weak");
      await page.click('[data-testid="next-step-button"]');

      // Check validation error in toast - use first visible toast
      await expect(page.locator("[data-sonner-toast]").first()).toContainText(
        "Password too short"
      );

      // Wait for toast to disappear and clear form
      await page.waitForTimeout(2000);
      await page.fill('[data-testid="password-input"]', "");
      await page.fill('[data-testid="confirm-password-input"]', "");

      // Try mismatched passwords
      await page.fill('[data-testid="password-input"]', "StrongPassword123!");
      await page.fill(
        '[data-testid="confirm-password-input"]',
        "DifferentPassword123!"
      );
      await page.click('[data-testid="next-step-button"]');

      // Check validation error in toast - use first visible toast
      await expect(page.locator("[data-sonner-toast]").first()).toContainText(
        "Passwords don't match"
      );
    });

    test("should complete step 2: Emergency Contact", async ({ page }) => {
      const { token } = await createTestUserWithToken("step2-test");

      await page.goto(`/register/migrate?token=${token}`);
      await expect(
        page.locator('[data-testid="migration-registration-form"]')
      ).toBeVisible();

      // Complete step 1 first
      await page.click('[data-testid="next-step-button"]');

      // Fill emergency contact info
      await page.fill(
        '[data-testid="emergency-contact-name-input"]',
        "John Emergency"
      );
      await page.fill(
        '[data-testid="emergency-contact-relationship-input"]',
        "Brother"
      );
      await page.fill(
        '[data-testid="emergency-contact-phone-input"]',
        "+64 21 555 8888"
      );

      // Proceed to next step
      await page.click('[data-testid="next-step-button"]');

      // Check step 3 is now active - Medical & Availability
      await expect(
        page.locator('[data-testid="step-indicator"]')
      ).toContainText("Step 3 of 5");
      await expect(page.locator('[data-testid="step-title"]')).toContainText(
        "Medical & Availability"
      );
    });

    test("should complete step 3: Medical & Availability", async ({ page }) => {
      const { token } = await createTestUserWithToken("step3-test");

      await page.goto(`/register/migrate?token=${token}`);
      await expect(
        page.locator('[data-testid="migration-registration-form"]')
      ).toBeVisible();

      // Navigate to step 3
      await page.click('[data-testid="next-step-button"]');
      await page.fill(
        '[data-testid="emergency-contact-name-input"]',
        "John Emergency"
      );
      await page.fill(
        '[data-testid="emergency-contact-relationship-input"]',
        "Brother"
      );
      await page.fill(
        '[data-testid="emergency-contact-phone-input"]',
        "+64 21 555 8888"
      );
      await page.click('[data-testid="next-step-button"]');

      // Fill medical information (optional)
      await page.fill(
        '[data-testid="medical-conditions-textarea"]',
        "No known allergies or conditions"
      );

      // Wait for checkboxes to be ready
      await page.waitForTimeout(1000);

      // Select availability preferences by clicking the labels
      await page.locator('[data-testid="available-day-monday-label"]').click();
      await page
        .locator('[data-testid="available-day-wednesday-label"]')
        .click();
      await page.locator('[data-testid="available-day-friday-label"]').click();

      // Select location preferences by clicking the labels
      await page
        .locator('[data-testid="available-location-wellington-label"]')
        .click();
      await page
        .locator('[data-testid="available-location-glen innes-label"]')
        .click();

      // Proceed to photo upload step
      await page.click('[data-testid="next-step-button"]');

      // Check step 4 is now active - Profile Photo
      await expect(
        page.locator('[data-testid="step-indicator"]')
      ).toContainText("Step 4 of 5");
      await expect(page.locator('[data-testid="step-title"]')).toContainText(
        "Profile Photo"
      );
    });

    test("should show photo upload step with skip option", async ({ page }) => {
      const { token } = await createTestUserWithToken("photo-step-test");

      await page.goto(`/register/migrate?token=${token}`);
      await expect(
        page.locator('[data-testid="migration-registration-form"]')
      ).toBeVisible();

      // Navigate to photo upload step
      await page.click('[data-testid="next-step-button"]');
      await page.fill(
        '[data-testid="emergency-contact-name-input"]',
        "John Emergency"
      );
      await page.fill(
        '[data-testid="emergency-contact-relationship-input"]',
        "Brother"
      );
      await page.fill(
        '[data-testid="emergency-contact-phone-input"]',
        "+64 21 555 8888"
      );
      await page.click('[data-testid="next-step-button"]');
      await page.click('[data-testid="next-step-button"]');

      // Check photo upload component is visible
      await expect(page.locator('[data-testid="step-title"]')).toContainText(
        "Profile Photo"
      );
      // Check profile photo upload instructions are visible
      await expect(
        page.locator('[data-testid="profile-image-upload"]')
      ).toBeVisible();

      // Should proceed to next step
      await expect(
        page.locator('[data-testid="step-indicator"]')
      ).toContainText("Step 5 of 5");
    });

    test("should complete step 4: Profile Photo Upload", async ({ page }) => {
      const { token } = await createTestUserWithToken("photo-skip-test");

      await page.goto(`/register/migrate?token=${token}`);
      await expect(
        page.locator('[data-testid="migration-registration-form"]')
      ).toBeVisible();

      // Navigate to photo upload step
      await page.click('[data-testid="next-step-button"]');
      await page.fill(
        '[data-testid="emergency-contact-name-input"]',
        "John Emergency"
      );
      await page.fill(
        '[data-testid="emergency-contact-relationship-input"]',
        "Brother"
      );
      await page.fill(
        '[data-testid="emergency-contact-phone-input"]',
        "+64 21 555 8888"
      );
      await page.click('[data-testid="next-step-button"]');
      await page.click('[data-testid="next-step-button"]');

      // Check step 5 is now active - Set Password
      await expect(
        page.locator('[data-testid="step-indicator"]')
      ).toContainText("Step 5 of 5");
      await expect(page.locator('[data-testid="step-title"]')).toContainText(
        "Set Password"
      );
    });

    test("should complete step 5: Set Password", async ({ page }) => {
      const { token } = await createTestUserWithToken("password-test");

      await page.goto(`/register/migrate?token=${token}`);
      await expect(
        page.locator('[data-testid="migration-registration-form"]')
      ).toBeVisible();

      // Navigate to step 5 (Set Password)
      await page.click('[data-testid="next-step-button"]');
      await page.fill(
        '[data-testid="emergency-contact-name-input"]',
        "John Emergency"
      );
      await page.fill(
        '[data-testid="emergency-contact-relationship-input"]',
        "Brother"
      );
      await page.fill(
        '[data-testid="emergency-contact-phone-input"]',
        "+64 21 555 8888"
      );
      await page.click('[data-testid="next-step-button"]');
      await page.click('[data-testid="next-step-button"]');

      // Now on step 5: Set Password
      await expect(
        page.locator('[data-testid="step-indicator"]')
      ).toContainText("Step 5 of 5");
      await expect(page.locator('[data-testid="step-title"]')).toContainText(
        "Set Password"
      );

      // Set password
      await page.fill('[data-testid="password-input"]', "SecurePassword123!");
      await page.fill(
        '[data-testid="confirm-password-input"]',
        "SecurePassword123!"
      );

      // Proceed to final step
      await page.click('[data-testid="next-step-button"]');

      // Check step 6 is now active - Final Steps
      await expect(
        page.locator('[data-testid="step-indicator"]')
      ).toContainText("Step 5 of 5");
      await expect(page.locator('[data-testid="step-title"]')).toContainText(
        "Final Steps"
      );
    });

    test("should require emergency contact information", async ({ page }) => {
      const { token } = await createTestUserWithToken(
        "emergency-required-test"
      );

      await page.goto(`/register/migrate?token=${token}`);
      await expect(
        page.locator('[data-testid="migration-registration-form"]')
      ).toBeVisible();

      // Go to step 2 (Emergency Contact)
      await page.click('[data-testid="next-step-button"]');

      // Try to skip emergency contact (leave fields empty and just click Next)
      await page.click('[data-testid="next-step-button"]');

      // Should show validation error and stay on step 2
      await expect(page.locator("[data-sonner-toast]").first()).toContainText(
        "Required fields missing"
      );
      await expect(
        page.locator('[data-testid="step-indicator"]')
      ).toContainText("Step 2 of 5");

      // Fill out required emergency contact fields
      await page.fill(
        '[data-testid="emergency-contact-name-input"]',
        "John Emergency"
      );
      await page.fill(
        '[data-testid="emergency-contact-relationship-input"]',
        "Brother"
      );
      await page.fill(
        '[data-testid="emergency-contact-phone-input"]',
        "+64 21 555 8888"
      );
      await page.click('[data-testid="next-step-button"]');

      // Now should proceed to step 3
      await expect(
        page.locator('[data-testid="step-indicator"]')
      ).toContainText("Step 3 of 5");
      await expect(page.locator('[data-testid="step-title"]')).toContainText(
        "Medical & Availability"
      );
    });

    test("should navigate through availability selection", async ({ page }) => {
      const { token } = await createTestUserWithToken("availability-test");

      await page.goto(`/register/migrate?token=${token}`);
      await expect(
        page.locator('[data-testid="migration-registration-form"]')
      ).toBeVisible();

      // Navigate to step 3
      await page.click('[data-testid="next-step-button"]'); // Step 1 -> 2 (Emergency Contact)

      // Fill out required emergency contact fields
      await page.fill(
        '[data-testid="emergency-contact-name-input"]',
        "John Emergency"
      );
      await page.fill(
        '[data-testid="emergency-contact-relationship-input"]',
        "Brother"
      );
      await page.fill(
        '[data-testid="emergency-contact-phone-input"]',
        "+64 21 555 8888"
      );
      await page.click('[data-testid="next-step-button"]'); // Step 2 -> 3

      // Now on step 3: Medical & Availability
      await expect(
        page.locator('[data-testid="step-indicator"]')
      ).toContainText("Step 3 of 5");
      await expect(page.locator('[data-testid="step-title"]')).toContainText(
        "Medical & Availability"
      );

      // Wait for checkboxes to be ready
      await page.waitForTimeout(1000);

      // Select availability preferences by clicking the labels
      await page.locator('[data-testid="available-day-monday-label"]').click();
      await page
        .locator('[data-testid="available-day-wednesday-label"]')
        .click();
      await page.locator('[data-testid="available-day-friday-label"]').click();

      // Select location preferences by clicking the labels
      await page
        .locator('[data-testid="available-location-wellington-label"]')
        .click();
      await page
        .locator('[data-testid="available-location-glen innes-label"]')
        .click();

      // Proceed to next step
      await page.click('[data-testid="next-step-button"]');

      // Check step 4 is now active
      await expect(
        page.locator('[data-testid="step-indicator"]')
      ).toContainText("Step 4 of 5");
      await expect(page.locator('[data-testid="step-title"]')).toContainText(
        "Profile Photo"
      );
    });

    test("should complete step 6: Final Steps (Terms and Agreements)", async ({
      page,
    }) => {
      const { token } = await createTestUserWithToken("final-steps-test");

      await page.goto(`/register/migrate?token=${token}`);
      await expect(
        page.locator('[data-testid="migration-registration-form"]')
      ).toBeVisible();

      // Navigate to step 6 (Final Steps)
      await page.click('[data-testid="next-step-button"]'); // Step 1 -> 2 (Emergency Contact)

      // Fill out required emergency contact fields
      await page.fill(
        '[data-testid="emergency-contact-name-input"]',
        "John Emergency"
      );
      await page.fill(
        '[data-testid="emergency-contact-relationship-input"]',
        "Brother"
      );
      await page.fill(
        '[data-testid="emergency-contact-phone-input"]',
        "+64 21 555 8888"
      );
      await page.click('[data-testid="next-step-button"]'); // Step 2 -> 3
      await page.click('[data-testid="next-step-button"]'); // Step 3 -> 4 (Photo)

      // Now on step 6: Final Steps
      await expect(
        page.locator('[data-testid="step-indicator"]')
      ).toContainText("Step 5 of 5");
      await expect(page.locator('[data-testid="step-title"]')).toContainText(
        "Final Steps"
      );

      // Check agreements are required
      await page.click('[data-testid="next-step-button"]');
      // Check validation error in toast
      await expect(page.locator("[data-sonner-toast]").first()).toContainText(
        "Agreements required"
      );

      // Accept agreements through dialogs
      await acceptAgreements(page);

      // Complete registration
      await page.click('[data-testid="next-step-button"]');

      // Check success and redirect
      // Check success message in toast
      await expect(page.locator("[data-sonner-toast]").first()).toContainText(
        "Registration completed!"
      );
    });

    test("should allow going back to previous steps", async ({ page }) => {
      const { token } = await createTestUserWithToken("navigation-test");

      await page.goto(`/register/migrate?token=${token}`);
      await expect(
        page.locator('[data-testid="migration-registration-form"]')
      ).toBeVisible();

      // Go to step 2
      await page.click('[data-testid="next-step-button"]');

      // Go back to step 1
      await page.click('[data-testid="previous-step-button"]');
      await expect(page.locator('[data-testid="step-title"]')).toContainText(
        "Review Your Information"
      );

      // Check data is preserved
      await expect(
        page.locator('[data-testid="first-name-input"]')
      ).toHaveValue("Migration");
    });

    test("should handle form validation errors", async ({ page }) => {
      const { token } = await createTestUserWithToken("validation-test");

      await page.goto(`/register/migrate?token=${token}`);
      await expect(
        page.locator('[data-testid="migration-registration-form"]')
      ).toBeVisible();

      // Try to proceed without required fields
      await page.fill('[data-testid="first-name-input"]', "");
      await page.click('[data-testid="next-step-button"]');

      // Check that form validation prevents proceeding (HTML5 validation, no toast)
      // Should still be on step 1
      await expect(
        page.locator('[data-testid="step-indicator"]')
      ).toContainText("Step 1 of 5");
      await expect(page.locator('[data-testid="step-title"]')).toContainText(
        "Review Your Information"
      );

      // Fill required field and try again
      await page.fill('[data-testid="first-name-input"]', "Migration");
      await page.click('[data-testid="next-step-button"]');

      // Should proceed to next step
      await expect(page.locator('[data-testid="step-title"]')).toContainText(
        "Emergency Contact"
      );
    });
  });

  test.describe("Registration Flow Integration", () => {
    test("should automatically log in after successful registration", async ({
      page,
    }) => {
      const { token } = await createTestUserWithToken("integration-test");

      await page.goto(`/register/migrate?token=${token}`);

      // Complete full registration flow
      // Step 1 -> 2 (Emergency Contact)
      await page.click('[data-testid="next-step-button"]');

      // Fill out required emergency contact fields
      await page.fill(
        '[data-testid="emergency-contact-name-input"]',
        "John Emergency"
      );
      await page.fill(
        '[data-testid="emergency-contact-relationship-input"]',
        "Brother"
      );
      await page.fill(
        '[data-testid="emergency-contact-phone-input"]',
        "+64 21 555 8888"
      );
      await page.click('[data-testid="next-step-button"]'); // Step 2 -> 3

      // Step 3 -> 4
      await page.click('[data-testid="next-step-button"]');

      // Step 4: Set password
      await page.fill('[data-testid="password-input"]', "SecurePassword123!");
      await page.fill(
        '[data-testid="confirm-password-input"]',
        "SecurePassword123!"
      );
      await page.click('[data-testid="next-step-button"]');
      // Step 6: Final agreements
      await acceptAgreements(page);
      await page.click('[data-testid="next-step-button"]');

      // Check user is logged in and redirected to dashboard
      await expect(page).toHaveURL("/dashboard");
      // Check welcome message on dashboard
      await expect(
        page.getByRole("heading", { name: "Welcome back, Migration" })
      ).toBeVisible();
    });

    test("should invalidate token after successful registration", async ({
      page,
    }) => {
      const { token } = await createTestUserWithToken(
        "token-invalidation-test"
      );

      // First, complete registration
      await page.goto(`/register/migrate?token=${token}`);
      // Step 1 -> 2 (Emergency Contact)
      await page.click('[data-testid="next-step-button"]');

      // Fill out required emergency contact fields
      await page.fill(
        '[data-testid="emergency-contact-name-input"]',
        "John Emergency"
      );
      await page.fill(
        '[data-testid="emergency-contact-relationship-input"]',
        "Brother"
      );
      await page.fill(
        '[data-testid="emergency-contact-phone-input"]',
        "+64 21 555 8888"
      );
      await page.click('[data-testid="next-step-button"]'); // Step 2 -> 3

      // Step 3 -> 4
      await page.click('[data-testid="next-step-button"]');
      // Step 4: Set password
      await page.fill('[data-testid="password-input"]', "SecurePassword123!");
      await page.fill(
        '[data-testid="confirm-password-input"]',
        "SecurePassword123!"
      );
      await page.click('[data-testid="next-step-button"]');
      // Step 6: Final agreements
      await acceptAgreements(page);
      await page.click('[data-testid="next-step-button"]');

      // Check user is logged in and redirected to dashboard
      await expect(page).toHaveURL("/dashboard");
      // Check welcome message on dashboard
      await expect(
        page.getByRole("heading", { name: "Welcome back, Migration" })
      ).toBeVisible();
      await page.reload();

      // Logout
      await page.click('[data-testid="user-menu"]');
      await page.click('[data-testid="sign-out-button"]');
      await expect(page).toHaveURL("/");

      // Try to use the same token again
      await page.goto(`/register/migrate?token=${token}`);

      // Should show error for used token
      await expect(page.locator('[data-testid="error-title"]')).toBeVisible();
    });
  });

  test.describe("Responsive Design", () => {
    test("should work on mobile devices", async ({ page }) => {
      const { token } = await createTestUserWithToken("mobile-test");

      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto(`/register/migrate?token=${token}`);

      // Check form is still usable
      await expect(
        page.locator('[data-testid="migration-registration-form"]')
      ).toBeVisible();

      // Step indicator should be hidden on mobile for better space usage
      await expect(page.locator('[data-testid="step-indicator"]')).toBeHidden();

      // Check form fields are accessible
      await expect(
        page.locator('[data-testid="first-name-input"]')
      ).toBeVisible();

      // Check continue button works
      await page.click('[data-testid="next-step-button"]');
      await expect(page.locator('[data-testid="step-title"]')).toContainText(
        "Emergency Contact"
      );
    });
  });
});
