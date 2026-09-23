import { test, expect } from "./base";
import type { Page } from "@playwright/test";
import { logout } from "./helpers/auth";

// Helper function to wait for page to load completely
async function waitForPageLoad(page: Page) {
  await page.waitForLoadState("load");
  await page.waitForTimeout(500); // Small buffer for animations
}

// Helper function to generate unique test email
function generateTestEmail() {
  return `test-${Date.now()}-${Math.random()
    .toString(36)
    .substring(7)}@example.com`;
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
      profilePhotoUrl: "https://example.com/photo.jpg",
    },
  });

  if (!response.ok()) {
    throw new Error(`Failed to create test user: ${await response.text()}`);
  }

  return { email: testEmail, password: testPassword };
}

/**
 * Seed a user with a password reset token via the test-only users API, the
 * same way forgot-password does it, so the reset page can be exercised with a
 * genuinely live (or genuinely expired) link.
 */
async function createUserWithResetToken(
  page: Page,
  options: { expired?: boolean; email?: string } = {}
) {
  const email = options.email ?? generateTestEmail();
  const password = "TestPassword123";
  const token = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const oneHour = 60 * 60 * 1000;
  const expiresAt = new Date(
    Date.now() + (options.expired ? -oneHour : oneHour)
  ).toISOString();

  const response = await page.request.post("/api/test/users", {
    data: {
      email,
      password,
      passwordResetToken: token,
      passwordResetTokenExpiresAt: expiresAt,
    },
  });
  if (!response.ok()) {
    throw new Error(`Failed to seed reset token: ${await response.text()}`);
  }

  return { email, password, token };
}

async function signInWithPassword(page: Page, email: string, password: string) {
  await page.goto("/login");
  await waitForPageLoad(page);
  await page.getByTestId("email-input").fill(email);
  await page.getByTestId("password-input").fill(password);
  await page.getByTestId("login-submit-button").click();
}

test.describe("Password Reset Flow", () => {
  test.describe("Forgot Password Page", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/forgot-password");
      await waitForPageLoad(page);
    });

    test("should display forgot password page with all elements", async ({
      page,
    }) => {
      // Check main page container
      const forgotPasswordPage = page.getByTestId("forgot-password-page");
      await expect(forgotPasswordPage).toBeVisible();

      // Check page title and description
      const pageTitle = page.getByRole("heading", {
        name: /reset your password/i,
      });
      await expect(pageTitle).toBeVisible();

      const pageDescription = page.getByText(
        /enter your email address and we'll send you instructions/i
      );
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

      const emailLabel = page
        .getByTestId("email-field")
        .getByText("Email address");
      await expect(emailLabel).toBeVisible();

      const emailInput = page.getByTestId("email-input");
      await expect(emailInput).toBeVisible();
      await expect(emailInput).toHaveAttribute("type", "email");
      await expect(emailInput).toHaveAttribute("required");
      await expect(emailInput).toHaveAttribute(
        "placeholder",
        "Enter your email"
      );

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
      const validationMessage = await emailInput.evaluate(
        (input: HTMLInputElement) => input.validationMessage
      );
      expect(validationMessage).toBeTruthy();
    });

    test("should submit form with valid email for existing user", async ({
      page,
    }) => {
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

      const successText = page.getByText(
        /if an account with that email exists/i
      );
      await expect(successText).toBeVisible();
    });

    test("finds an account whose stored email has capital letters", async ({
      page,
    }) => {
      // Legacy accounts were stored exactly as typed at registration, so
      // a volunteer who signed up as "Jane.Doe@Example.com" must still be
      // able to reset their password by typing it in lowercase.
      const storedEmail = `Mixed.Case-${Date.now()}@Example.com`;
      const response = await page.request.post("/api/test/users", {
        data: { email: storedEmail, password: "TestPassword123" },
      });
      expect(response.ok()).toBeTruthy();

      await page.getByTestId("email-input").fill(storedEmail.toLowerCase());
      await page.getByTestId("forgot-password-submit-button").click();
      await expect(page.getByTestId("success-message")).toBeVisible();

      const lookup = await page.request.get(
        `/api/test/users?email=${encodeURIComponent(storedEmail)}`
      );
      expect(lookup.ok()).toBeTruthy();
      expect((await lookup.json()).passwordResetPending).toBe(true);
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

      const successText = page.getByText(
        /if an account with that email exists/i
      );
      await expect(successText).toBeVisible();
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
    let account: { email: string; password: string; token: string };

    test.beforeEach(async ({ page }) => {
      account = await createUserWithResetToken(page);
      await page.goto(`/reset-password?token=${account.token}`);
      await waitForPageLoad(page);
    });

    test("should display reset password page with all elements", async ({
      page,
    }) => {
      // Check main page container
      const resetPasswordPage = page.getByTestId("reset-password-page");
      await expect(resetPasswordPage).toBeVisible();

      // Check page title and description
      const pageTitle = page.getByRole("heading", {
        name: /create new password/i,
      });
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

      const confirmPasswordLabel = page.getByText("Confirm new password", {
        exact: true,
      });
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
      await expect(passwordHint).toHaveText(
        /password must be at least 6 characters/i
      );

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
      const lengthRequirement = page
        .getByText("At least 6 characters")
        .locator("..");
      await expect(lengthRequirement).toContainText("At least 6 characters");

      // Test strong password
      await passwordInput.fill("StrongPass123");

      // Should show green checkmarks for met requirements
      await expect(lengthRequirement).toContainText("At least 6 characters");
    });

    test("should validate password confirmation", async ({ page }) => {
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

    test("resets the password, signs in with it, and retires the link", async ({
      page,
    }) => {
      const newPassword = "NewSecurePass123";

      await page.getByTestId("password-input").fill(newPassword);
      await page.getByTestId("confirm-password-input").fill(newPassword);
      await page.getByTestId("reset-password-submit-button").click();

      await expect(page.getByTestId("success-message")).toBeVisible();
      await expect(page.getByTestId("success-message")).toContainText(
        /password reset successfully/i
      );

      // The form hands over to the login page, which confirms the reset
      await page.waitForURL(/\/login\?message=password-reset-success/, {
        timeout: 10000,
      });
      // Scope to the login page's banner: the reset form's own success
      // message can linger in React's hidden staging container while the
      // client-side navigation settles.
      await expect(
        page
          .getByTestId("success-message")
          .filter({ hasText: "Password reset successful!" })
      ).toBeVisible();

      // The new password works (scoped to the login form for the same
      // reason as above: the reset form shares field test ids)
      const loginForm = page.getByTestId("login-form");
      await loginForm.getByTestId("email-input").fill(account.email);
      await loginForm.getByTestId("password-input").fill(newPassword);
      await loginForm.getByTestId("login-submit-button").click();
      await page.waitForURL("/dashboard");

      // ...and the old one is gone
      await logout(page);
      await signInWithPassword(page, account.email, account.password);
      await expect(page.getByText(/invalid credentials/i)).toBeVisible();

      // Reopening the same link now says it has been used, not a blank form
      await page.goto(`/reset-password?token=${account.token}`);
      await waitForPageLoad(page);
      await expect(page.getByTestId("invalid-token-card")).toBeVisible();
      await expect(page.getByTestId("reset-link-invalid")).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /already been used/i })
      ).toBeVisible();
      await expect(page.getByTestId("reset-password-form")).toHaveCount(0);
    });

    test("should have link back to login", async ({ page }) => {
      const backToLoginLink = page.getByTestId("back-to-login-link");
      await expect(backToLoginLink).toBeVisible();
      await expect(backToLoginLink).toHaveText("Back to sign in");
    });
  });

  test.describe("Invalid Token Handling", () => {
    test("shows the used-link message for a token that no longer exists", async ({
      page,
    }) => {
      await page.goto("/reset-password?token=not-a-real-token");
      await waitForPageLoad(page);

      await expect(page.getByTestId("invalid-token-card")).toBeVisible();
      await expect(page.getByTestId("reset-link-invalid")).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /already been used/i })
      ).toBeVisible();
      await expect(page.getByTestId("reset-password-form")).toHaveCount(0);

      // Offers both ways forward
      await expect(page.getByText("Request new reset link")).toBeVisible();
      await expect(page.getByTestId("back-to-login-link")).toBeVisible();
    });

    test("shows the expired message for a token past its expiry", async ({
      page,
    }) => {
      const { token } = await createUserWithResetToken(page, { expired: true });
      await page.goto(`/reset-password?token=${token}`);
      await waitForPageLoad(page);

      await expect(page.getByTestId("invalid-token-card")).toBeVisible();
      await expect(page.getByTestId("reset-link-expired")).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /link has expired/i })
      ).toBeVisible();
      await expect(page.getByTestId("reset-password-form")).toHaveCount(0);
    });

    test("a newer request retires the older link", async ({ page }) => {
      const { email, token: olderToken } = await createUserWithResetToken(page);

      await page.goto("/forgot-password");
      await waitForPageLoad(page);
      await page.getByTestId("email-input").fill(email);
      await page.getByTestId("forgot-password-submit-button").click();
      await expect(page.getByTestId("success-message")).toBeVisible();

      await page.goto(`/reset-password?token=${olderToken}`);
      await waitForPageLoad(page);
      await expect(page.getByTestId("reset-link-invalid")).toBeVisible();
    });

    test("should show invalid token page when no token provided", async ({
      page,
    }) => {
      await page.goto("/reset-password");
      await waitForPageLoad(page);

      // Should show invalid token card
      const invalidTokenCard = page.getByTestId("invalid-token-card");
      await expect(invalidTokenCard).toBeVisible();

      const invalidTokenTitle = page.getByRole("heading", {
        name: /invalid reset link/i,
      });
      await expect(invalidTokenTitle).toBeVisible();

      const invalidTokenDescription = page.getByText(
        /this password reset link is invalid or has expired/i
      );
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

    test("should show password reset success message", async ({ page }) => {
      await page.goto("/login?message=password-reset-success");
      await waitForPageLoad(page);

      // Should show success message
      const successMessage = page.getByText(/password reset successful/i);
      await expect(successMessage).toBeVisible();
    });
  });

  test.describe("Accessibility and UX", () => {
    test("should have proper ARIA labels and semantic structure", async ({
      page,
    }) => {
      await page.goto("/forgot-password");
      await waitForPageLoad(page);

      // Check form has proper labels
      const emailInput = page.getByTestId("email-input");
      await expect(emailInput).toHaveAttribute("required");

      // Use more specific selector to avoid conflicts
      const emailLabel = page
        .getByTestId("email-field")
        .getByText("Email address");
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
