---
title: Testing Framework
description: End-to-end testing with Playwright and test automation
---

This project uses **Playwright** for comprehensive end-to-end testing. We focus on testing user workflows and ensuring the application works correctly from a user's perspective.

## Quick Start

```bash
cd web

# Run all tests (all browsers)
npm run test:e2e

# Run tests in UI mode (recommended for development)
npm run test:e2e:ui

# Run tests in CI mode (Chromium only, recommended)
npm run test:e2e:ci

# Run specific test file in Chromium (fastest for debugging)
npx playwright test login.spec.ts --project=chromium

# Run tests in headed mode
npx playwright test --headed

# Run tests in debug mode
npx playwright test --debug
```

:::tip[Best Practice]
**Always run tests with `--project=chromium`** when developing or debugging specific tests. This avoids cross-browser compatibility issues and provides cleaner output. Running tests across all browsers is better suited for CI/CD pipelines.
:::

## Project Structure

```
web/tests/
├── e2e/                          # All end-to-end test files
│   ├── base.ts                   # Extended Playwright test with animation disabling
│   ├── helpers/                  # Test helper utilities
│   │   ├── auth.ts              # Authentication helpers (loginAsAdmin, loginAsVolunteer)
│   │   ├── test-helpers.ts      # Database and test data helpers
│   │   └── custom-labels.ts     # Custom label helpers
│   ├── login.spec.ts            # Login page tests
│   ├── register.spec.ts         # Registration tests
│   ├── dashboard.spec.ts        # Dashboard tests
│   ├── admin-*.spec.ts          # Admin feature tests
│   ├── profile*.spec.ts         # Profile management tests
│   ├── shifts*.spec.ts          # Shift browsing/management tests
│   ├── group-booking.spec.ts    # Group booking tests
│   └── ...                      # Other feature tests
└── playwright.config.ts          # Playwright configuration
```

## Test Configuration

The Playwright configuration (`web/playwright.config.ts`) includes:

- **Test directory**: `./tests/e2e`
- **Base URL**: `http://localhost:3000`
- **Browsers**: Chromium, Firefox, WebKit
- **Retries**: 2 retries in CI, 0 in local development
- **Workers**: 2 parallel workers in CI, unlimited in local
- **Screenshots**: Only on failure
- **Traces**: On first retry
- **Web server**: Automatically starts dev server with animations disabled

### Animation Handling

Tests automatically disable animations using:
- Environment variables: `NEXT_PUBLIC_DISABLE_ANIMATIONS=true` and `PLAYWRIGHT_TEST=true`
- CSS class: `e2e-testing` added to document body (via `base.ts`)

This ensures consistent, fast, and reliable tests without animation delays.

## Writing Tests

### Basic Test Structure

All tests import from `./base` instead of directly from `@playwright/test`:

```typescript
import { test, expect } from "./base";

test.describe("Feature Name", () => {
  test.beforeEach(async ({ page }) => {
    // Setup before each test
    await page.goto("/some-page");
  });

  test("should do something", async ({ page }) => {
    // Test implementation
    const element = page.getByTestId("element-id");
    await expect(element).toBeVisible();
  });
});
```

### Authentication Helpers

Use the authentication helpers from `helpers/auth.ts`:

```typescript
import { loginAsAdmin, loginAsVolunteer, logout } from "./helpers/auth";

test.describe("Protected Page", () => {
  test("should allow admin access", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin");
    // Test admin functionality
  });

  test("should allow volunteer access", async ({ page }) => {
    await loginAsVolunteer(page);
    await page.goto("/dashboard");
    // Test volunteer functionality
  });

  // Login with custom email
  test("should allow custom user login", async ({ page }) => {
    await loginAsVolunteer(page, "custom@example.com");
    // Test with specific user
  });
});
```

### Database Helpers

Use the database helpers from `helpers/test-helpers.ts`:

```typescript
import {
  createTestUser,
  deleteTestUsers,
  createShift,
  deleteTestShifts
} from "./helpers/test-helpers";

test.describe("User Management", () => {
  const testEmails = ["test1@example.com", "test2@example.com"];
  const shiftIds: string[] = [];

  test.beforeEach(async () => {
    // Create test users
    await createTestUser("test1@example.com", "VOLUNTEER");
    await createTestUser("test2@example.com", "ADMIN");

    // Create test shift
    const shift = await createShift({
      location: "Wellington",
      start: new Date("2025-12-25T09:00:00Z"),
      capacity: 10,
    });
    shiftIds.push(shift.id);
  });

  test.afterEach(async () => {
    // Cleanup
    await deleteTestShifts(shiftIds);
    await deleteTestUsers(testEmails);
  });

  test("should manage users correctly", async ({ page }) => {
    // Your test here
  });
});
```

## Data-TestId Guidelines

We use `data-testid` attributes for reliable element selection. Follow these naming conventions:

### Naming Patterns

Use descriptive, hierarchical naming: `section-element-type`

```tsx
// ✅ Good - Clear, hierarchical naming
<div data-testid="login-page">
  <form data-testid="login-form">
    <input data-testid="email-input" />
    <input data-testid="password-input" />
    <button data-testid="login-submit-button">Sign in</button>
  </form>
  <div data-testid="demo-credentials">
    <button data-testid="quick-login-volunteer-button">
      Login as Volunteer
    </button>
    <button data-testid="quick-login-admin-button">
      Login as Admin
    </button>
  </div>
</div>

// ❌ Bad - Generic, unclear naming
<div data-testid="page">
  <form data-testid="form">
    <input data-testid="input1" />
    <button data-testid="btn">Submit</button>
  </form>
</div>
```

### When to Add TestIds

Add `data-testid` attributes to:
- Page containers and sections
- Form fields and inputs
- Interactive elements (buttons, links)
- Content that tests need to verify
- Elements that might have duplicate text

### Element Selection

Prefer this hierarchy for selecting elements:

1. **TestIds** - Most reliable: `page.getByTestId("login-button")`
2. **Roles** - Semantic: `page.getByRole("button", { name: "Sign in" })`
3. **Labels** - For form fields: `page.getByLabel("Email address")`
4. **Text** - Use sparingly: `page.getByText("Welcome back")`

## Common Test Patterns

### Testing Page Structure

```typescript
test("should display all page elements", async ({ page }) => {
  await page.goto("/dashboard");

  // Check main sections
  const dashboardPage = page.getByTestId("dashboard-page");
  await expect(dashboardPage).toBeVisible();

  // Check heading
  const heading = page.getByRole("heading", { name: /volunteer dashboard/i });
  await expect(heading).toBeVisible();

  // Check specific elements
  await expect(page.getByTestId("upcoming-shifts-section")).toBeVisible();
  await expect(page.getByTestId("achievements-section")).toBeVisible();
});
```

### Testing Forms and Validation

```typescript
test("should validate form submission", async ({ page }) => {
  await page.goto("/profile/edit");

  // Clear required field
  const nameInput = page.getByTestId("name-input");
  await nameInput.clear();

  // Submit form
  const submitButton = page.getByTestId("save-button");
  await submitButton.click();

  // Check for validation error
  const errorMessage = page.getByTestId("error-message");
  await expect(errorMessage).toBeVisible();
  await expect(errorMessage).toContainText("Name is required");
});
```

### Testing Navigation

```typescript
test("should navigate to shift details", async ({ page }) => {
  await loginAsVolunteer(page);
  await page.goto("/shifts");

  // Click on first shift
  const firstShift = page.getByTestId("shift-card").first();
  await firstShift.click();

  // Verify navigation
  await expect(page).toHaveURL(/\/shifts\/\w+/);

  // Verify detail page loaded
  const detailsPage = page.getByTestId("shift-details-page");
  await expect(detailsPage).toBeVisible();
});
```

### Testing with Loading States

```typescript
test("should show loading state during submission", async ({ page }) => {
  const submitButton = page.getByTestId("submit-button");

  // Click and check for loading state
  await submitButton.click();

  // Button should be disabled during loading
  await expect(submitButton).toBeDisabled();

  // Wait for completion
  await page.waitForURL("/success");
});
```

### Testing Accessibility

```typescript
test("should be keyboard accessible", async ({ page }) => {
  await page.goto("/login");

  // Tab to email input
  await page.keyboard.press("Tab");
  const emailInput = page.getByTestId("email-input");
  await expect(emailInput).toBeFocused();

  // Type email
  await page.keyboard.type("test@example.com");

  // Tab to password input
  await page.keyboard.press("Tab");
  const passwordInput = page.getByTestId("password-input");
  await expect(passwordInput).toBeFocused();

  // Verify inputs have labels
  const emailLabel = page.locator("label[for='email']");
  await expect(emailLabel).toBeVisible();
});
```

### Testing Responsive Design

```typescript
test("should be responsive on mobile", async ({ page }) => {
  // Set mobile viewport
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/dashboard");

  // Check elements are visible on mobile
  const mobileNav = page.getByTestId("mobile-navigation");
  await expect(mobileNav).toBeVisible();

  const hamburgerMenu = page.getByTestId("hamburger-menu-button");
  await expect(hamburgerMenu).toBeVisible();

  // Click hamburger to open menu
  await hamburgerMenu.click();

  const navMenu = page.getByTestId("nav-menu");
  await expect(navMenu).toBeVisible();
});
```

### Testing Error Handling

```typescript
test("should handle network errors gracefully", async ({ page }) => {
  // Attempt action with invalid data
  await page.goto("/login");
  await page.getByTestId("email-input").fill("invalid@example.com");
  await page.getByTestId("password-input").fill("wrongpassword");
  await page.getByTestId("login-submit-button").click();

  // Should show error message
  const errorMessage = page.getByTestId("error-message");
  await expect(errorMessage).toBeVisible({ timeout: 10000 });
  await expect(errorMessage).toContainText("Invalid credentials");

  // Form should remain functional
  await expect(page.getByTestId("email-input")).toBeEnabled();
  await expect(page.getByTestId("login-submit-button")).toBeEnabled();
});
```

### Testing Authorization

```typescript
test("should prevent unauthorized access", async ({ page }) => {
  // Try to access admin page as volunteer
  await loginAsVolunteer(page);
  await page.goto("/admin");

  // Should redirect away from admin page
  await expect(page).not.toHaveURL("/admin");

  // Should be on dashboard or home page
  const currentUrl = page.url();
  expect(currentUrl).toMatch(/\/(dashboard|$)/);
});
```

## Best Practices

### 1. Test User Workflows, Not Implementation

Focus on what users do, not how it's implemented:

```typescript
// ✅ Good - Tests user workflow
test("should allow user to sign up for shift", async ({ page }) => {
  await loginAsVolunteer(page);
  await page.goto("/shifts");

  const firstShift = page.getByTestId("shift-card").first();
  await firstShift.getByTestId("signup-button").click();

  await page.getByTestId("confirm-signup-button").click();

  await expect(page.getByTestId("success-message"))
    .toContainText("Successfully signed up");
});

// ❌ Bad - Tests implementation details
test("should call signup API", async ({ page }) => {
  // Don't test API calls or internal state
});
```

### 2. Use Descriptive Test Names

```typescript
// ✅ Good - Clear what is being tested
test("should redirect to profile completion for new OAuth users", ...);
test("should show validation error for invalid email format", ...);

// ❌ Bad - Vague or technical
test("test login", ...);
test("check API response", ...);
```

### 3. Keep Tests Independent

Each test should be able to run independently:

```typescript
// ✅ Good - Self-contained test
test("should delete shift", async ({ page }) => {
  await loginAsAdmin(page);

  // Create shift for this test
  const shift = await createShift({
    location: "Wellington",
    start: new Date("2025-12-25T09:00:00Z"),
    capacity: 5,
  });

  // Test deletion
  await page.goto(`/admin/shifts/${shift.id}`);
  await page.getByTestId("delete-button").click();
  await page.getByTestId("confirm-delete-button").click();

  // Verify deletion
  await expect(page.getByTestId("success-message")).toBeVisible();
});

// ❌ Bad - Depends on other tests
test("should delete shift created in previous test", ...);
```

### 4. Clean Up Test Data

Always clean up data created during tests:

```typescript
test.describe("Shift Management", () => {
  const shiftIds: string[] = [];

  test.afterEach(async () => {
    await deleteTestShifts(shiftIds);
  });

  test("should create shift", async ({ page }) => {
    // Create shift
    const shift = await createShift({...});
    shiftIds.push(shift.id); // Track for cleanup

    // Test logic
  });
});
```

### 5. Use Proper Waiting Strategies

```typescript
// ✅ Good - Wait for specific conditions
await page.waitForURL("/dashboard");
await expect(element).toBeVisible({ timeout: 10000 });
await page.waitForLoadState("load");

// ❌ Bad - Arbitrary timeouts
await page.waitForTimeout(5000); // Only use when absolutely necessary
```

### 6. Test Both Success and Error Cases

```typescript
test.describe("Login", () => {
  test("should login with valid credentials", async ({ page }) => {
    // Test success case
  });

  test("should show error for invalid credentials", async ({ page }) => {
    // Test error case
  });

  test("should validate empty form submission", async ({ page }) => {
    // Test validation
  });
});
```

## Debugging Tests

### Visual Debugging

```bash
# Run in UI mode (recommended)
npm run test:e2e:ui

# Run in headed mode
npx playwright test --headed

# Run in debug mode with step-through
npx playwright test --debug
```

### Using Console Logs

```typescript
test("debugging example", async ({ page }) => {
  // Log page URL
  console.log("Current URL:", page.url());

  // Log element text
  const text = await page.getByTestId("element").textContent();
  console.log("Element text:", text);

  // Take screenshot
  await page.screenshot({ path: "debug.png" });
});
```

### Viewing Test Results

```bash
# Show HTML report after test run
npx playwright show-report

# View traces for failed tests (if trace: 'on-first-retry' is enabled)
npx playwright show-trace trace.zip
```

## CI/CD Integration

Tests run automatically in CI with:
- **2 retries** for flaky tests
- **2 parallel workers** for performance
- **Blob reporter** for aggregating results
- **Screenshots and traces** for failures

The CI configuration ensures tests are reliable and provides debugging information when tests fail.

## Common Troubleshooting

### Test Timeout

If tests timeout, check:
1. Is the dev server running? (Playwright auto-starts it)
2. Are animations disabled? (Check `NEXT_PUBLIC_DISABLE_ANIMATIONS=true`)
3. Are you waiting for the right condition? (Use proper waitFor methods)

### Flaky Tests

If tests are flaky:
1. Add proper wait conditions instead of timeouts
2. Use `{ strict: false }` for non-unique selectors
3. Check for race conditions in async operations
4. Ensure animations are disabled

### Element Not Found

If elements aren't found:
1. Check the `data-testid` spelling
2. Verify the element is actually in the DOM (not conditionally rendered)
3. Use `page.locator("selector").count()` to debug
4. Check if element is in an iframe or shadow DOM

## Additional Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Testing Guide](/web/docs/testing-guide.md) - More detailed patterns and examples