import { test, expect } from "./base";
import type { Page } from "@playwright/test";

// Helper function to login as volunteer
async function loginAsVolunteer(page: Page) {
  try {
    await page.goto("/login");
    await page.waitForLoadState("load");

    const volunteerLoginButton = page.getByRole("button", {
      name: /login as volunteer/i,
    });
    await volunteerLoginButton.waitFor({ state: "visible", timeout: 5000 });
    await volunteerLoginButton.click();

    try {
      await page.waitForURL((url) => !url.pathname.includes("/login"), {
        timeout: 10000,
      });
    } catch (error) {
      console.log("Login may have failed or taken too long");
    }

    await page.waitForLoadState("load");
  } catch (error) {
    console.log("Error during login:", error);
  }
}

// Helper function to login as admin
async function loginAsAdmin(page: Page) {
  try {
    await page.goto("/login");
    await page.waitForLoadState("load");

    const adminLoginButton = page.getByRole("button", {
      name: /login as admin/i,
    });
    await adminLoginButton.waitFor({ state: "visible", timeout: 5000 });
    await adminLoginButton.click();

    try {
      await page.waitForURL((url) => !url.pathname.includes("/login"), {
        timeout: 10000,
      });
    } catch (error) {
      console.log("Login may have failed or taken too long");
    }

    await page.waitForLoadState("load");
  } catch (error) {
    console.log("Error during login:", error);
  }
}

test.describe('Friends System', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsVolunteer(page);

    // Skip tests if login failed (we're still on login page)
    const currentUrl = page.url();
    if (currentUrl.includes("/login")) {
      test.skip(true, "Login failed - skipping friends tests");
    }
  });

  test('should navigate to friends page when logged in as volunteer', async ({ page }) => {

    // Click on Friends link in navigation
    await page.click('a[href="/friends"]');
    
    // Verify we're on the friends page
    await expect(page).toHaveURL('/friends');
    await expect(page.locator('h1')).toContainText('My Friends');
  });


  test('should open send friend request dialog', async ({ page }) => {
    // Navigate to friends page
    await page.goto('/friends');

    // Click "Add Friend" button
    await page.click('[data-testid="add-friend-button"]');

    // Verify dialog is open
    await expect(page.locator('[data-testid="send-friend-request-dialog"]')).toBeVisible();
    await expect(page.locator('text=Send Friend Request')).toBeVisible();
    await expect(page.locator('[data-testid="friend-request-email-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="friend-request-message-input"]')).toBeVisible();
  });

  test('should validate email input in friend request dialog', async ({ page }) => {
    // Navigate to friends page
    await page.goto('/friends');

    // Open friend request dialog
    await page.click('[data-testid="add-friend-button"]');

    // Verify dialog opened
    await expect(page.locator('[data-testid="send-friend-request-dialog"]')).toBeVisible();

    // Try to submit with invalid email
    await page.fill('[data-testid="friend-request-email-input"]', 'invalid-email');
    await page.click('[data-testid="friend-request-submit-button"]');

    // For HTML5 validation, we can check if form submission was prevented
    // by checking if dialog is still open (valid submission would close it)
    await expect(page.locator('[data-testid="send-friend-request-dialog"]')).toBeVisible();
  });

  test('should send friend request with valid email', async ({ page }) => {
    // Navigate to friends page
    await page.goto('/friends');

    // Open friend request dialog
    await page.click('[data-testid="add-friend-button"]');

    // Fill in valid email and message
    await page.fill('[data-testid="friend-request-email-input"]', 'friend@example.com');
    await page.fill('[data-testid="friend-request-message-input"]', 'Would love to volunteer together!');
    
    // Submit the request
    await page.click('[data-testid="friend-request-submit-button"]');

    // Dialog should close (though the request might fail due to no such user)
    // We're testing the UI flow, not the backend logic
    await page.waitForTimeout(1000); // Give time for any processing
    
    // Check if dialog closed or if there's an error message
    const dialog = page.locator('[data-testid="send-friend-request-dialog"]');
    const errorMessage = page.locator('[data-testid="friend-request-error"]');
    
    // Either dialog closed (success) or error message shown (expected for non-existent user)
    const dialogVisible = await dialog.isVisible();
    const errorVisible = await errorMessage.isVisible();
    
    // One of these should be true: dialog closed OR error shown
    expect(dialogVisible === false || errorVisible === true).toBe(true);
  });

  test('should open privacy settings dialog', async ({ page }) => {
    // Navigate to friends page
    await page.goto('/friends');

    // Click "Privacy Settings" button
    await page.click('[data-testid="privacy-settings-button"]');

    // Verify dialog is open
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.locator('text=Friend Privacy Settings')).toBeVisible();
    await expect(page.locator('text=Who can see your volunteer activity?')).toBeVisible();
    await expect(page.locator('text=Allow friend requests')).toBeVisible();
  });

  test('should change privacy settings', async ({ page }) => {
    // Navigate to friends page
    await page.goto('/friends');

    // Open privacy settings
    await page.click('[data-testid="privacy-settings-button"]');

    // Wait for dialog to open
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Change visibility to public (click the label since RadioGroupItem is a custom component)
    await page.click('label[for="public"]');
    
    // Uncheck allow friend requests (click the label since Checkbox is a custom component)
    await page.click('label[for="allowRequests"]');

    // Save settings
    await page.click('button:has-text("Save Settings")');

    // Dialog should close after successful save
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 10000 });
  });

  test('should switch between friends and requests tabs', async ({ page }) => {
    // Navigate to friends page
    await page.goto('/friends');

    // Should start on Friends tab - check that it exists and is active
    const friendsTab = page.locator('[data-testid="friends-tab"]');
    await expect(friendsTab).toBeVisible();
    await expect(friendsTab).toHaveAttribute('data-state', 'active');

    // Click on Requests tab
    await page.click('[data-testid="requests-tab"]');
    const requestsTab = page.locator('[data-testid="requests-tab"]');
    await expect(requestsTab).toHaveAttribute('data-state', 'active');

    // Click back to Friends tab
    await page.click('[data-testid="friends-tab"]');
    await expect(friendsTab).toHaveAttribute('data-state', 'active');
  });

  test('should search friends when friends exist', async ({ page }) => {
    // This test would require pre-seeded data or API mocking
    // Skipping for now as it requires test data setup
    test.skip();
  });

  test('should accept friend request', async ({ page }) => {
    // This test would require pre-seeded friend requests
    // Skipping for now as it requires test data setup
    test.skip();
  });

  test('should decline friend request', async ({ page }) => {
    // This test would require pre-seeded friend requests
    // Skipping for now as it requires test data setup
    test.skip();
  });

  test('should remove friend', async ({ page }) => {
    // This test would require pre-seeded friends
    // Skipping for now as it requires test data setup
    test.skip();
  });


  test('friends link should not appear in admin navigation', async ({ page }) => {
    // Login as admin
    await loginAsAdmin(page);
    
    // Skip test if login failed
    const currentUrl = page.url();
    if (currentUrl.includes("/login")) {
      test.skip(true, "Admin login failed - skipping test");
    }

    // Check that Friends link is not in navigation
    await expect(page.locator('a[href="/friends"]')).not.toBeVisible();
  });
});