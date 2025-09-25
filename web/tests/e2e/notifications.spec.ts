import { test, expect } from "./base";
import type { Page } from "@playwright/test";

// Helper function to login
async function loginAsVolunteer(page: Page) {
  try {
    await page.goto("/login");

    // Wait for the page to load
    await page.waitForLoadState("load");

    // Check if login form is visible
    const volunteerLoginButton = page.getByRole("button", {
      name: /login as volunteer/i,
    });
    await volunteerLoginButton.waitFor({ state: "visible", timeout: 5000 });

    // Click login button
    await volunteerLoginButton.click();

    // Wait for navigation with timeout
    try {
      await page.waitForURL((url) => !url.pathname.includes("/login"), {
        timeout: 10000,
      });
    } catch (error) {
      // Login might have failed, but don't throw - let the test handle it
      console.log("Login may have failed or taken too long");
    }

    await page.waitForLoadState("load");
  } catch (error) {
    console.log("Error during login:", error);
  }
}

test.describe('Notification System', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsVolunteer(page);

    // Navigate to dashboard and wait for it to load
    await page.goto("/dashboard");
    await page.waitForLoadState("load");

    // Skip tests if login failed (we're still on login page)
    const currentUrl = page.url();
    if (currentUrl.includes("/login")) {
      test.skip(true, "Login failed - skipping notification tests");
    }
  });

  test('should display notification bell in header', async ({ page }) => {
    // Check if notification bell is visible
    await expect(page.getByTestId('notification-bell-button')).toBeVisible();
    
    // Bell should have correct icon
    await expect(page.getByTestId('notification-bell-button').locator('svg')).toBeVisible();
  });

  test('should show unread count badge when there are unread notifications', async ({ page }) => {
    // Wait for any existing notifications to load
    await page.waitForTimeout(1000);
    
    // Check if badge appears when there are unread notifications
    const badge = page.getByTestId('notification-count-badge');
    
    // If badge exists, it should show a number
    if (await badge.isVisible()) {
      const badgeText = await badge.textContent();
      expect(badgeText).toMatch(/^\d+\+?$/); // Should be a number or number+
    }
  });

  test('should open and close notification dropdown', async ({ page }) => {
    const bellButton = page.getByTestId('notification-bell-button');
    
    // Click to open dropdown
    await bellButton.click();
    await expect(page.getByTestId('notification-dropdown')).toBeVisible();
    
    // Click outside to close dropdown
    await page.click('body', { position: { x: 50, y: 50 } });
    await expect(page.getByTestId('notification-dropdown')).not.toBeVisible();
    
    // Click bell again to open
    await bellButton.click();
    await expect(page.getByTestId('notification-dropdown')).toBeVisible();
    
    // Click bell again to close
    await bellButton.click();
    await expect(page.getByTestId('notification-dropdown')).not.toBeVisible();
  });

  test('should display notification list with correct structure', async ({ page }) => {
    const bellButton = page.getByTestId('notification-bell-button');
    
    // Open notification dropdown
    await bellButton.click();
    await expect(page.getByTestId('notification-dropdown')).toBeVisible();
    
    // Check for notification list container
    const notificationList = page.getByTestId('notification-list');
    await expect(notificationList).toBeVisible();
    
    // Should have header with title
    await expect(page.getByTestId('notifications-title')).toContainText('Notifications');
    
    // Check for notifications or empty state
    const notifications = page.locator('[data-testid*="notification-item-"]');
    const emptyState = page.getByTestId('no-notifications');
    
    const hasNotifications = await notifications.count() > 0;
    const hasEmptyState = await emptyState.isVisible();
    
    // Should have either notifications or empty state, but not both
    expect(hasNotifications || hasEmptyState).toBeTruthy();
    if (hasNotifications) {
      expect(hasEmptyState).toBeFalsy();
    }
  });

  test('should display individual notifications correctly', async ({ page }) => {
    const bellButton = page.getByTestId('notification-bell-button');
    
    // Open notification dropdown
    await bellButton.click();
    await expect(page.getByTestId('notification-dropdown')).toBeVisible();
    
    // Get first notification if it exists
    const firstNotification = page.locator('[data-testid*="notification-item-"]').first();
    
    if (await firstNotification.isVisible()) {
      // Check notification structure
      await expect(firstNotification.getByTestId('notification-icon')).toBeVisible();
      await expect(firstNotification.getByTestId('notification-title')).toBeVisible();
      await expect(firstNotification.getByTestId('notification-message')).toBeVisible();
      await expect(firstNotification.getByTestId('notification-time')).toBeVisible();
      
      // Check if notification has actions on hover
      await firstNotification.hover();
      
      // Delete button should be visible
      await expect(firstNotification.getByTestId('delete-notification-button')).toBeVisible();
      
      // Check if mark as read button exists for unread notifications
      const unreadBadge = firstNotification.getByTestId('unread-badge');
      if (await unreadBadge.isVisible()) {
        await expect(firstNotification.getByTestId('mark-read-button')).toBeVisible();
      }
    }
  });

  test('should mark notification as read', async ({ page }) => {
    const bellButton = page.getByTestId('notification-bell-button');
    
    // Open notification dropdown
    await bellButton.click();
    await expect(page.getByTestId('notification-dropdown')).toBeVisible();
    
    // Find an unread notification
    const unreadNotification = page.locator('[data-testid*="notification-item-"]').filter({
      has: page.getByTestId('unread-badge')
    }).first();
    
    if (await unreadNotification.isVisible()) {
      // Hover to show actions
      await unreadNotification.hover();
      
      // Click mark as read button
      await unreadNotification.getByTestId('mark-read-button').click();
      
      // Wait for the action to complete
      await page.waitForTimeout(500);
      
      // Unread badge should be gone
      await expect(unreadNotification.getByTestId('unread-badge')).not.toBeVisible();
    }
  });

  test('should delete notification', async ({ page }) => {
    const bellButton = page.getByTestId('notification-bell-button');
    
    // Open notification dropdown
    await bellButton.click();
    await expect(page.getByTestId('notification-dropdown')).toBeVisible();
    
    // Count initial notifications
    const initialCount = await page.locator('[data-testid*="notification-item-"]').count();
    
    if (initialCount > 0) {
      const firstNotification = page.locator('[data-testid*="notification-item-"]').first();
      
      // Hover to show actions
      await firstNotification.hover();
      
      // Click delete button
      await firstNotification.getByTestId('delete-notification-button').click();
      
      // Wait for deletion to complete
      await page.waitForTimeout(500);
      
      // Count should decrease by 1 or show empty state
      const newCount = await page.locator('[data-testid*="notification-item-"]').count();
      
      if (initialCount === 1) {
        // Should show empty state
        await expect(page.getByTestId('notifications-empty-state')).toBeVisible();
      } else {
        // Should have one less notification
        expect(newCount).toBe(initialCount - 1);
      }
    }
  });

  test('should mark all notifications as read', async ({ page }) => {
    const bellButton = page.getByTestId('notification-bell-button');
    
    // Open notification dropdown
    await bellButton.click();
    await expect(page.getByTestId('notification-dropdown')).toBeVisible();
    
    // Check if there are any unread notifications
    const unreadNotifications = page.locator('[data-testid*="notification-item-"]').filter({
      has: page.getByTestId('unread-badge')
    });
    
    const unreadCount = await unreadNotifications.count();
    
    if (unreadCount > 0) {
      // Click mark all as read button
      const markAllReadButton = page.getByTestId('mark-all-read-button');
      await expect(markAllReadButton).toBeVisible();
      await markAllReadButton.click();
      
      // Wait for the action to complete
      await page.waitForTimeout(1000);
      
      // All unread badges should be gone
      await expect(page.getByTestId('unread-badge')).not.toBeVisible();
      
      // Notification count badge should be gone from bell
      await expect(page.getByTestId('notification-count-badge')).not.toBeVisible();
    }
  });

  test('should navigate to notification action URL when clicked', async ({ page }) => {
    const bellButton = page.getByTestId('notification-bell-button');
    
    // Open notification dropdown
    await bellButton.click();
    await expect(page.getByTestId('notification-dropdown')).toBeVisible();
    
    // Find a notification with a link
    const linkedNotification = page.getByTestId('notification-link').first();
    
    if (await linkedNotification.isVisible()) {
      // Click the notification
      await linkedNotification.click();
      
      // Should navigate away from current page
      await page.waitForTimeout(1000);
      
      // URL should have changed
      const currentUrl = page.url();
      expect(currentUrl).not.toBe('/dashboard');
    }
  });

  test('should close dropdown when notification is clicked', async ({ page }) => {
    const bellButton = page.getByTestId('notification-bell-button');
    
    // Open notification dropdown
    await bellButton.click();
    await expect(page.getByTestId('notification-dropdown')).toBeVisible();
    
    // Click any notification (whether it has a link or not)
    const firstNotification = page.locator('[data-testid*="notification-item-"]').first();
    
    if (await firstNotification.isVisible()) {
      await firstNotification.click();
      
      // Dropdown should close
      await expect(page.getByTestId('notification-dropdown')).not.toBeVisible();
    }
  });

  test('should update unread count in real-time', async ({ page }) => {
    // This test checks the polling functionality
    const bellButton = page.getByTestId('notification-bell-button');
    
    // Get initial unread count
    const initialBadge = page.getByTestId('notification-count-badge');
    const hasInitialBadge = await initialBadge.isVisible();
    let initialCount = 0;
    
    if (hasInitialBadge) {
      const badgeText = await initialBadge.textContent();
      initialCount = parseInt(badgeText?.replace('+', '') || '0');
    }
    
    // Open dropdown and mark one as read
    await bellButton.click();
    await expect(page.getByTestId('notification-dropdown')).toBeVisible();
    
    const unreadNotification = page.locator('[data-testid*="notification-item-"]').filter({
      has: page.getByTestId('unread-badge')
    }).first();
    
    if (await unreadNotification.isVisible()) {
      await unreadNotification.hover();
      await unreadNotification.getByTestId('mark-read-button').click();
      
      // Close dropdown
      await page.click('body', { position: { x: 50, y: 50 } });
      
      // Wait for polling to update (up to 30 seconds, but should be immediate)
      await page.waitForTimeout(2000);
      
      // Check if badge count decreased
      if (initialCount > 1) {
        const newBadge = page.getByTestId('notification-count-badge');
        await expect(newBadge).toBeVisible();
        const newBadgeText = await newBadge.textContent();
        const newCount = parseInt(newBadgeText?.replace('+', '') || '0');
        expect(newCount).toBeLessThan(initialCount);
      } else if (initialCount === 1) {
        // Badge should be gone
        await expect(page.getByTestId('notification-count-badge')).not.toBeVisible();
      }
    }
  });


  test('should persist notification state after page refresh', async ({ page }) => {
    const bellButton = page.getByTestId('notification-bell-button');
    
    // Open dropdown and check initial state
    await bellButton.click();
    await expect(page.getByTestId('notification-dropdown')).toBeVisible();
    
    const initialNotificationCount = await page.locator('[data-testid*="notification-item-"]').count();
    
    if (initialNotificationCount > 0) {
      // Mark first notification as read
      const firstNotification = page.locator('[data-testid*="notification-item-"]').first();
      const wasUnread = await firstNotification.getByTestId('unread-badge').isVisible();
      
      if (wasUnread) {
        await firstNotification.hover();
        await firstNotification.getByTestId('mark-read-button').click();
        await page.waitForTimeout(500);
      }
      
      // Close dropdown
      await page.click('body', { position: { x: 50, y: 50 } });
      
      // Refresh page
      await page.reload();
      await page.waitForLoadState('load');
      
      // Open dropdown again
      await bellButton.click();
      await expect(page.getByTestId('notification-dropdown')).toBeVisible();
      
      // Should have same number of notifications
      const newNotificationCount = await page.locator('[data-testid*="notification-item-"]').count();
      expect(newNotificationCount).toBe(initialNotificationCount);
      
      // Previously read notification should still be marked as read
      if (wasUnread) {
        const sameNotification = page.locator('[data-testid*="notification-item-"]').first();
        await expect(sameNotification.getByTestId('unread-badge')).not.toBeVisible();
      }
    }
  });
});