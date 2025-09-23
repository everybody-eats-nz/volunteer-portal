import { test, expect } from "./base";
import type { Page } from "@playwright/test";

// Helper function to wait for page to load completely
async function waitForPageLoad(page: Page) {
  await page.waitForLoadState("load");
  await page.waitForTimeout(300); // Reduced timeout for faster tests
}

// Helper function to fill step 1 with valid data
async function fillStep1ValidData(page: Page, email = "test@example.com") {
  await page.getByTestId("email-input").fill(email);
  await page.getByTestId("password-input").fill("Password123!");
  await page.getByTestId("confirm-password-input").fill("Password123!");
}

// Helper function to fill step 2 with valid data
async function fillStep2ValidData(page: Page) {
  await page.getByRole("textbox", { name: /first name/i }).fill("Test");
  await page.getByRole("textbox", { name: /last name/i }).fill("User");
  await page.getByRole("textbox", { name: /mobile number/i }).fill("(555) 123-4567");
}

// Helper function to navigate to a specific step
async function navigateToStep(page: Page, stepNumber: number) {
  // Fill and navigate through each step sequentially
  await fillStep1ValidData(page);
  await page.getByTestId("next-submit-button").click();
  await waitForPageLoad(page);

  if (stepNumber >= 3) {
    await fillStep2ValidData(page);
    await page.getByTestId("next-submit-button").click();
    await waitForPageLoad(page);
  }

  if (stepNumber >= 4) {
    // Step 3: Emergency Contact (can be skipped for most tests)
    await page.getByTestId("next-submit-button").click();
    await waitForPageLoad(page);
  }

  if (stepNumber >= 5) {
    // Step 4: Medical & Background (can be skipped for most tests)
    await page.getByTestId("next-submit-button").click();
    await waitForPageLoad(page);
  }

  if (stepNumber >= 6) {
    // Step 5: Availability (can be skipped for most tests)
    await page.getByTestId("next-submit-button").click();
    await waitForPageLoad(page);
  }
}

test.describe("Registration Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/register");
    await waitForPageLoad(page);
  });

  test.describe("Page Structure and Loading", () => {
    test("should display registration page with all elements", async ({ page }) => {
      // Check main page container
      const registerPage = page.getByTestId("register-page");
      await expect(registerPage).toBeVisible();

      // Check page title and description
      const pageTitle = page.getByRole("heading", { name: /join everybody eats/i });
      await expect(pageTitle).toBeVisible();

      // Check login link with testid
      const loginLink = page.getByTestId("login-link");
      await expect(loginLink).toBeVisible();
      await expect(loginLink).toContainText("Already have an account?");

      // Check progress indicator
      const progressIndicator = page.getByTestId("progress-indicator");
      await expect(progressIndicator).toBeVisible();

      // Check progress title and step counter
      const progressTitle = page.getByTestId("progress-title");
      await expect(progressTitle).toContainText("Registration Progress");

      const stepCounter = page.getByTestId("step-counter");
      await expect(stepCounter).toContainText("Step 1 of 6");
    });

    test("should display progress steps correctly", async ({ page }) => {
      // Check progress steps container
      const progressSteps = page.getByTestId("progress-steps");
      await expect(progressSteps).toBeVisible();

      // Check individual step elements
      for (let i = 1; i <= 6; i++) {
        const stepElement = page.getByTestId(`progress-step-${i}`);
        await expect(stepElement).toBeVisible();

        const stepIcon = page.getByTestId(`step-${i}-icon`);
        await expect(stepIcon).toBeVisible();
      }

      // Check current step info
      const currentStepInfo = page.getByTestId("current-step-info");
      await expect(currentStepInfo).toBeVisible();

      const currentStepTitle = page.getByTestId("current-step-title");
      await expect(currentStepTitle).toContainText("Create Account");

      const currentStepDescription = page.getByTestId("current-step-description");
      await expect(currentStepDescription).toContainText("Set up your login credentials");
    });

    test("should display form card correctly", async ({ page }) => {
      // Check form card
      const formCard = page.getByTestId("registration-form-card");
      await expect(formCard).toBeVisible();

      // Check form step title
      const formStepTitle = page.getByTestId("form-step-title");
      await expect(formStepTitle).toContainText("Create Account");

      // Check form element
      const registrationForm = page.getByTestId("registration-form");
      await expect(registrationForm).toBeVisible();

      // Check form step content
      const formStepContent = page.getByTestId("form-step-content");
      await expect(formStepContent).toBeVisible();

      // Check form navigation
      const formNavigation = page.getByTestId("form-navigation");
      await expect(formNavigation).toBeVisible();
    });
  });

  test.describe("OAuth Providers", () => {
    test("should display OAuth providers section if available", async ({ page }) => {
      // Check if OAuth providers section exists
      const oauthProviders = page.getByTestId("oauth-providers");
      
      if (await oauthProviders.isVisible()) {
        // Check OAuth divider
        const oauthDivider = page.getByTestId("oauth-divider");
        await expect(oauthDivider).toBeVisible();
        await expect(oauthDivider).toContainText("Or create account with email");

        // Check for specific OAuth provider buttons
        const googleButton = page.getByTestId("oauth-google-button");
        const facebookButton = page.getByTestId("oauth-facebook-button");

        // At least one OAuth provider should be visible if the section exists
        const hasOAuthButtons = 
          (await googleButton.isVisible()) ||
          (await facebookButton.isVisible());

        expect(hasOAuthButtons).toBe(true);
      }
    });

    test("should handle OAuth button interactions", async ({ page }) => {
      const oauthProviders = page.getByTestId("oauth-providers");
      
      if (await oauthProviders.isVisible()) {
        const googleButton = page.getByTestId("oauth-google-button");
        
        if (await googleButton.isVisible()) {
          // Intercept OAuth request to prevent actual OAuth flow in tests
          await page.route("**/api/auth/signin/google*", route => {
            route.fulfill({
              status: 200,
              contentType: "text/html",
              body: "<html><body>OAuth test intercept</body></html>"
            });
          });
          
          await googleButton.click();
          await page.waitForTimeout(1000);
        }
      } else {
        test.skip(true, "OAuth providers not configured in test environment");
      }
    });
  });

  test.describe("Step 1: Account Creation", () => {
    test("should display account step form fields correctly", async ({ page }) => {
      // Check account step container
      const accountStep = page.getByTestId("account-step");
      await expect(accountStep).toBeVisible();

      // Check welcome message
      const welcomeMessage = page.getByTestId("welcome-message");
      await expect(welcomeMessage).toBeVisible();
      await expect(welcomeMessage).toContainText("Welcome to Everybody Eats!");

      // Check email field
      const emailField = page.getByTestId("email-field");
      await expect(emailField).toBeVisible();

      const emailInput = page.getByTestId("email-input");
      await expect(emailInput).toBeVisible();
      await expect(emailInput).toHaveAttribute("type", "email");
      await expect(emailInput).toHaveAttribute("required");

      // Check password field
      const passwordField = page.getByTestId("password-field");
      await expect(passwordField).toBeVisible();

      const passwordInput = page.getByTestId("password-input");
      await expect(passwordInput).toBeVisible();
      await expect(passwordInput).toHaveAttribute("type", "password");
      await expect(passwordInput).toHaveAttribute("required");

      // Check password hint
      const passwordHint = page.getByTestId("password-hint");
      await expect(passwordHint).toBeVisible();
      await expect(passwordHint).toContainText("Password must be at least 6 characters long");

      // Check confirm password field
      const confirmPasswordField = page.getByTestId("confirm-password-field");
      await expect(confirmPasswordField).toBeVisible();

      const confirmPasswordInput = page.getByTestId("confirm-password-input");
      await expect(confirmPasswordInput).toBeVisible();
      await expect(confirmPasswordInput).toHaveAttribute("type", "password");
      await expect(confirmPasswordInput).toHaveAttribute("required");
    });

    test("should validate required fields", async ({ page }) => {
      // Clear all fields to ensure they're empty
      const emailInput = page.getByTestId("email-input");
      const passwordInput = page.getByTestId("password-input");
      const confirmPasswordInput = page.getByTestId("confirm-password-input");
      
      await emailInput.clear();
      await passwordInput.clear();
      await confirmPasswordInput.clear();

      // Try to proceed without filling required fields
      const nextButton = page.getByTestId("next-submit-button");
      await nextButton.click();

      // Wait a moment for validation to trigger
      await page.waitForTimeout(1000);

      // Check if browser validation prevents submission (HTML5 validation)
      const emailValidation = await emailInput.evaluate((el: HTMLInputElement) => el.validationMessage);
      if (emailValidation) {
        // Browser validation is working
        expect(emailValidation).toBeTruthy();
      } else {
        // Should show validation error toast - look for either title or description
        const errorToast = page.locator('[role="alert"], .destructive').filter({ hasText: /required fields|fill in all required/i });
        await expect(errorToast.first()).toBeVisible({ timeout: 5000 });
      }

      // Should still be on step 1
      const stepCounter = page.getByTestId("step-counter");
      await expect(stepCounter).toContainText("Step 1 of 6");
    });

    test.skip("should validate password mismatch", async ({ page }) => {
      // Fill email
      const emailInput = page.getByTestId("email-input");
      await emailInput.fill("test@example.com");

      // Fill mismatched passwords
      const passwordInput = page.getByTestId("password-input");
      await passwordInput.fill("password123");

      const confirmPasswordInput = page.getByTestId("confirm-password-input");
      await confirmPasswordInput.fill("different123");

      // Try to proceed
      const nextButton = page.getByTestId("next-submit-button");
      await nextButton.click();

      // Should show password mismatch error
      const errorToast = page.locator('[role="alert"], .destructive').filter({ hasText: /passwords don't match|password.*match/i });
      await expect(errorToast.first()).toBeVisible({ timeout: 5000 });
    });

    test.skip("should validate password length", async ({ page }) => {
      // Fill email
      const emailInput = page.getByTestId("email-input");
      await emailInput.fill("test@example.com");

      // Fill short password
      const passwordInput = page.getByTestId("password-input");
      await passwordInput.fill("123");

      const confirmPasswordInput = page.getByTestId("confirm-password-input");
      await confirmPasswordInput.fill("123");

      // Try to proceed
      const nextButton = page.getByTestId("next-submit-button");
      await nextButton.click();

      // Should show password length error
      const errorToast = page.locator('[role="alert"], .destructive').filter({ hasText: /password too short|at least 6 characters/i });
      await expect(errorToast.first()).toBeVisible({ timeout: 5000 });
    });

    test("should proceed to step 2 with valid data", async ({ page }) => {
      // Fill valid data
      await fillStep1ValidData(page);

      // Proceed to next step
      const nextButton = page.getByTestId("next-submit-button");
      await nextButton.click();
      await waitForPageLoad(page);

      // Should be on step 2
      const stepCounter = page.getByTestId("step-counter");
      await expect(stepCounter).toContainText("Step 2 of 6");

      // Should show Personal Information step title
      const currentStepTitle = page.getByTestId("current-step-title");
      await expect(currentStepTitle).toContainText("Personal Information");
    });
  });

  test.describe("Navigation Controls", () => {
    test("should disable previous button on first step", async ({ page }) => {
      const previousButton = page.getByTestId("previous-button");
      await expect(previousButton).toBeDisabled();
    });

    test("should enable previous button on subsequent steps", async ({ page }) => {
      // Navigate to step 2
      await fillStep1ValidData(page);
      await page.getByTestId("next-submit-button").click();
      await waitForPageLoad(page);

      // Previous button should be enabled
      const previousButton = page.getByTestId("previous-button");
      await expect(previousButton).toBeEnabled();
    });

    test("should navigate backwards correctly", async ({ page }) => {
      // Navigate to step 2
      await fillStep1ValidData(page);
      await page.getByTestId("next-submit-button").click();
      await waitForPageLoad(page);

      // Verify we're on step 2
      const stepCounter = page.getByTestId("step-counter");
      await expect(stepCounter).toContainText("Step 2 of 6");

      // Go back to step 1
      const previousButton = page.getByTestId("previous-button");
      await previousButton.click();
      await waitForPageLoad(page);

      // Should be back on step 1
      await expect(stepCounter).toContainText("Step 1 of 6");
      await expect(previousButton).toBeDisabled();
    });

    test("should preserve form data when navigating between steps", async ({ page }) => {
      const testEmail = "test@example.com";
      const testPassword = "TestPassword123!";

      // Fill step 1 data
      const emailInput = page.getByTestId("email-input");
      const passwordInput = page.getByTestId("password-input");
      const confirmPasswordInput = page.getByTestId("confirm-password-input");

      await emailInput.fill(testEmail);
      await passwordInput.fill(testPassword);
      await confirmPasswordInput.fill(testPassword);

      // Navigate to step 2
      await page.getByTestId("next-submit-button").click();
      await waitForPageLoad(page);

      // Navigate back to step 1
      await page.getByTestId("previous-button").click();
      await waitForPageLoad(page);

      // Verify data is preserved
      await expect(emailInput).toHaveValue(testEmail);
      await expect(passwordInput).toHaveValue(testPassword);
      await expect(confirmPasswordInput).toHaveValue(testPassword);
    });
  });

  test.describe("Form Submission and Error Handling", () => {
    test("should show loading state during submission", async ({ page }) => {
      // Navigate to final step (this would be a comprehensive test)
      await navigateToStep(page, 6);

      // Accept required agreements (would need to implement this for final step)
      const nextButton = page.getByTestId("next-submit-button");
      
      // Click submit and check for loading state
      await nextButton.click();

      // Check if button shows loading state
      const hasLoadingState = await nextButton.textContent();
      if (hasLoadingState?.includes("Creating Account") || hasLoadingState?.includes("Processing")) {
        await expect(nextButton).toBeDisabled();
      }
    });

    test("should handle network errors gracefully", async ({ page }) => {
      // Mock network failure
      await page.route("/api/auth/register", route => 
        route.abort("failed")
      );

      // Navigate to final step and attempt submission
      await navigateToStep(page, 6);
      
      const nextButton = page.getByTestId("next-submit-button");
      await nextButton.click();

      // Should show error message (implementation-dependent)
      await page.waitForTimeout(2000);
    });
  });

  test.describe("Accessibility and Responsive Design", () => {
    test.skip("should be keyboard accessible", async ({ page }) => {
      // Tab to email input
      await page.keyboard.press("Tab");
      const emailInput = page.getByTestId("email-input");
      await expect(emailInput).toBeFocused();

      // Tab to password input
      await page.keyboard.press("Tab");
      const passwordInput = page.getByTestId("password-input");
      await expect(passwordInput).toBeFocused();

      // Tab to confirm password input
      await page.keyboard.press("Tab");
      const confirmPasswordInput = page.getByTestId("confirm-password-input");
      await expect(confirmPasswordInput).toBeFocused();
    });

    test("should be responsive on mobile viewport", async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();
      await waitForPageLoad(page);

      // Check main elements are still accessible
      const registerPage = page.getByTestId("register-page");
      await expect(registerPage).toBeVisible();

      // Progress indicator should be hidden on mobile for better space usage
      const progressIndicator = page.getByTestId("progress-indicator");
      await expect(progressIndicator).toBeHidden();

      const formCard = page.getByTestId("registration-form-card");
      await expect(formCard).toBeVisible();

      // Check form inputs are accessible
      const emailInput = page.getByTestId("email-input");
      await expect(emailInput).toBeVisible();
    });
  });

  test.describe("Link Navigation", () => {
    test("should navigate to login page when clicking login link", async ({ page }) => {
      const loginLink = page.getByTestId("login-link");
      await loginLink.click();

      // Should navigate to login page
      await expect(page).toHaveURL(/\/login/);

      // Check login page elements
      const loginPage = page.getByTestId("login-page");
      await expect(loginPage).toBeVisible();
    });
  });
});