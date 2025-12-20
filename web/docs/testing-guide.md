# CLAUDE.md - Testing Guidelines

This file provides guidance to Claude Code for working with tests in this directory, using Vitest for unit tests and Playwright for e2e testing.

## Overview

This project uses a comprehensive testing strategy:
- **Vitest** for unit testing utility functions, business logic, and isolated components
- **Playwright** for end-to-end testing of complete user workflows and integration tests

## Directory Structure

```
web/
├── src/
│   └── **/*.test.ts(x)    # Unit tests with Vitest (co-located with source)
│       └── lib/
│           └── calendar-utils.test.ts  # Example unit test
└── tests/
    ├── e2e/                    # End-to-end tests with Playwright
    │   ├── auth.spec.ts       # Authentication flow tests
    │   ├── admin.spec.ts      # Admin dashboard tests
    │   ├── volunteers.spec.ts # Volunteer management tests
    │   ├── shifts.spec.ts     # Shift scheduling tests
    │   └── profile.spec.ts    # Profile management tests
    ├── fixtures/              # Test data and fixtures
    │   ├── users.json        # Test user data
    │   ├── shifts.json       # Test shift data
    │   └── achievements.json # Test achievement data
    ├── utils/                 # Test utilities
    │   ├── auth-helpers.ts   # Authentication helpers
    │   ├── data-generators.ts # Random data generation
    │   └── db-helpers.ts     # Database setup/teardown
    └── setup/                # Test setup files
        ├── global-setup.ts   # Global test setup
        └── global-teardown.ts # Global test cleanup
```

## Testing Philosophy

This project uses a layered testing approach:

1. **Unit Tests (Vitest)**: Test individual functions, utilities, and business logic in isolation
2. **E2E Tests (Playwright)**: Test complete user workflows and integration between components

Choose the right testing tool:
- Use **Vitest** for pure functions, utilities, data transformations, and isolated logic
- Use **Playwright** for user workflows, page interactions, and full-stack integration tests

## Vitest Unit Test Patterns

### 1. Basic Unit Test

```typescript
// src/lib/my-utility.test.ts
import { describe, it, expect } from "vitest";
import { myFunction } from "./my-utility";

describe("myFunction", () => {
  it("should return expected result for valid input", () => {
    const result = myFunction("test");
    expect(result).toBe("expected");
  });

  it("should handle edge cases", () => {
    expect(myFunction("")).toBe("");
    expect(myFunction(null)).toBeNull();
  });

  it("should throw error for invalid input", () => {
    expect(() => myFunction(undefined)).toThrow("Invalid input");
  });
});
```

### 2. Testing Date/Time Utilities

```typescript
// src/lib/date-utils.test.ts
import { describe, it, expect } from "vitest";
import { formatDate, addDays } from "./date-utils";

describe("date-utils", () => {
  describe("formatDate", () => {
    it("should format date in NZ timezone", () => {
      const date = new Date("2024-12-31T10:00:00Z");
      const formatted = formatDate(date, "yyyy-MM-dd");
      expect(formatted).toBe("2024-12-31");
    });

    it("should handle different formats", () => {
      const date = new Date("2024-01-15T12:00:00Z");
      expect(formatDate(date, "dd/MM/yyyy")).toBe("15/01/2024");
      expect(formatDate(date, "MMM dd, yyyy")).toBe("Jan 15, 2024");
    });
  });

  describe("addDays", () => {
    it("should add days correctly", () => {
      const date = new Date("2024-01-01");
      const result = addDays(date, 5);
      expect(result.getDate()).toBe(6);
    });

    it("should handle month boundaries", () => {
      const date = new Date("2024-01-30");
      const result = addDays(date, 5);
      expect(result.getMonth()).toBe(1); // February
      expect(result.getDate()).toBe(4);
    });
  });
});
```

### 3. Testing Data Transformations

```typescript
// src/lib/transformers.test.ts
import { describe, it, expect } from "vitest";
import { transformShiftData, normalizeUserInput } from "./transformers";

describe("transformers", () => {
  describe("transformShiftData", () => {
    it("should transform raw shift data to display format", () => {
      const rawData = {
        id: "1",
        start: "2024-12-31T10:00:00Z",
        end: "2024-12-31T13:00:00Z",
        shift_type: "KITCHEN",
      };

      const result = transformShiftData(rawData);

      expect(result).toEqual({
        id: "1",
        startTime: expect.any(Date),
        endTime: expect.any(Date),
        shiftType: "Kitchen",
        duration: 3,
      });
    });

    it("should handle missing optional fields", () => {
      const rawData = {
        id: "1",
        start: "2024-12-31T10:00:00Z",
        end: "2024-12-31T13:00:00Z",
      };

      const result = transformShiftData(rawData);
      expect(result.shiftType).toBe("General");
    });
  });

  describe("normalizeUserInput", () => {
    it("should trim and lowercase email", () => {
      expect(normalizeUserInput("  TEST@EXAMPLE.COM  ")).toBe(
        "test@example.com"
      );
    });

    it("should remove extra whitespace", () => {
      expect(normalizeUserInput("  hello   world  ")).toBe("hello world");
    });
  });
});
```

### 4. Testing Validation Functions

```typescript
// src/lib/validators.test.ts
import { describe, it, expect } from "vitest";
import {
  validateEmail,
  validatePhone,
  validateShiftTime,
} from "./validators";

describe("validators", () => {
  describe("validateEmail", () => {
    it("should accept valid emails", () => {
      expect(validateEmail("user@example.com")).toBe(true);
      expect(validateEmail("test.user+tag@domain.co.nz")).toBe(true);
    });

    it("should reject invalid emails", () => {
      expect(validateEmail("invalid")).toBe(false);
      expect(validateEmail("@example.com")).toBe(false);
      expect(validateEmail("user@")).toBe(false);
    });
  });

  describe("validatePhone", () => {
    it("should accept valid NZ phone numbers", () => {
      expect(validatePhone("+64212345678")).toBe(true);
      expect(validatePhone("0212345678")).toBe(true);
    });

    it("should reject invalid formats", () => {
      expect(validatePhone("123")).toBe(false);
      expect(validatePhone("abc")).toBe(false);
    });
  });

  describe("validateShiftTime", () => {
    it("should ensure end time is after start time", () => {
      const start = new Date("2024-01-01T10:00:00");
      const end = new Date("2024-01-01T14:00:00");
      expect(validateShiftTime(start, end)).toBe(true);
    });

    it("should reject end time before start time", () => {
      const start = new Date("2024-01-01T14:00:00");
      const end = new Date("2024-01-01T10:00:00");
      expect(validateShiftTime(start, end)).toBe(false);
    });
  });
});
```

### 5. Testing with Mocks

```typescript
// src/lib/api-client.test.ts
import { describe, it, expect, vi } from "vitest";
import { fetchUserData } from "./api-client";

// Mock fetch globally
global.fetch = vi.fn();

describe("api-client", () => {
  it("should fetch user data successfully", async () => {
    const mockUser = { id: "1", name: "Test User" };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockUser,
    });

    const result = await fetchUserData("1");
    expect(result).toEqual(mockUser);
    expect(global.fetch).toHaveBeenCalledWith("/api/users/1");
  });

  it("should handle fetch errors", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    await expect(fetchUserData("999")).rejects.toThrow("User not found");
  });
});
```

## Vitest Configuration

The project uses the following Vitest configuration (`vitest.config.ts`):

```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,              // Auto-import describe, it, expect
    environment: 'node',        // Node environment for server-side code
    setupFiles: ['./src/lib/test-setup.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/tests/e2e/**',        // Exclude Playwright tests
      '**/.{idea,git,cache,output,temp}/**',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),  // Path alias support
    },
  },
})
```

### Test Setup File

The test setup file (`src/lib/test-setup.ts`) contains mocks for:
- Prisma client (prevents database connections)
- External modules (e.g., locations module with top-level await)

```typescript
import { vi } from 'vitest';

// Mock Prisma client
vi.mock('./prisma', () => ({
  prisma: {
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    // Add other models as needed
  },
}));
```

## Running Unit Tests

```bash
# Run tests in watch mode (development)
npm run test

# Run tests once (CI mode)
npm run test:run

# Run tests with UI
npm run test:ui

# Run specific test file
npx vitest src/lib/calendar-utils.test.ts

# Run tests with coverage
npx vitest --coverage
```

## Playwright Test Patterns

### 1. Authentication Tests

```typescript
// tests/e2e/auth.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("should login with valid credentials", async ({ page }) => {
    await page.goto("/login");

    // Fill login form
    await page.fill('[data-testid="email-input"]', "test@example.com");
    await page.fill('[data-testid="password-input"]', "password123");
    await page.click('[data-testid="login-button"]');

    // Verify redirect to dashboard
    await expect(page).toHaveURL("/dashboard");
    await expect(page.locator('[data-testid="dashboard-title"]')).toBeVisible();
  });

  test("should show error for invalid credentials", async ({ page }) => {
    await page.goto("/login");

    await page.fill('[data-testid="email-input"]', "invalid@example.com");
    await page.fill('[data-testid="password-input"]', "wrongpassword");
    await page.click('[data-testid="login-button"]');

    // Verify error message
    await expect(page.locator('[data-testid="error-message"]')).toContainText(
      "Invalid credentials"
    );
  });

  test("should redirect to profile completion for new users", async ({
    page,
  }) => {
    // Login with new user that hasn't completed profile
    await page.goto("/login");
    await page.fill('[data-testid="email-input"]', "newuser@example.com");
    await page.fill('[data-testid="password-input"]', "password123");
    await page.click('[data-testid="login-button"]');

    // Should redirect to profile completion
    await expect(page).toHaveURL("/profile/complete");
    await expect(
      page.locator('[data-testid="profile-completion-form"]')
    ).toBeVisible();
  });
});
```

### 2. Admin Dashboard Tests

```typescript
// tests/e2e/admin.spec.ts
import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../utils/auth-helpers";

test.describe("Admin Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("should display volunteer management section", async ({ page }) => {
    await page.goto("/admin");

    // Check for admin-specific elements
    await expect(page.locator('[data-testid="admin-nav"]')).toBeVisible();
    await expect(page.locator('[data-testid="volunteer-stats"]')).toBeVisible();
    await expect(page.locator('[data-testid="recent-signups"]')).toBeVisible();
  });

  test("should allow creating new shifts", async ({ page }) => {
    await page.goto("/admin/shifts");

    // Click create shift button
    await page.click('[data-testid="create-shift-button"]');

    // Fill shift form
    await page.fill('[data-testid="shift-title-input"]', "Kitchen Prep");
    await page.fill(
      '[data-testid="shift-description-input"]',
      "Food preparation"
    );
    await page.selectOption('[data-testid="shift-type-select"]', "KITCHEN");
    await page.fill('[data-testid="max-volunteers-input"]', "6");

    // Set date and time
    await page.fill('[data-testid="shift-date-input"]', "2024-12-25");
    await page.fill('[data-testid="start-time-input"]', "09:00");
    await page.fill('[data-testid="end-time-input"]', "13:00");

    await page.click('[data-testid="save-shift-button"]');

    // Verify shift was created
    await expect(page.locator('[data-testid="success-message"]')).toContainText(
      "Shift created successfully"
    );
    await expect(page.locator('[data-testid="shift-list"]')).toContainText(
      "Kitchen Prep"
    );
  });

  test("should allow approving volunteer registrations", async ({ page }) => {
    await page.goto("/admin/volunteers");

    // Find pending volunteer
    const pendingVolunteer = page
      .locator('[data-testid="volunteer-row"]')
      .filter({ hasText: "PENDING" })
      .first();
    await expect(pendingVolunteer).toBeVisible();

    // Approve volunteer
    await pendingVolunteer.locator('[data-testid="approve-button"]').click();

    // Confirm approval
    await page.click('[data-testid="confirm-approval-button"]');

    // Verify status change
    await expect(pendingVolunteer).toContainText("ACTIVE");
    await expect(page.locator('[data-testid="success-message"]')).toContainText(
      "Volunteer approved"
    );
  });
});
```

### 3. Volunteer Workflow Tests

```typescript
// tests/e2e/volunteers.spec.ts
import { test, expect } from "@playwright/test";
import { loginAsVolunteer, createTestShift } from "../utils/auth-helpers";

test.describe("Volunteer Workflows", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsVolunteer(page);
  });

  test("should allow browsing and signing up for shifts", async ({ page }) => {
    // Create a test shift first
    await createTestShift();

    await page.goto("/shifts");

    // Browse available shifts
    await expect(page.locator('[data-testid="shifts-list"]')).toBeVisible();

    // Find an available shift
    const shiftCard = page.locator('[data-testid="shift-card"]').first();
    await expect(shiftCard).toBeVisible();

    // Sign up for shift
    await shiftCard.locator('[data-testid="signup-button"]').click();

    // Confirm signup
    await page.click('[data-testid="confirm-signup-button"]');

    // Verify signup success
    await expect(page.locator('[data-testid="success-message"]')).toContainText(
      "Successfully signed up"
    );
    await expect(
      shiftCard.locator('[data-testid="signup-status"]')
    ).toContainText("Signed Up");
  });

  test("should allow canceling shift signups", async ({ page }) => {
    await page.goto("/dashboard");

    // Find upcoming shift
    const upcomingShift = page
      .locator('[data-testid="upcoming-shift"]')
      .first();
    await expect(upcomingShift).toBeVisible();

    // Cancel shift
    await upcomingShift.locator('[data-testid="cancel-shift-button"]').click();

    // Provide cancellation reason
    await page.fill(
      '[data-testid="cancellation-reason"]',
      "Personal emergency"
    );
    await page.click('[data-testid="confirm-cancellation-button"]');

    // Verify cancellation
    await expect(page.locator('[data-testid="success-message"]')).toContainText(
      "Shift cancelled"
    );
    await expect(upcomingShift).not.toBeVisible();
  });

  test("should display achievement progress", async ({ page }) => {
    await page.goto("/dashboard");

    // Check achievements section
    await expect(
      page.locator('[data-testid="achievements-section"]')
    ).toBeVisible();

    // Verify achievement cards
    const achievementCards = page.locator('[data-testid="achievement-card"]');
    await expect(achievementCards).toHaveCount(3); // Assuming 3 visible achievements

    // Check progress bars
    const progressBars = page.locator('[data-testid="achievement-progress"]');
    await expect(progressBars.first()).toBeVisible();
  });
});
```

### 4. Profile Management Tests

```typescript
// tests/e2e/profile.spec.ts
import { test, expect } from "@playwright/test";
import { loginAsVolunteer } from "../utils/auth-helpers";

test.describe("Profile Management", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsVolunteer(page);
  });

  test("should allow updating personal information", async ({ page }) => {
    await page.goto("/profile");

    // Update personal info
    await page.fill('[data-testid="name-input"]', "Updated Name");
    await page.fill('[data-testid="phone-input"]', "+1987654321");

    // Update emergency contact
    await page.fill(
      '[data-testid="emergency-name-input"]',
      "Emergency Contact"
    );
    await page.fill('[data-testid="emergency-phone-input"]', "+1234567890");
    await page.selectOption(
      '[data-testid="emergency-relationship-select"]',
      "Spouse"
    );

    // Save changes
    await page.click('[data-testid="save-profile-button"]');

    // Verify success
    await expect(page.locator('[data-testid="success-message"]')).toContainText(
      "Profile updated"
    );
  });

  test("should allow updating availability preferences", async ({ page }) => {
    await page.goto("/profile");

    // Navigate to availability tab
    await page.click('[data-testid="availability-tab"]');

    // Update availability
    await page.check('[data-testid="morning-availability"]');
    await page.check('[data-testid="weekend-availability"]');
    await page.uncheck('[data-testid="evening-availability"]');

    // Update skills
    await page.fill(
      '[data-testid="skills-input"]',
      "cooking, customer-service"
    );

    // Save changes
    await page.click('[data-testid="save-availability-button"]');

    // Verify success
    await expect(page.locator('[data-testid="success-message"]')).toContainText(
      "Availability updated"
    );
  });
});
```

## Test Utilities

### 1. Authentication Helpers

```typescript
// tests/utils/auth-helpers.ts
import { Page } from "@playwright/test";

export async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  await page.fill('[data-testid="email-input"]', "admin@everybodyeats.org");
  await page.fill('[data-testid="password-input"]', "admin123");
  await page.click('[data-testid="login-button"]');
  await page.waitForURL("/admin");
}

export async function loginAsVolunteer(page: Page) {
  await page.goto("/login");
  await page.fill('[data-testid="email-input"]', "volunteer@example.com");
  await page.fill('[data-testid="password-input"]', "volunteer123");
  await page.click('[data-testid="login-button"]');
  await page.waitForURL("/dashboard");
}

export async function logout(page: Page) {
  await page.click('[data-testid="user-menu"]');
  await page.click('[data-testid="logout-button"]');
  await page.waitForURL("/login");
}
```

### 2. Data Generation

```typescript
// tests/utils/data-generators.ts
import { faker } from "@faker-js/faker";

export function generateVolunteerData() {
  return {
    name: faker.person.fullName(),
    email: faker.internet.email(),
    phone: faker.phone.number("+1##########"),
    emergencyContact: {
      name: faker.person.fullName(),
      phone: faker.phone.number("+1##########"),
      relationship: faker.helpers.arrayElement([
        "Spouse",
        "Parent",
        "Sibling",
        "Friend",
      ]),
    },
    skills: faker.helpers.arrayElements(
      ["cooking", "customer-service", "cleaning", "organizing"],
      2
    ),
    availability: faker.helpers.arrayElements(
      ["MORNING", "AFTERNOON", "EVENING", "WEEKEND"],
      2
    ),
  };
}

export function generateShiftData() {
  return {
    title: faker.helpers.arrayElement([
      "Kitchen Prep",
      "Service",
      "Cleanup",
      "Setup",
    ]),
    description: faker.lorem.sentence(),
    date: faker.date.future().toISOString().split("T")[0],
    startTime: "09:00",
    endTime: "13:00",
    maxVolunteers: faker.number.int({ min: 3, max: 10 }),
    shiftType: faker.helpers.arrayElement([
      "KITCHEN",
      "SERVICE",
      "CLEANUP",
      "SETUP",
    ]),
  };
}
```

### 3. Database Helpers

```typescript
// tests/utils/db-helpers.ts
import { PrismaClient } from "@/generated/client";
import bcrypt from "bcryptjs";

const testDb = new PrismaClient({
  datasources: {
    db: { url: process.env.TEST_DATABASE_URL },
  },
});

export async function createTestUser(
  role: "ADMIN" | "VOLUNTEER" = "VOLUNTEER"
) {
  const userData = {
    email: `test-${Date.now()}@example.com`,
    name: "Test User",
    password: await bcrypt.hash("password123", 12),
    role,
    status: "ACTIVE",
    emergencyContact: {
      name: "Test Emergency Contact",
      phone: "+1234567890",
      relationship: "Friend",
    },
  };

  return await testDb.user.create({ data: userData });
}

export async function createTestShift() {
  return await testDb.shift.create({
    data: {
      title: "Test Shift",
      description: "Test shift for automated testing",
      date: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      startTime: new Date("2024-01-01T09:00:00Z"),
      endTime: new Date("2024-01-01T13:00:00Z"),
      maxVolunteers: 5,
      shiftTypeId: "test-shift-type-id",
    },
  });
}

export async function cleanupTestData() {
  await testDb.shiftAssignment.deleteMany();
  await testDb.shift.deleteMany();
  await testDb.user.deleteMany({ where: { email: { contains: "test-" } } });
}
```

## Test Configuration

### 1. Playwright Config

```typescript
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["html"],
    ["json", { outputFile: "test-results.json" }],
    ["junit", { outputFile: "test-results.xml" }],
  ],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
```

### 2. Global Setup

```typescript
// tests/setup/global-setup.ts
import { chromium, FullConfig } from "@playwright/test";
import { cleanupTestData, createTestUser } from "../utils/db-helpers";

async function globalSetup(config: FullConfig) {
  console.log("🧪 Setting up test environment...");

  // Clean existing test data
  await cleanupTestData();

  // Create test users
  await createTestUser("ADMIN");
  await createTestUser("VOLUNTEER");

  console.log("✅ Test environment ready");
}

export default globalSetup;
```

## Test ID Guidelines

Follow consistent patterns for test IDs:

```tsx
// ✅ GOOD - Descriptive, hierarchical naming
<div data-testid="volunteer-dashboard">
  <h1 data-testid="dashboard-title">Dashboard</h1>
  <section data-testid="upcoming-shifts-section">
    <h2 data-testid="upcoming-shifts-heading">Upcoming Shifts</h2>
    <div data-testid="shift-card">
      <button data-testid="signup-button">Sign Up</button>
      <button data-testid="cancel-button">Cancel</button>
    </div>
  </section>
</div>

// ❌ BAD - Generic, unclear naming
<div data-testid="container">
  <h1 data-testid="title">Dashboard</h1>
  <button data-testid="button1">Sign Up</button>
  <button data-testid="button2">Cancel</button>
</div>
```

## Running Tests

### Unit Tests (Vitest)

```bash
# Run unit tests in watch mode
npm run test

# Run unit tests once (CI mode)
npm run test:run

# Run unit tests with UI
npm run test:ui

# Run specific test file
npx vitest src/lib/calendar-utils.test.ts

# Run tests with coverage
npx vitest --coverage
```

### E2E Tests (Playwright)

```bash
# Run all e2e tests
npm run test:e2e

# Run tests in headed mode for debugging
npm run test:e2e:ui

# Run tests in CI mode (Chromium only) - RECOMMENDED
npm run test:e2e:ci

# Run specific test file in Chromium only
npx playwright test volunteer.spec.ts --project=chromium

# Run tests with debugging
npx playwright test --debug

# Generate test reports
npx playwright show-report
```

### Running All Tests

```bash
# Run unit tests first, then e2e tests
npm run test:run && npm run test:e2e:ci
```

## Best Practices

### Unit Testing Best Practices

1. **Test behavior, not implementation** - Focus on what the function does, not how it does it
2. **Write focused tests** - Each test should verify one specific behavior
3. **Use descriptive test names** - Test names should clearly state what is being tested
4. **Follow AAA pattern** - Arrange, Act, Assert
5. **Mock external dependencies** - Use mocks for Prisma, fetch, and other external services
6. **Test edge cases** - Include tests for null, undefined, empty strings, boundary values
7. **Keep tests simple** - Tests should be easier to understand than the code they test
8. **Co-locate tests** - Place test files next to the code they test (e.g., `utils.ts` and `utils.test.ts`)
9. **Run tests frequently** - Use watch mode during development (`npm run test`)
10. **Maintain test coverage** - Aim for high coverage of utility functions and business logic

### E2E Testing Best Practices

1. **Use data-testid attributes** for reliable element selection in Playwright tests
2. **Test user workflows**, not implementation details
3. **Create reusable helper functions** for common operations (login, navigation, etc.)
4. **Clean up test data** after each test
5. **Use descriptive test names** that explain the user scenario
6. **Group related tests** in describe blocks
7. **Test both happy path and error cases**
8. **Verify visual elements and user feedback**
9. **Test responsive design** on different devices
10. **Run tests in Chromium only** for faster feedback (use `--project=chromium`)

### General Testing Best Practices

1. **Choose the right testing tool** - Vitest for units, Playwright for workflows
2. **Run tests before committing** - Ensure unit tests pass before pushing code
3. **Run tests in CI/CD** to catch regressions early
4. **Review test failures carefully** - Understand why a test failed before fixing it
5. **Keep tests maintainable** - Refactor tests when you refactor code
6. **Document complex test scenarios** - Add comments for non-obvious test logic

## Common Patterns to Avoid

### Unit Testing Anti-Patterns

- Don't test framework/library code (e.g., React, Next.js internals)
- Don't test implementation details (private methods, internal state)
- Don't create tests that depend on other tests
- Don't use real database connections in unit tests (use mocks)
- Don't test multiple behaviors in a single test
- Don't skip edge case testing

### E2E Testing Anti-Patterns

- Don't rely on text content that might change
- Don't test third-party library functionality
- Don't create overly complex test scenarios
- Don't forget to clean up test data
- Don't skip accessibility testing
- Don't ignore flaky tests - fix them or remove them
- Don't run tests across all browsers in development (use Chromium only)
