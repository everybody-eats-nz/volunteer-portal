# CLAUDE.md - Testing Guidelines

This file provides guidance to Claude Code for working with tests in this directory, using Playwright for e2e testing.

## Overview

This directory contains all test files for the Volunteer Portal, primarily using Playwright for end-to-end testing with some utility files for test setup and data generation.

## Directory Structure

```
tests/
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

Based on the existing .cursor/rules, this project uses **Playwright for e2e testing** rather than Vitest unit tests. The focus is on testing user workflows and ensuring the application works end-to-end.

## Playwright Test Patterns

### 1. Authentication Tests

```typescript
// tests/e2e/auth.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('should login with valid credentials', async ({ page }) => {
    await page.goto('/login')
    
    // Fill login form
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.click('[data-testid="login-button"]')
    
    // Verify redirect to dashboard
    await expect(page).toHaveURL('/dashboard')
    await expect(page.locator('[data-testid="dashboard-title"]')).toBeVisible()
  })

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login')
    
    await page.fill('[data-testid="email-input"]', 'invalid@example.com')
    await page.fill('[data-testid="password-input"]', 'wrongpassword')
    await page.click('[data-testid="login-button"]')
    
    // Verify error message
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid credentials')
  })

  test('should redirect to profile completion for new users', async ({ page }) => {
    // Login with new user that hasn't completed profile
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'newuser@example.com')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.click('[data-testid="login-button"]')
    
    // Should redirect to profile completion
    await expect(page).toHaveURL('/profile/complete')
    await expect(page.locator('[data-testid="profile-completion-form"]')).toBeVisible()
  })
})
```

### 2. Admin Dashboard Tests

```typescript
// tests/e2e/admin.spec.ts
import { test, expect } from '@playwright/test'
import { loginAsAdmin } from '../utils/auth-helpers'

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('should display volunteer management section', async ({ page }) => {
    await page.goto('/admin')
    
    // Check for admin-specific elements
    await expect(page.locator('[data-testid="admin-nav"]')).toBeVisible()
    await expect(page.locator('[data-testid="volunteer-stats"]')).toBeVisible()
    await expect(page.locator('[data-testid="recent-signups"]')).toBeVisible()
  })

  test('should allow creating new shifts', async ({ page }) => {
    await page.goto('/admin/shifts')
    
    // Click create shift button
    await page.click('[data-testid="create-shift-button"]')
    
    // Fill shift form
    await page.fill('[data-testid="shift-title-input"]', 'Kitchen Prep')
    await page.fill('[data-testid="shift-description-input"]', 'Food preparation')
    await page.selectOption('[data-testid="shift-type-select"]', 'KITCHEN')
    await page.fill('[data-testid="max-volunteers-input"]', '6')
    
    // Set date and time
    await page.fill('[data-testid="shift-date-input"]', '2024-12-25')
    await page.fill('[data-testid="start-time-input"]', '09:00')
    await page.fill('[data-testid="end-time-input"]', '13:00')
    
    await page.click('[data-testid="save-shift-button"]')
    
    // Verify shift was created
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Shift created successfully')
    await expect(page.locator('[data-testid="shift-list"]')).toContainText('Kitchen Prep')
  })

  test('should allow approving volunteer registrations', async ({ page }) => {
    await page.goto('/admin/volunteers')
    
    // Find pending volunteer
    const pendingVolunteer = page.locator('[data-testid="volunteer-row"]').filter({ hasText: 'PENDING' }).first()
    await expect(pendingVolunteer).toBeVisible()
    
    // Approve volunteer
    await pendingVolunteer.locator('[data-testid="approve-button"]').click()
    
    // Confirm approval
    await page.click('[data-testid="confirm-approval-button"]')
    
    // Verify status change
    await expect(pendingVolunteer).toContainText('ACTIVE')
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Volunteer approved')
  })
})
```

### 3. Volunteer Workflow Tests

```typescript
// tests/e2e/volunteers.spec.ts
import { test, expect } from '@playwright/test'
import { loginAsVolunteer, createTestShift } from '../utils/auth-helpers'

test.describe('Volunteer Workflows', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsVolunteer(page)
  })

  test('should allow browsing and signing up for shifts', async ({ page }) => {
    // Create a test shift first
    await createTestShift()
    
    await page.goto('/shifts')
    
    // Browse available shifts
    await expect(page.locator('[data-testid="shifts-list"]')).toBeVisible()
    
    // Find an available shift
    const shiftCard = page.locator('[data-testid="shift-card"]').first()
    await expect(shiftCard).toBeVisible()
    
    // Sign up for shift
    await shiftCard.locator('[data-testid="signup-button"]').click()
    
    // Confirm signup
    await page.click('[data-testid="confirm-signup-button"]')
    
    // Verify signup success
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Successfully signed up')
    await expect(shiftCard.locator('[data-testid="signup-status"]')).toContainText('Signed Up')
  })

  test('should allow canceling shift signups', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Find upcoming shift
    const upcomingShift = page.locator('[data-testid="upcoming-shift"]').first()
    await expect(upcomingShift).toBeVisible()
    
    // Cancel shift
    await upcomingShift.locator('[data-testid="cancel-shift-button"]').click()
    
    // Provide cancellation reason
    await page.fill('[data-testid="cancellation-reason"]', 'Personal emergency')
    await page.click('[data-testid="confirm-cancellation-button"]')
    
    // Verify cancellation
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Shift cancelled')
    await expect(upcomingShift).not.toBeVisible()
  })

  test('should display achievement progress', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Check achievements section
    await expect(page.locator('[data-testid="achievements-section"]')).toBeVisible()
    
    // Verify achievement cards
    const achievementCards = page.locator('[data-testid="achievement-card"]')
    await expect(achievementCards).toHaveCount(3) // Assuming 3 visible achievements
    
    // Check progress bars
    const progressBars = page.locator('[data-testid="achievement-progress"]')
    await expect(progressBars.first()).toBeVisible()
  })
})
```

### 4. Profile Management Tests

```typescript
// tests/e2e/profile.spec.ts
import { test, expect } from '@playwright/test'
import { loginAsVolunteer } from '../utils/auth-helpers'

test.describe('Profile Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsVolunteer(page)
  })

  test('should allow updating personal information', async ({ page }) => {
    await page.goto('/profile')
    
    // Update personal info
    await page.fill('[data-testid="name-input"]', 'Updated Name')
    await page.fill('[data-testid="phone-input"]', '+1987654321')
    
    // Update emergency contact
    await page.fill('[data-testid="emergency-name-input"]', 'Emergency Contact')
    await page.fill('[data-testid="emergency-phone-input"]', '+1234567890')
    await page.selectOption('[data-testid="emergency-relationship-select"]', 'Spouse')
    
    // Save changes
    await page.click('[data-testid="save-profile-button"]')
    
    // Verify success
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Profile updated')
  })

  test('should allow updating availability preferences', async ({ page }) => {
    await page.goto('/profile')
    
    // Navigate to availability tab
    await page.click('[data-testid="availability-tab"]')
    
    // Update availability
    await page.check('[data-testid="morning-availability"]')
    await page.check('[data-testid="weekend-availability"]')
    await page.uncheck('[data-testid="evening-availability"]')
    
    // Update skills
    await page.fill('[data-testid="skills-input"]', 'cooking, customer-service')
    
    // Save changes
    await page.click('[data-testid="save-availability-button"]')
    
    // Verify success
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Availability updated')
  })
})
```

## Test Utilities

### 1. Authentication Helpers

```typescript
// tests/utils/auth-helpers.ts
import { Page } from '@playwright/test'

export async function loginAsAdmin(page: Page) {
  await page.goto('/login')
  await page.fill('[data-testid="email-input"]', 'admin@everybodyeats.org')
  await page.fill('[data-testid="password-input"]', 'admin123')
  await page.click('[data-testid="login-button"]')
  await page.waitForURL('/admin')
}

export async function loginAsVolunteer(page: Page) {
  await page.goto('/login')
  await page.fill('[data-testid="email-input"]', 'volunteer@example.com')
  await page.fill('[data-testid="password-input"]', 'volunteer123')
  await page.click('[data-testid="login-button"]')
  await page.waitForURL('/dashboard')
}

export async function logout(page: Page) {
  await page.click('[data-testid="user-menu"]')
  await page.click('[data-testid="logout-button"]')
  await page.waitForURL('/login')
}
```

### 2. Data Generation

```typescript
// tests/utils/data-generators.ts
import { faker } from '@faker-js/faker'

export function generateVolunteerData() {
  return {
    name: faker.person.fullName(),
    email: faker.internet.email(),
    phone: faker.phone.number('+1##########'),
    emergencyContact: {
      name: faker.person.fullName(),
      phone: faker.phone.number('+1##########'),
      relationship: faker.helpers.arrayElement(['Spouse', 'Parent', 'Sibling', 'Friend'])
    },
    skills: faker.helpers.arrayElements(['cooking', 'customer-service', 'cleaning', 'organizing'], 2),
    availability: faker.helpers.arrayElements(['MORNING', 'AFTERNOON', 'EVENING', 'WEEKEND'], 2)
  }
}

export function generateShiftData() {
  return {
    title: faker.helpers.arrayElement(['Kitchen Prep', 'Service', 'Cleanup', 'Setup']),
    description: faker.lorem.sentence(),
    date: faker.date.future().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '13:00',
    maxVolunteers: faker.number.int({ min: 3, max: 10 }),
    shiftType: faker.helpers.arrayElement(['KITCHEN', 'SERVICE', 'CLEANUP', 'SETUP'])
  }
}
```

### 3. Database Helpers

```typescript
// tests/utils/db-helpers.ts
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const testDb = new PrismaClient({
  datasources: {
    db: { url: process.env.TEST_DATABASE_URL }
  }
})

export async function createTestUser(role: 'ADMIN' | 'VOLUNTEER' = 'VOLUNTEER') {
  const userData = {
    email: `test-${Date.now()}@example.com`,
    name: 'Test User',
    password: await bcrypt.hash('password123', 12),
    role,
    status: 'ACTIVE',
    emergencyContact: {
      name: 'Test Emergency Contact',
      phone: '+1234567890',
      relationship: 'Friend'
    }
  }
  
  return await testDb.user.create({ data: userData })
}

export async function createTestShift() {
  return await testDb.shift.create({
    data: {
      title: 'Test Shift',
      description: 'Test shift for automated testing',
      date: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      startTime: new Date('2024-01-01T09:00:00Z'),
      endTime: new Date('2024-01-01T13:00:00Z'),
      maxVolunteers: 5,
      shiftTypeId: 'test-shift-type-id'
    }
  })
}

export async function cleanupTestData() {
  await testDb.shiftAssignment.deleteMany()
  await testDb.shift.deleteMany()
  await testDb.user.deleteMany({ where: { email: { contains: 'test-' } } })
}
```

## Test Configuration

### 1. Playwright Config

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results.json' }],
    ['junit', { outputFile: 'test-results.xml' }]
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
```

### 2. Global Setup

```typescript
// tests/setup/global-setup.ts
import { chromium, FullConfig } from '@playwright/test'
import { cleanupTestData, createTestUser } from '../utils/db-helpers'

async function globalSetup(config: FullConfig) {
  console.log('🧪 Setting up test environment...')
  
  // Clean existing test data
  await cleanupTestData()
  
  // Create test users
  await createTestUser('ADMIN')
  await createTestUser('VOLUNTEER')
  
  console.log('✅ Test environment ready')
}

export default globalSetup
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

```bash
# Run all tests
npm run test:e2e

# Run tests in headed mode for debugging
npm run test:e2e:ui

# Run tests in CI mode (Chromium only)
npm run test:e2e:ci

# Run specific test file
npx playwright test volunteer.spec.ts

# Run tests with debugging
npx playwright test --debug

# Generate test reports
npx playwright show-report
```

## Best Practices

1. **Use data-testid attributes** for reliable element selection
2. **Test user workflows**, not implementation details
3. **Create reusable helper functions** for common operations
4. **Clean up test data** after each test
5. **Use descriptive test names** that explain the scenario
6. **Group related tests** in describe blocks
7. **Test both happy path and error cases**
8. **Verify visual elements and user feedback**
9. **Test responsive design** on different devices
10. **Run tests in CI/CD** to catch regressions early

## Common Patterns to Avoid

- Don't test internal component state
- Don't rely on text content that might change
- Don't test third-party library functionality
- Don't create overly complex test scenarios
- Don't forget to clean up test data
- Don't skip accessibility testing
- Don't ignore flaky tests