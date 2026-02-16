import { test, expect } from "./base";
import { loginAsVolunteer } from "./helpers/auth";

test.describe("Friends System", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsVolunteer(page);
  });

  test("should navigate to friends page when logged in as volunteer", async ({
    page,
  }) => {
    // Click on Friends link in navigation
    await page.click('a[href="/friends"]');

    // Verify we're on the friends page
    await expect(page).toHaveURL("/friends");
    await expect(page.locator("h1")).toContainText("My Friends");
  });

  test("should open send friend request dialog", async ({ page }) => {
    // Navigate to friends page
    await page.goto("/friends");

    // Click "Add Friend" button
    await page.click('[data-testid="add-friend-button"]');

    // Verify dialog is open
    await expect(
      page.locator('[data-testid="send-friend-request-dialog"]')
    ).toBeVisible();
    await expect(page.locator("text=Send Friend Request")).toBeVisible();
    await expect(
      page.locator('[data-testid="friend-request-email-input"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="friend-request-message-input"]')
    ).toBeVisible();
  });

  test("should validate email input in friend request dialog", async ({
    page,
  }) => {
    // Navigate to friends page
    await page.goto("/friends");

    // Open friend request dialog
    await page.click('[data-testid="add-friend-button"]');

    // Verify dialog opened
    await expect(
      page.locator('[data-testid="send-friend-request-dialog"]')
    ).toBeVisible();

    // Try to submit with invalid email
    await page.fill(
      '[data-testid="friend-request-email-input"]',
      "invalid-email"
    );
    await page.click('[data-testid="friend-request-submit-button"]');

    // For HTML5 validation, we can check if form submission was prevented
    // by checking if dialog is still open (valid submission would close it)
    await expect(
      page.locator('[data-testid="send-friend-request-dialog"]')
    ).toBeVisible();
  });

  test("should send friend request with valid email", async ({ page }) => {
    // Navigate to friends page
    await page.goto("/friends");

    // Open friend request dialog
    await page.click('[data-testid="add-friend-button"]');

    // Fill in valid email and message
    await page.fill(
      '[data-testid="friend-request-email-input"]',
      "friend@example.com"
    );
    await page.fill(
      '[data-testid="friend-request-message-input"]',
      "Would love to volunteer together!"
    );

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

  test("should open privacy settings dialog", async ({ page }) => {
    // Navigate to friends page
    await page.goto("/friends");

    // Click "Privacy Settings" button
    await page.click('[data-testid="privacy-settings-button"]');

    // Verify dialog is open
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.locator("text=Friend Privacy Settings")).toBeVisible();
    await expect(
      page.locator("text=Who can see your volunteer activity?")
    ).toBeVisible();
    await expect(page.locator("text=Allow friend requests")).toBeVisible();
  });

  test("should change privacy settings", async ({ page }) => {
    // Navigate to friends page
    await page.goto("/friends");

    // Open privacy settings
    const privacyButton = page.getByTestId("privacy-settings-button");
    await privacyButton.click();

    // Wait for dialog to open with animation complete
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await page.waitForTimeout(500); // Wait for dialog animation

    // Change visibility to public (click the label since RadioGroupItem is a custom component)
    const publicLabel = page.locator('label[for="public"]');
    await expect(publicLabel).toBeVisible();
    await publicLabel.click();

    // Uncheck allow friend requests (click the label since Checkbox is a custom component)
    const allowRequestsLabel = page.locator('label[for="allowRequests"]');
    await expect(allowRequestsLabel).toBeVisible();
    await allowRequestsLabel.click();

    // Save settings
    const saveButton = page.locator('button:has-text("Save Settings")');
    await expect(saveButton).toBeVisible();
    await saveButton.click();

    // Wait for save to complete and dialog to close
    await page.waitForTimeout(1000);
    await expect(dialog).not.toBeVisible({
      timeout: 10000,
    });
  });

  test("should switch between friends and requests tabs", async ({ page }) => {
    // Navigate to friends page
    await page.goto("/friends");

    // Should start on Friends tab - check that it exists and is active
    const friendsTab = page.locator('[data-testid="friends-tab"]');
    await expect(friendsTab).toBeVisible();
    await expect(friendsTab).toHaveAttribute("data-state", "active");

    // Click on Requests tab
    await page.click('[data-testid="requests-tab"]');
    const requestsTab = page.locator('[data-testid="requests-tab"]');
    await expect(requestsTab).toHaveAttribute("data-state", "active");

    // Click back to Friends tab
    await page.click('[data-testid="friends-tab"]');
    await expect(friendsTab).toHaveAttribute("data-state", "active");
  });

  // NOTE: The following tests require pre-seeded data or dynamic test data creation
  // They are skipped until test data infrastructure is in place:
  // - "should search friends when friends exist" - requires existing friendships
  // - "should accept friend request" - requires pending friend requests
  // - "should decline friend request" - requires pending friend requests
  // - "should remove friend" - requires existing friendships
});
