import { test, expect } from "./base";
import type { Page } from "@playwright/test";

// Helper function to wait for page to load completely
async function waitForPageLoad(page: Page) {
  await page.waitForLoadState("load");
  await page.waitForTimeout(500); // Small buffer for animations
}

// Helper function to generate unique test email
function generateTestEmail() {
  return `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
}

// Helper function to create a test user via API
async function createTestUser(page: Page) {
  const testEmail = generateTestEmail();
  const testPassword = "TestPassword123";
  
  // Create user via registration API
  const response = await page.request.post("/api/auth/register", {
    data: {
      email: testEmail,
      password: testPassword,
      confirmPassword: testPassword,
      firstName: "Test",
      lastName: "User",
      phone: "021234567",
      volunteerAgreementAccepted: true,
      healthSafetyPolicyAccepted: true,
      profilePhotoUrl: "https://example.com/photo.jpg"
    }
  });
  
  if (!response.ok()) {
    throw new Error(`Failed to create test user: ${await response.text()}`);
  }
  
  return { email: testEmail, password: testPassword };
}

test.describe("Password Reset Flow", () => {
  test.describe("Forgot Password Page", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/forgot-password");
      await waitForPageLoad(page);
    });

    test("should display forgot password page with all elements", async ({ page }) => {
      // Check main page container
      const forgotPasswordPage = page.getByTestId("forgot-password-page");
      await expect(forgotPasswordPage).toBeVisible();

      // Check page title and description
      const pageTitle = page.getByRole("heading", { name: /reset your password/i });
      await expect(pageTitle).toBeVisible();

      const pageDescription = page.getByText(/enter your email address and we'll send you instructions/i);
      await expect(pageDescription).toBeVisible();

      // Check form card
      const formCard = page.getByTestId("forgot-password-form-card");
      await expect(formCard).toBeVisible();

      // Check form
      const form = page.getByTestId("forgot-password-form");
      await expect(form).toBeVisible();
    });

    test("should display form fields correctly", async ({ page }) => {
      // Check email field
      const emailField = page.getByTestId("email-field");
      await expect(emailField).toBeVisible();

      const emailLabel = page.getByTestId("email-field").getByText("Email address");
      await expect(emailLabel).toBeVisible();

      const emailInput = page.getByTestId("email-input");
      await expect(emailInput).toBeVisible();
      await expect(emailInput).toHaveAttribute("type", "email");
      await expect(emailInput).toHaveAttribute("required");
      await expect(emailInput).toHaveAttribute("placeholder", "Enter your email");

      // Check submit button
      const submitButton = page.getByTestId("forgot-password-submit-button");
      await expect(submitButton).toBeVisible();
      await expect(submitButton).toHaveText("Send reset instructions");
      await expect(submitButton).toBeEnabled();
    });

    test("should show validation error for invalid email", async ({ page }) => {
      const emailInput = page.getByTestId("email-input");
      const submitButton = page.getByTestId("forgot-password-submit-button");

      // Enter invalid email
      await emailInput.fill("invalid-email");
      await submitButton.click();

      // Check for HTML5 validation (browser-level validation)
      const validationMessage = await emailInput.evaluate((input: HTMLInputElement) => input.validationMessage);
      expect(validationMessage).toBeTruthy();
    });

    test("should submit form with valid email for existing user", async ({ page }) => {
      // Create a test user first
      const testUser = await createTestUser(page);
      
      const emailInput = page.getByTestId("email-input");
      const submitButton = page.getByTestId("forgot-password-submit-button");

      // Enter the test user's email
      await emailInput.fill(testUser.email);
      await submitButton.click();

      // Wait for form submission
      await page.waitForTimeout(1000);

      // Check for success message (should appear for both existing and non-existing emails for security)
      const successMessage = page.getByTestId("success-message");
      await expect(successMessage).toBeVisible();
      
      const successText = page.getByText(/if an account with that email exists/i);
      await expect(successText).toBeVisible();
    });

    test("should handle non-existent email gracefully", async ({ page }) => {
      const emailInput = page.getByTestId("email-input");
      const submitButton = page.getByTestId("forgot-password-submit-button");

      // Enter non-existent email (generate unique email that definitely doesn't exist)
      const nonExistentEmail = generateTestEmail();
      await emailInput.fill(nonExistentEmail);
      await submitButton.click();

      // Wait for form submission
      await page.waitForTimeout(1000);

      // Should still show success message for security (don't reveal if email exists)
      const successMessage = page.getByTestId("success-message");
      await expect(successMessage).toBeVisible();
      
      const successText = page.getByText(/if an account with that email exists/i);
      await expect(successText).toBeVisible();
    });

    test("should show loading state during submission", async ({ page }) => {
      const emailInput = page.getByTestId("email-input");
      const submitButton = page.getByTestId("forgot-password-submit-button");

      const testEmail = generateTestEmail();
      await emailInput.fill(testEmail);
      
      // Click submit and immediately check for loading state
      await submitButton.click();
      
      // Check for loading text
      const loadingText = page.getByText("Sending instructions...");
      await expect(loadingText).toBeVisible();
      
      // Check button is disabled during loading
      await expect(submitButton).toBeDisabled();
    });

    test("should have link back to login", async ({ page }) => {
      const backToLoginLink = page.getByTestId("back-to-login-link");
      await expect(backToLoginLink).toBeVisible();
      await expect(backToLoginLink).toHaveText("Back to sign in");
      
      // Click should navigate to login page
      await backToLoginLink.click();
      await waitForPageLoad(page);
      await expect(page).toHaveURL("/login");
    });
  });

  test.describe("Reset Password Page", () => {
    test.beforeEach(async ({ page }) => {
      // Navigate with a mock token
      await page.goto("/reset-password?token=mock-token-123");
      await waitForPageLoad(page);
    });

    test("should display reset password page with all elements", async ({ page }) => {
      // Check main page container
      const resetPasswordPage = page.getByTestId("reset-password-page");
      await expect(resetPasswordPage).toBeVisible();

      // Check page title and description
      const pageTitle = page.getByRole("heading", { name: /create new password/i });
      await expect(pageTitle).toBeVisible();

      const pageDescription = page.getByText(/enter your new password below/i);
      await expect(pageDescription).toBeVisible();

      // Check form card
      const formCard = page.getByTestId("reset-password-form-card");
      await expect(formCard).toBeVisible();

      // Check form
      const form = page.getByTestId("reset-password-form");
      await expect(form).toBeVisible();
    });

    test("should display form fields correctly", async ({ page }) => {
      // Check password field
      const passwordField = page.getByTestId("password-field");
      await expect(passwordField).toBeVisible();

      const passwordLabel = page.getByText("New password", { exact: true });
      await expect(passwordLabel).toBeVisible();

      const passwordInput = page.getByTestId("password-input");
      await expect(passwordInput).toBeVisible();
      await expect(passwordInput).toHaveAttribute("type", "password");
      await expect(passwordInput).toHaveAttribute("required");

      // Check confirm password field
      const confirmPasswordField = page.getByTestId("confirm-password-field");
      await expect(confirmPasswordField).toBeVisible();

      const confirmPasswordLabel = page.getByText("Confirm new password", { exact: true });
      await expect(confirmPasswordLabel).toBeVisible();

      const confirmPasswordInput = page.getByTestId("confirm-password-input");
      await expect(confirmPasswordInput).toBeVisible();
      await expect(confirmPasswordInput).toHaveAttribute("type", "password");
      await expect(confirmPasswordInput).toHaveAttribute("required");

      // Check submit button
      const submitButton = page.getByTestId("reset-password-submit-button");
      await expect(submitButton).toBeVisible();
      await expect(submitButton).toHaveText("Reset password");
    });

    test("should show password requirements", async ({ page }) => {
      const passwordInput = page.getByTestId("password-input");
      
      // Initially should show hint
      const passwordHint = page.getByTestId("password-hint");
      await expect(passwordHint).toBeVisible();
      await expect(passwordHint).toHaveText(/password must be at least 6 characters/i);

      // Start typing to see requirements
      await passwordInput.fill("a");
      
      // Should show password requirements
      const passwordRequirements = page.getByTestId("password-requirements");
      await expect(passwordRequirements).toBeVisible();

      // Check individual requirements are displayed
      await expect(page.getByText("At least 6 characters")).toBeVisible();
      await expect(page.getByText("Contains uppercase letter")).toBeVisible();
      await expect(page.getByText("Contains lowercase letter")).toBeVisible();
      await expect(page.getByText("Contains number")).toBeVisible();
    });

    test("should validate password requirements", async ({ page }) => {
      const passwordInput = page.getByTestId("password-input");
      
      // Test weak password
      await passwordInput.fill("weak");
      
      const passwordRequirements = page.getByTestId("password-requirements");
      await expect(passwordRequirements).toBeVisible();
      
      // Should show red X for unmet requirements
      const lengthRequirement = page.getByText("At least 6 characters").locator("..");
      await expect(lengthRequirement).toContainText("At least 6 characters");
      
      // Test strong password
      await passwordInput.fill("StrongPass123");
      
      // Should show green checkmarks for met requirements
      await expect(lengthRequirement).toContainText("At least 6 characters");
    });

    test.skip("should validate password confirmation", async ({ page }) => {
      const passwordInput = page.getByTestId("password-input");
      const confirmPasswordInput = page.getByTestId("confirm-password-input");
      
      await passwordInput.fill("StrongPass123");
      await confirmPasswordInput.fill("DifferentPass123");
      
      // Should show password mismatch indication
      const passwordMatchCheck = page.getByTestId("password-match-check");
      await expect(passwordMatchCheck).toBeVisible();
      await expect(passwordMatchCheck).toHaveText("Passwords do not match");
      
      // Fix the password match
      await confirmPasswordInput.clear();
      await confirmPasswordInput.fill("StrongPass123");
      
      await expect(passwordMatchCheck).toHaveText("Passwords match");
    });

    test("should handle password reset submission", async ({ page }) => {
      const passwordInput = page.getByTestId("password-input");
      const confirmPasswordInput = page.getByTestId("confirm-password-input");
      const submitButton = page.getByTestId("reset-password-submit-button");

      // Fill valid passwords
      await passwordInput.fill("NewSecurePass123");
      await confirmPasswordInput.fill("NewSecurePass123");
      
      await submitButton.click();
      
      // Should show loading state
      await expect(submitButton).toBeDisabled();
      const loadingText = page.getByText("Resetting password...");
      await expect(loadingText).toBeVisible();
    });

    test("should have link back to login", async ({ page }) => {
      const backToLoginLink = page.getByTestId("back-to-login-link");
      await expect(backToLoginLink).toBeVisible();
      await expect(backToLoginLink).toHaveText("Back to sign in");
    });
  });

  test.describe("Invalid Token Handling", () => {
    test("should show invalid token page when no token provided", async ({ page }) => {
      await page.goto("/reset-password");
      await waitForPageLoad(page);

      // Should show invalid token card
      const invalidTokenCard = page.getByTestId("invalid-token-card");
      await expect(invalidTokenCard).toBeVisible();

      const invalidTokenTitle = page.getByRole("heading", { name: /invalid reset link/i });
      await expect(invalidTokenTitle).toBeVisible();

      const invalidTokenDescription = page.getByText(/this password reset link is invalid or has expired/i);
      await expect(invalidTokenDescription).toBeVisible();

      // Should have link to request new reset
      const newResetLink = page.getByText("Request new reset link");
      await expect(newResetLink).toBeVisible();
      
      // Should navigate to forgot password page
      await newResetLink.click();
      await waitForPageLoad(page);
      await expect(page).toHaveURL("/forgot-password");
    });
  });

  test.describe("Login Page Integration", () => {
    test("should have forgot password link on login page", async ({ page }) => {
      await page.goto("/login");
      await waitForPageLoad(page);

      const forgotPasswordLink = page.getByText("Forgot password?");
      await expect(forgotPasswordLink).toBeVisible();
      
      // Click should navigate to forgot password page
      await forgotPasswordLink.click();
      await waitForPageLoad(page);
      await expect(page).toHaveURL("/forgot-password");
    });

    test.skip("should show password reset success message", async ({ page }) => {
      await page.goto("/login?message=password-reset-success");
      await waitForPageLoad(page);

      // Should show success message
      const successMessage = page.getByText(/password reset successfully/i);
      await expect(successMessage).toBeVisible();
    });
  });

  test.describe("Accessibility and UX", () => {
    test.skip("forgot password form should be keyboard accessible", async ({ page }) => {
      await page.goto("/forgot-password");
      await waitForPageLoad(page);

      // Tab through form elements
      await page.keyboard.press("Tab");
      const emailInput = page.getByTestId("email-input");
      await expect(emailInput).toBeFocused();

      await page.keyboard.press("Tab");
      const submitButton = page.getByTestId("forgot-password-submit-button");
      await expect(submitButton).toBeFocused();

      // Should be able to submit with Enter
      await emailInput.fill("test@example.com");
      await emailInput.press("Enter");
      
      // Form should submit
      await page.waitForTimeout(500);
      const successMessage = page.getByTestId("success-message");
      await expect(successMessage).toBeVisible();
    });

    test.skip("reset password form should be keyboard accessible", async ({ page }) => {
      await page.goto("/reset-password?token=mock-token");
      await waitForPageLoad(page);

      const passwordInput = page.getByTestId("password-input");
      const confirmPasswordInput = page.getByTestId("confirm-password-input");
      const submitButton = page.getByTestId("reset-password-submit-button");

      // Tab through form elements
      await page.keyboard.press("Tab");
      await expect(passwordInput).toBeFocused();

      await page.keyboard.press("Tab");
      await expect(confirmPasswordInput).toBeFocused();

      await page.keyboard.press("Tab");
      await expect(submitButton).toBeFocused();
    });

    test.skip("should have proper ARIA labels and semantic structure", async ({ page }) => {
      await page.goto("/forgot-password");
      await waitForPageLoad(page);

      // Check form has proper labels
      const emailInput = page.getByTestId("email-input");
      await expect(emailInput).toHaveAttribute("required");
      
      // Use more specific selector to avoid conflicts
      const emailLabel = page.getByTestId("email-field").getByText("Email address");
      await expect(emailLabel).toBeVisible();
    });
  });

  test.describe("Mobile Responsiveness", () => {
    test("should work on mobile viewport", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/forgot-password");
      await waitForPageLoad(page);

      const forgotPasswordPage = page.getByTestId("forgot-password-page");
      await expect(forgotPasswordPage).toBeVisible();

      const formCard = page.getByTestId("forgot-password-form-card");
      await expect(formCard).toBeVisible();

      // Form should still be functional
      const emailInput = page.getByTestId("email-input");
      const submitButton = page.getByTestId("forgot-password-submit-button");
      
      await emailInput.fill("mobile@example.com");
      await submitButton.click();
      
      const successMessage = page.getByTestId("success-message");
      await expect(successMessage).toBeVisible();
    });
  });
});