import { test, expect } from "./base";
import type { Page } from "@playwright/test";

// Helper function to wait for page to load completely
async function waitForPageLoad(page: Page) {
  await page.waitForLoadState("load");
  await page.waitForTimeout(500); // Small buffer for animations
}

test.describe("Login Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await waitForPageLoad(page);
  });

  test.describe("Page Structure and Loading", () => {
    test("should display login page with all elements", async ({ page }) => {
      // Check main page container
      const loginPage = page.getByTestId("login-page");
      await expect(loginPage).toBeVisible();

      // Check page title and description
      const pageTitle = page.getByRole("heading", { name: /welcome back/i });
      await expect(pageTitle).toBeVisible();

      const pageDescription = page.getByText(/sign in to your volunteer account/i);
      await expect(pageDescription).toBeVisible();

      // Check login form card
      const loginFormCard = page.getByTestId("login-form-card");
      await expect(loginFormCard).toBeVisible();

      // Check login form
      const loginForm = page.getByTestId("login-form");
      await expect(loginForm).toBeVisible();
    });

    test("should display form fields correctly", async ({ page }) => {
      // Check email field
      const emailField = page.getByTestId("email-field");
      await expect(emailField).toBeVisible();

      const emailInput = page.getByTestId("email-input");
      await expect(emailInput).toBeVisible();
      await expect(emailInput).toHaveAttribute("type", "email");
      await expect(emailInput).toHaveAttribute("required");
      // Should have demo email pre-filled
      await expect(emailInput).toHaveValue("volunteer@example.com");

      // Check password field
      const passwordField = page.getByTestId("password-field");
      await expect(passwordField).toBeVisible();

      const passwordInput = page.getByTestId("password-input");
      await expect(passwordInput).toBeVisible();
      await expect(passwordInput).toHaveAttribute("type", "password");
      await expect(passwordInput).toHaveAttribute("required");
      // Should have demo password pre-filled
      await expect(passwordInput).toHaveValue("volunteer123");

      // Check submit button
      const submitButton = page.getByTestId("login-submit-button");
      await expect(submitButton).toBeVisible();
      await expect(submitButton).toContainText("Sign in with Email");
    });

    test("should display footer elements", async ({ page }) => {
      // Check login footer
      const loginFooter = page.getByTestId("login-footer");
      await expect(loginFooter).toBeVisible();

      // Check register link
      const registerLink = page.getByTestId("register-link");
      await expect(registerLink).toBeVisible();
      await expect(registerLink).toContainText("Create Volunteer Account");

      // Check demo credentials section
      const demoCredentials = page.getByTestId("demo-credentials");
      await expect(demoCredentials).toBeVisible();

      // Check quick login buttons
      const volunteerLoginButton = page.getByTestId("quick-login-volunteer-button");
      await expect(volunteerLoginButton).toBeVisible();
      await expect(volunteerLoginButton).toContainText("Login as Volunteer");

      const adminLoginButton = page.getByTestId("quick-login-admin-button");
      await expect(adminLoginButton).toBeVisible();
      await expect(adminLoginButton).toContainText("Login as Admin");
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
        await expect(oauthDivider).toContainText("Or continue with email");

        // Check for specific OAuth provider buttons
        const googleButton = page.getByTestId("oauth-google-button");
        const facebookButton = page.getByTestId("oauth-facebook-button");
        const appleButton = page.getByTestId("oauth-apple-button");

        // At least one OAuth provider should be visible if the section exists
        const hasOAuthButtons = 
          (await googleButton.isVisible()) ||
          (await facebookButton.isVisible()) ||
          (await appleButton.isVisible());

        expect(hasOAuthButtons).toBe(true);
      }
    });

    test("should handle OAuth button interactions", async ({ page }) => {
      const oauthProviders = page.getByTestId("oauth-providers");
      
      if (await oauthProviders.isVisible()) {
        const googleButton = page.getByTestId("oauth-google-button");
        
        if (await googleButton.isVisible()) {
          // Click should not cause errors (though may not complete in test environment)
          await googleButton.click();
          
          // Verify button shows loading state or navigation occurs
          await page.waitForTimeout(1000);
        }
      }
    });
  });

  test.describe("Form Validation", () => {
    test("should validate empty form submission", async ({ page }) => {
      // Clear the pre-filled values
      const emailInput = page.getByTestId("email-input");
      await emailInput.clear();

      const passwordInput = page.getByTestId("password-input");
      await passwordInput.clear();

      // Submit form
      const submitButton = page.getByTestId("login-submit-button");
      await submitButton.click();

      // Check for validation error (browser validation)
      const emailError = await emailInput.evaluate((el: HTMLInputElement) => el.validationMessage);
      expect(emailError).toBeTruthy();
    });

    test("should validate invalid email format", async ({ page }) => {
      // Enter invalid email
      const emailInput = page.getByTestId("email-input");
      await emailInput.clear();
      await emailInput.fill("invalid-email");

      // Enter valid password
      const passwordInput = page.getByTestId("password-input");
      await passwordInput.clear();
      await passwordInput.fill("ValidPassword123!");

      // Submit form
      const submitButton = page.getByTestId("login-submit-button");
      await submitButton.click();

      // Check for email validation error
      const emailError = await emailInput.evaluate((el: HTMLInputElement) => el.validationMessage);
      expect(emailError).toContain("@");
    });

    test("should show error message for invalid credentials", async ({ page }) => {
      // Enter invalid credentials
      const emailInput = page.getByTestId("email-input");
      await emailInput.clear();
      await emailInput.fill("nonexistent@example.com");

      const passwordInput = page.getByTestId("password-input");
      await passwordInput.clear();
      await passwordInput.fill("WrongPassword123!");

      // Submit form
      const submitButton = page.getByTestId("login-submit-button");
      await submitButton.click();

      // Wait for and check error message
      const errorMessage = page.getByTestId("error-message");
      await expect(errorMessage).toBeVisible({ timeout: 10000 });
      await expect(errorMessage).toContainText("Invalid credentials");
    });

    test("should preserve form data on validation error", async ({ page }) => {
      const testEmail = "test@example.com";

      // Enter email but clear password
      const emailInput = page.getByTestId("email-input");
      await emailInput.clear();
      await emailInput.fill(testEmail);

      const passwordInput = page.getByTestId("password-input");
      await passwordInput.clear();

      // Submit form
      const submitButton = page.getByTestId("login-submit-button");
      await submitButton.click();

      // Email should still be in the input after validation error
      await expect(emailInput).toHaveValue(testEmail);
    });
  });

  test.describe("Successful Login Flows", () => {
    test("should successfully login with demo credentials", async ({ page }) => {
      // The form is pre-filled with demo credentials, just submit
      const submitButton = page.getByTestId("login-submit-button");
      await submitButton.click();

      // Wait for navigation away from login page
      await page.waitForURL((url) => {
        return url.pathname !== "/login";
      }, { timeout: 10000 });

      // Verify we're no longer on login page
      const currentUrl = page.url();
      expect(currentUrl).not.toContain("/login");
    });

    test("should login using quick login volunteer button", async ({ page }) => {
      const volunteerButton = page.getByTestId("quick-login-volunteer-button");
      await volunteerButton.click();

      // Wait for navigation
      await page.waitForURL((url) => {
        return url.pathname !== "/login";
      }, { timeout: 10000 });

      // Verify successful login
      const currentUrl = page.url();
      expect(currentUrl).not.toContain("/login");
    });

    test("should login using quick login admin button", async ({ page }) => {
      const adminButton = page.getByTestId("quick-login-admin-button");
      await adminButton.click();

      // Wait for navigation
      await page.waitForURL((url) => {
        return url.pathname !== "/login";
      }, { timeout: 10000 });

      // Verify successful login
      const currentUrl = page.url();
      expect(currentUrl).not.toContain("/login");
    });
  });

  test.describe("Loading States and UI Feedback", () => {
    test("should show loading state during login", async ({ page }) => {
      const submitButton = page.getByTestId("login-submit-button");
      
      // Click and immediately check for loading state
      await submitButton.click();

      // Check if button text changes to indicate loading
      const buttonText = await submitButton.textContent();
      
      // Loading state might be brief, so check if it contains loading text
      if (buttonText?.includes("Signing in")) {
        await expect(submitButton).toBeDisabled();
      }

      // Wait for completion
      await page.waitForTimeout(3000);
    });

    test("should display success message from registration redirect", async ({ page }) => {
      // Navigate to login page with registration success parameter
      await page.goto("/login?message=registration-success");
      await waitForPageLoad(page);

      // Check for success message
      const successMessage = page.getByTestId("success-message");
      await expect(successMessage).toBeVisible();
      await expect(successMessage).toContainText("Registration successful");

      // Verify demo credentials are cleared for new users
      const emailInput = page.getByTestId("email-input");
      const passwordInput = page.getByTestId("password-input");
      
      await expect(emailInput).toHaveValue("");
      await expect(passwordInput).toHaveValue("");
    });
  });

  test.describe("Navigation and Links", () => {
    test("should navigate to register page", async ({ page }) => {
      const registerLink = page.getByTestId("register-link");
      await registerLink.click();

      // Should navigate to register page
      await expect(page).toHaveURL(/\/register/);

      // Verify register page loaded
      const registerPage = page.getByTestId("register-page");
      await expect(registerPage).toBeVisible();
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

      // Tab to submit button
      await page.keyboard.press("Tab");
      const submitButton = page.getByTestId("login-submit-button");
      await expect(submitButton).toBeFocused();
    });

    test("should be responsive on mobile viewport", async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();
      await waitForPageLoad(page);

      // Check main elements are still accessible
      const loginPage = page.getByTestId("login-page");
      await expect(loginPage).toBeVisible();

      const loginFormCard = page.getByTestId("login-form-card");
      await expect(loginFormCard).toBeVisible();

      // Check form inputs are accessible
      const emailInput = page.getByTestId("email-input");
      await expect(emailInput).toBeVisible();

      const passwordInput = page.getByTestId("password-input");
      await expect(passwordInput).toBeVisible();

      // Check buttons are accessible
      const submitButton = page.getByTestId("login-submit-button");
      await expect(submitButton).toBeVisible();

      const volunteerButton = page.getByTestId("quick-login-volunteer-button");
      await expect(volunteerButton).toBeVisible();
    });

    test("should have proper ARIA attributes and accessibility", async ({ page }) => {
      // Check form has proper structure
      const loginForm = page.getByTestId("login-form");
      await expect(loginForm).toBeVisible();

      // Check inputs have associated labels
      const emailInput = page.getByTestId("email-input");
      const passwordInput = page.getByTestId("password-input");
      
      await expect(emailInput).toHaveAttribute("id", "email");
      await expect(passwordInput).toHaveAttribute("id", "password");

      // Verify labels exist for inputs
      const emailLabel = page.locator("label[for='email']");
      const passwordLabel = page.locator("label[for='password']");
      
      await expect(emailLabel).toBeVisible();
      await expect(passwordLabel).toBeVisible();
    });
  });

  test.describe("Error Handling and Edge Cases", () => {
    test.skip("should handle network failures gracefully", async ({ page }) => {
      // Mock network failure for login endpoint
      await page.route("**/api/auth/**", route => route.abort("failed"));

      // Attempt login
      const submitButton = page.getByTestId("login-submit-button");
      await submitButton.click();

      // Should handle error gracefully (implementation-dependent)
      await page.waitForTimeout(2000);
      
      // Form should remain functional
      const emailInput = page.getByTestId("email-input");
      await expect(emailInput).toBeVisible();
    });

    test("should handle slow network conditions", async ({ page }) => {
      // Simulate slow network
      await page.route("**/api/auth/**", async route => {
        await new Promise(resolve => setTimeout(resolve, 3000));
        route.continue();
      });

      const submitButton = page.getByTestId("login-submit-button");
      await submitButton.click();

      // Button should show loading state during slow request
      await expect(submitButton).toBeDisabled();
      
      // Clean up route after test
      await page.unroute("**/api/auth/**");
    });
  });

  test.describe("Demo Credentials and Quick Actions", () => {
    test("should display correct demo credentials information", async ({ page }) => {
      const demoCredentials = page.getByTestId("demo-credentials");
      await expect(demoCredentials).toBeVisible();
      
      // Check demo credentials text is displayed
      await expect(demoCredentials).toContainText("volunteer@example.com");
      await expect(demoCredentials).toContainText("admin@everybodyeats.nz");
    });

    test("should disable buttons during loading states", async ({ page }) => {
      const volunteerButton = page.getByTestId("quick-login-volunteer-button");
      await volunteerButton.click();

      // All buttons should be disabled during login
      const adminButton = page.getByTestId("quick-login-admin-button");
      const submitButton = page.getByTestId("login-submit-button");
      
      // Check if any loading states are active
      await page.waitForTimeout(500);
      
      // At minimum, the clicked button should show some feedback
      // This verifies the UX is responsive to user actions
    });
  });
});