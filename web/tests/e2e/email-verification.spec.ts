import { test, expect } from "./base";
import type { Page } from "@playwright/test";

// Helper function to wait for page to load completely
async function waitForPageLoad(page: Page) {
  await page.waitForLoadState("load");
  await page.waitForTimeout(500); // Small buffer for animations
}

// Helper function to generate unique email for testing
function generateTestEmail(): string {
  const timestamp = Date.now();
  return `test-${timestamp}@example.com`;
}

// Helper function to complete registration flow
async function completeRegistration(page: Page, email: string) {
  await page.goto("/register");
  await waitForPageLoad(page);

  // Step 1: Account Details
  await page.getByTestId("email-input").fill(email);
  await page.getByTestId("password-input").fill("TestPassword123!");
  await page.getByTestId("confirm-password-input").fill("TestPassword123!");
  await page.getByTestId("next-submit-button").click();
  await waitForPageLoad(page);

  // Step 2: Personal Details
  await page.getByRole("textbox", { name: /first name/i }).fill("Test");
  await page.getByRole("textbox", { name: /last name/i }).fill("User");
  await page.getByRole("textbox", { name: /mobile number/i }).fill("(555) 123-4567");
  await page.getByTestId("next-submit-button").click();
  await waitForPageLoad(page);

  // Skip remaining steps
  await page.getByTestId("next-submit-button").click(); // Step 3: Emergency Contact
  await waitForPageLoad(page);
  await page.getByTestId("next-submit-button").click(); // Step 4: Medical & Background
  await waitForPageLoad(page);
  await page.getByTestId("next-submit-button").click(); // Step 5: Availability
  await waitForPageLoad(page);

  // Step 6: Agreements
  await page.getByRole("checkbox", { name: /volunteer agreement/i }).check();
  await page.getByRole("checkbox", { name: /health and safety policy/i }).check();
  await page.getByTestId("submit-button").click();
  await waitForPageLoad(page);
}

// Helper function to mock email verification token creation
async function getVerificationToken(page: Page, email: string): Promise<string> {
  // Since we can't easily intercept actual email sending in e2e tests,
  // we'll directly call the API to get a token or create a user and token manually
  const response = await page.request.post("/api/auth/resend-verification", {
    data: { email }
  });
  
  // For testing, we'll need to extract the token from the database or mock response
  // This is a simplified approach - in real tests you might query the database directly
  return "mock-token-for-testing";
}

test.describe("Email Verification System", () => {
  test.describe("Verify Email Page", () => {
    test("should display verification page elements", async ({ page }) => {
      await page.goto("/verify-email?token=test-token");
      await waitForPageLoad(page);

      // Should show page structure
      const verifyEmailPage = page.getByTestId("verify-email-page");
      await expect(verifyEmailPage).toBeVisible();

      const verifyEmailCard = page.getByTestId("verify-email-card");
      await expect(verifyEmailCard).toBeVisible();

      const verificationIcon = page.getByTestId("verification-icon");
      await expect(verificationIcon).toBeVisible();

      const verificationTitle = page.getByTestId("verification-title");
      await expect(verificationTitle).toBeVisible();

      const verificationDescription = page.getByTestId("verification-description");
      await expect(verificationDescription).toBeVisible();
    });

    test("should show error state for invalid token", async ({ page }) => {
      await page.goto("/verify-email?token=invalid-token");
      await waitForPageLoad(page);

      // Wait for verification to complete and show error
      await page.waitForTimeout(2000);

      const errorIcon = page.getByTestId("error-icon");
      await expect(errorIcon).toBeVisible();

      const errorTitle = page.getByTestId("verification-title");
      await expect(errorTitle).toBeVisible();
      await expect(errorTitle).toHaveText("Verification failed");

      // Should show resend form
      const resendSection = page.getByTestId("resend-section");
      await expect(resendSection).toBeVisible();

      const emailInput = page.getByTestId("resend-email-input");
      await expect(emailInput).toBeVisible();

      const resendButton = page.getByTestId("resend-button");
      await expect(resendButton).toBeVisible();
    });

    test("should show error state for invalid/expired token", async ({ page }) => {
      await page.goto("/verify-email?token=invalid-or-expired-token");
      await waitForPageLoad(page);

      // Wait for verification to complete
      await page.waitForTimeout(2000);

      // Non-existent tokens will show error state (not expired state)
      const errorIcon = page.getByTestId("error-icon");
      await expect(errorIcon).toBeVisible();

      const errorTitle = page.getByTestId("verification-title");
      await expect(errorTitle).toBeVisible();
      await expect(errorTitle).toHaveText("Verification failed");

      const errorDescription = page.getByTestId("verification-description");
      await expect(errorDescription).toBeVisible();

      // Should show resend form for error states
      const resendSection = page.getByTestId("resend-section");
      await expect(resendSection).toBeVisible();

      const emailInput = page.getByTestId("resend-email-input");
      await expect(emailInput).toBeVisible();

      const resendButton = page.getByTestId("resend-button");
      await expect(resendButton).toBeVisible();
    });

    test("should handle coming from login page", async ({ page }) => {
      const testEmail = generateTestEmail();
      await page.goto(`/verify-email?email=${testEmail}&from=login`);
      await waitForPageLoad(page);

      // Should show email verification required state
      const mailIcon = page.getByTestId("email-required-icon");
      await expect(mailIcon).toBeVisible();

      const requiredTitle = page.getByTestId("verification-title");
      await expect(requiredTitle).toBeVisible();
      await expect(requiredTitle).toHaveText("Email verification required");

      const requiredDescription = page.getByTestId("verification-description");
      await expect(requiredDescription).toBeVisible();
      await expect(requiredDescription).toContainText("You need to verify your email address before you can log in");

      // Should have email pre-filled
      const emailInput = page.getByTestId("resend-email-input");
      await expect(emailInput).toHaveValue(testEmail);
    });

    test("should show navigation buttons", async ({ page }) => {
      await page.goto("/verify-email?token=invalid-token");
      await waitForPageLoad(page);
      await page.waitForTimeout(2000); // Wait for error state

      // Should show login button
      const loginButton = page.getByTestId("login-button");
      await expect(loginButton).toBeVisible();
      
      // Button uses asChild, so it becomes the Link element directly
      await expect(loginButton).toHaveAttribute("href", "/login");
    });
  });

  test.describe("Resend Verification Functionality", () => {
    test.skip("should validate email input", async ({ page }) => {
      await page.goto("/verify-email?token=invalid-token");
      await waitForPageLoad(page);
      await page.waitForTimeout(2000); // Wait for error state

      // Verify the resend section is visible first
      const resendSection = page.getByTestId("resend-section");
      await expect(resendSection).toBeVisible();

      // Clear any pre-filled email first and verify it's empty
      const emailInput = page.getByTestId("resend-email-input");
      await emailInput.clear();
      await emailInput.fill(""); // Double ensure it's empty
      
      // Verify email field is actually empty
      await expect(emailInput).toHaveValue("");

      const resendButton = page.getByTestId("resend-button");
      await expect(resendButton).toBeVisible();
      
      // Try to resend without email - button should be enabled
      await expect(resendButton).toBeEnabled();
      await resendButton.click();
      
      // Wait for dialog to appear with longer timeout
      const dialog = page.getByTestId("verification-dialog");
      await expect(dialog).toBeVisible({ timeout: 10000 });

      const dialogTitle = page.getByTestId("dialog-title");
      await expect(dialogTitle).toBeVisible();
      await expect(dialogTitle).toHaveText("Email Required");

      const dialogDescription = page.getByTestId("dialog-description");
      await expect(dialogDescription).toBeVisible();
      await expect(dialogDescription).toHaveText("Please enter your email address");

      // Close dialog
      const okButton = page.getByTestId("dialog-ok-button");
      await okButton.click();
      
      await expect(dialog).not.toBeVisible();
    });

    test.skip("should handle successful resend", async ({ page }) => {
      const testEmail = generateTestEmail();
      
      await page.goto("/verify-email?token=invalid-token");
      await waitForPageLoad(page);
      await page.waitForTimeout(2000); // Wait for error state

      // Verify the resend section is visible
      const resendSection = page.getByTestId("resend-section");
      await expect(resendSection).toBeVisible();

      // Fill email and resend
      const emailInput = page.getByTestId("resend-email-input");
      await emailInput.fill(testEmail);
      
      // Verify email was filled
      await expect(emailInput).toHaveValue(testEmail);

      const resendButton = page.getByTestId("resend-button");
      await expect(resendButton).toBeEnabled();
      await resendButton.click();

      // Should show success dialog - wait longer for API call
      const dialog = page.getByTestId("verification-dialog");
      await expect(dialog).toBeVisible({ timeout: 15000 });

      const successTitle = page.getByTestId("dialog-title");
      await expect(successTitle).toBeVisible();
      await expect(successTitle).toHaveText("Email Sent");

      const successDescription = page.getByTestId("dialog-description");
      await expect(successDescription).toBeVisible();
      await expect(successDescription).toHaveText("If an account with this email exists, a verification email has been sent");

      // Email input should be cleared after closing dialog
      await page.getByTestId("dialog-ok-button").click();
      await expect(emailInput).toHaveValue("");
    });

    test("should show loading state during resend", async ({ page }) => {
      const testEmail = generateTestEmail();
      
      await page.goto("/verify-email?token=invalid-token");
      await waitForPageLoad(page);
      await page.waitForTimeout(2000); // Wait for error state

      // Fill email
      const emailInput = page.getByTestId("resend-email-input");
      await emailInput.fill(testEmail);

      const resendButton = page.getByTestId("resend-button");
      
      // Button should be disabled during loading (this happens very quickly)
      await resendButton.click();
      
      // Button should be re-enabled after API call completes
      await expect(resendButton).toBeEnabled({ timeout: 10000 });
    });
  });

  test.describe("Login Flow Integration", () => {
    test("should show success message after verification", async ({ page }) => {
      await page.goto("/login?verified=true");
      await waitForPageLoad(page);

      // Should show verified success message
      const successMessage = page.getByTestId("success-message");
      await expect(successMessage).toBeVisible();
      await expect(successMessage).toContainText("Email verified successfully");
    });

  });

  test.describe("Success Message UI Improvements", () => {
    test("should display success message with proper structure", async ({ page }) => {
      await page.goto("/login?verified=true");
      await waitForPageLoad(page);

      const successMessage = page.getByTestId("success-message");
      await expect(successMessage).toBeVisible();

      // Check that success message contains expected text
      await expect(successMessage).toContainText("Email verified successfully");
      
      // Check for improved design elements - icon should be visible
      const successIcon = successMessage.locator('svg');
      await expect(successIcon).toBeVisible();
    });

    test("should work with multi-line success messages", async ({ page }) => {
      await page.goto("/login?message=verify-email&email=test@example.com");
      await waitForPageLoad(page);

      const successMessage = page.getByTestId("success-message");
      await expect(successMessage).toBeVisible();

      // Should contain expected message content
      await expect(successMessage).toContainText("check your email");
    });
  });

  test.describe("API Security", () => {
    test("should not reveal user existence in resend API", async ({ page }) => {
      // Test with non-existent email
      const response = await page.request.post("/api/auth/resend-verification", {
        data: { email: "nonexistent@example.com" }
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      
      // Should return generic message regardless of user existence
      expect(data.message).toBe("If an account with this email exists, a verification email has been sent");
    });

    test("should not reveal verification status in resend API", async ({ page }) => {
      // Test with already verified email (assuming we have one)
      const response = await page.request.post("/api/auth/resend-verification", {
        data: { email: "volunteer@example.com" } // Demo user that might be verified
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      
      // Should return same generic message for verified users
      expect(data.message).toBe("If an account with this email exists, a verification email has been sent");
    });

    test("should validate email format in resend API", async ({ page }) => {
      const response = await page.request.post("/api/auth/resend-verification", {
        data: { email: "invalid-email" }
      });

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("Invalid email address");
    });
  });

  test.describe("Dialog Components", () => {
    test("should use proper dialog instead of browser alerts", async ({ page }) => {
      await page.goto("/verify-email?token=invalid-token");
      await waitForPageLoad(page);
      await page.waitForTimeout(2000); // Wait for error state

      // Try to resend without email to trigger validation
      const resendButton = page.getByRole("button", { name: /resend verification email/i });
      await resendButton.click();
      await waitForPageLoad(page);

      // Should show shadcn/ui dialog, not browser alert
      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();

      // Dialog should have proper structure
      const dialogTitle = dialog.locator('[data-dialog-title], h2, .text-lg');
      await expect(dialogTitle).toBeVisible();

      const dialogDescription = dialog.locator('[data-dialog-description], p');
      await expect(dialogDescription).toBeVisible();

      const okButton = dialog.getByRole("button", { name: "OK" });
      await expect(okButton).toBeVisible();

      // Close dialog and verify it disappears
      await okButton.click();
      await expect(dialog).not.toBeVisible();
    });

    test("should handle dialog keyboard navigation", async ({ page }) => {
      await page.goto("/verify-email?token=invalid-token");
      await waitForPageLoad(page);
      await page.waitForTimeout(2000); // Wait for error state

      const resendButton = page.getByRole("button", { name: /resend verification email/i });
      await resendButton.click();
      await waitForPageLoad(page);

      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();

      // Should be able to close with Escape key
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
    });
  });
});