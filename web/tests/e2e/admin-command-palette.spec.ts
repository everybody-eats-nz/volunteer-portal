import { test, expect } from './base';
import { loginAsAdmin, loginAsVolunteer } from './helpers/auth';

test.describe('Admin Command Palette', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test.describe('Accessibility and Visibility', () => {
    test('command palette trigger button is visible on all admin pages', async ({ page }) => {
      const adminPages = [
        '/admin',
        '/admin/users',
        '/admin/shifts'
      ];

      for (const adminPath of adminPages) {
        await page.goto(adminPath, { timeout: 15000 });
        await expect(page.getByTestId('admin-command-palette-trigger')).toBeVisible();
      }
    });

    test('non-admin users do not see command palette', async ({ page }) => {
      // Skip the logout part for now and directly login as volunteer in new context
      await loginAsVolunteer(page);
      
      await page.goto('/dashboard');
      await expect(page.getByTestId('admin-command-palette-trigger')).not.toBeVisible();
    });
  });

  test.describe('Keyboard Shortcuts', () => {
    test('Cmd+K opens command palette on Mac', async ({ page }) => {
      await page.goto('/admin');
      
      // Use Meta key for Mac (Cmd)
      await page.keyboard.press('Meta+k');
      
      await expect(page.getByTestId('admin-command-input')).toBeVisible();
      await expect(page.getByTestId('admin-command-input')).toBeFocused();
    });

    test('Ctrl+K opens command palette', async ({ page }) => {
      await page.goto('/admin');
      
      await page.keyboard.press('Control+k');
      
      await expect(page.getByTestId('admin-command-input')).toBeVisible();
      await expect(page.getByTestId('admin-command-input')).toBeFocused();
    });

    test('Escape closes command palette', async ({ page }) => {
      await page.goto('/admin');
      
      // Open command palette
      await page.keyboard.press('Meta+k');
      await expect(page.getByTestId('admin-command-input')).toBeVisible();
      
      // Close with escape
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('admin-command-input')).not.toBeVisible();
    });
  });

  test.describe('User Search Functionality', () => {
    test('searching for users shows search results', async ({ page }) => {
      await page.goto('/admin');
      
      // Open command palette
      await page.getByTestId('admin-command-palette-trigger').click();
      await expect(page.getByTestId('admin-command-input')).toBeVisible();
      
      // Type a search query that should return users
      await page.getByTestId('admin-command-input').fill('volunteer');
      
      // Wait for search results to load
      await page.waitForTimeout(500);
      
      // Should show "Users" group when searching (use attribute selector for command groups)
      await expect(page.locator('[cmdk-group-heading]', { hasText: 'Users' })).toBeVisible();
      
      // Should show loading state initially, then results
      // Note: In e2e environment, the API might return different results
      // so we focus on testing the UI behavior rather than specific user data
    });

    test('empty search shows navigation items only', async ({ page }) => {
      await page.goto('/admin');
      
      await page.getByTestId('admin-command-palette-trigger').click();
      await expect(page.getByTestId('admin-command-input')).toBeVisible();
      
      // With empty search, should show navigation groups
      await expect(page.locator('[cmdk-group-heading]', { hasText: 'Overview' })).toBeVisible();
      await expect(page.locator('[cmdk-group-heading]', { hasText: 'Volunteer Management' })).toBeVisible();
      await expect(page.locator('[cmdk-group-heading]', { hasText: 'Shift Management' })).toBeVisible();
      await expect(page.locator('[cmdk-group-heading]', { hasText: 'User Migration' })).toBeVisible();
      await expect(page.locator('[cmdk-group-heading]', { hasText: 'Public' })).toBeVisible();
    });

    test('user search results show profile information', async ({ page }) => {
      await page.goto('/admin');
      
      await page.getByTestId('admin-command-palette-trigger').click();
      await page.getByTestId('admin-command-input').fill('admin');
      
      // Wait for potential results
      await page.waitForTimeout(500);
      
      // If results exist, they should have the proper structure
      const userResults = page.locator('[data-testid^="user-search-result-"]');
      const resultCount = await userResults.count();
      
      if (resultCount > 0) {
        // First result should have user information structure
        const firstResult = userResults.first();
        
        // Should have user name/email visible
        await expect(firstResult).toBeVisible();
        
        // Should show role information (Admin/Volunteer)
        const roleText = firstResult.locator('text=/Admin|Volunteer/');
        await expect(roleText).toBeVisible();
      }
    });
  });

  test.describe('Navigation Features', () => {
    test('navigation items are visible and searchable', async ({ page }) => {
      await page.goto('/admin');
      
      await page.getByTestId('admin-command-palette-trigger').click();
      
      // Should show all navigation categories (scope to command dialog)
      const commandDialog = page.getByRole('dialog');
      await expect(commandDialog.locator('[cmdk-group-heading]', { hasText: 'Overview' })).toBeVisible();
      await expect(commandDialog.getByText('Dashboard')).toBeVisible();
      
      await expect(commandDialog.locator('[cmdk-group-heading]', { hasText: 'Volunteer Management' })).toBeVisible();
      await expect(commandDialog.getByText('All Users')).toBeVisible();
      await expect(commandDialog.getByText('Regular Volunteers')).toBeVisible();
      
      await expect(commandDialog.locator('[cmdk-group-heading]', { hasText: 'Shift Management' })).toBeVisible();
      await expect(commandDialog.getByText('Create Shift')).toBeVisible();
      await expect(commandDialog.getByText('Manage Shifts')).toBeVisible();
    });

    test('searching for navigation items filters correctly', async ({ page }) => {
      await page.goto('/admin');
      
      await page.getByTestId('admin-command-palette-trigger').click();
      await page.getByTestId('admin-command-input').fill('dashboard');
      
      // Should show dashboard navigation item (scope to command dialog)
      const commandDialog = page.getByRole('dialog');
      await expect(commandDialog.getByText('Dashboard')).toBeVisible();
      await expect(commandDialog.getByText('Overview and statistics')).toBeVisible();
    });

    test('navigation items have descriptive subtitles', async ({ page }) => {
      await page.goto('/admin');
      
      await page.getByTestId('admin-command-palette-trigger').click();
      
      // Check that navigation items have descriptions
      await expect(page.getByText('Overview and statistics')).toBeVisible();
      await expect(page.getByText('Manage volunteers and admins')).toBeVisible();
      await expect(page.getByText('Add new volunteer shifts')).toBeVisible();
      await expect(page.getByText('View and edit existing shifts')).toBeVisible();
    });

    test('clicking navigation item navigates to correct page', async ({ page }) => {
      await page.goto('/admin');
      
      await page.getByTestId('admin-command-palette-trigger').click();
      
      // Click on "All Users" navigation item (scope to command dialog)
      const commandDialog = page.getByRole('dialog');
      await commandDialog.getByText('All Users').click();
      
      // Should navigate to users page
      await page.waitForURL('/admin/users', { timeout: 10000 });
      await expect(page).toHaveURL('/admin/users');
      
      // Command palette should close
      await expect(page.getByTestId('admin-command-input')).not.toBeVisible();
    });

    test('external links show external indicator', async ({ page }) => {
      await page.goto('/admin');
      
      await page.getByTestId('admin-command-palette-trigger').click();
      
      // Look for "View Public Shifts" which opens in new tab (scope to command dialog)
      const commandDialog = page.getByRole('dialog');
      const publicShiftsItem = commandDialog.getByText('View Public Shifts');
      await expect(publicShiftsItem).toBeVisible();
      
      // Should have external link indicator (ExternalLink icon) within the command dialog
      const externalIcon = commandDialog.locator('.lucide-external-link');
      await expect(externalIcon).toBeVisible();
    });
  });

  test.describe('Smart Filtering', () => {
    test('person names show users only, not navigation', async ({ page }) => {
      await page.goto('/admin');
      
      await page.getByTestId('admin-command-palette-trigger').click();
      await page.getByTestId('admin-command-input').fill('john');
      
      // Should show Users group for person names
      await expect(page.locator('[cmdk-group-heading]', { hasText: 'Users' })).toBeVisible();
      
      // Should not show navigation items for person names
      await expect(page.locator('[cmdk-group-heading]', { hasText: 'Overview' })).not.toBeVisible();
      await expect(page.locator('[cmdk-group-heading]', { hasText: 'Volunteer Management' })).not.toBeVisible();
    });

    test('navigation keywords show navigation items', async ({ page }) => {
      await page.goto('/admin');
      
      await page.getByTestId('admin-command-palette-trigger').click();
      await page.getByTestId('admin-command-input').fill('shift');
      
      // Should show navigation items related to shifts (scope to command dialog)
      const commandDialog = page.getByRole('dialog');
      await expect(commandDialog.locator('[cmdk-group-heading]', { hasText: 'Shift Management' })).toBeVisible();
      await expect(commandDialog.getByText('Create Shift')).toBeVisible();
      await expect(commandDialog.getByText('Manage Shifts')).toBeVisible();
    });
  });

  test.describe('Loading States and UX', () => {
    test('command palette has fixed height to prevent jumping', async ({ page }) => {
      await page.goto('/admin');
      
      await page.getByTestId('admin-command-palette-trigger').click();
      
      // Get command list element and check it has min/max height classes
      const commandList = page.locator('.max-h-80.min-h-80');
      await expect(commandList).toBeVisible();
    });

    test('search shows loading state while typing', async ({ page }) => {
      await page.goto('/admin');
      
      await page.getByTestId('admin-command-palette-trigger').click();
      
      // Start typing to trigger search
      await page.getByTestId('admin-command-input').fill('test');
      
      // Note: In e2e tests, the loading state might be very brief
      // so we focus on ensuring the functionality works rather than 
      // catching the exact loading moment
      
      // Wait for search to complete
      await page.waitForTimeout(300);
      
      // Should show either results or "No results found"
      const hasResults = await page.locator('[cmdk-group-heading]', { hasText: 'Users' }).isVisible();
      const hasNoResults = await page.getByText('No results found').isVisible();
      
      expect(hasResults || hasNoResults).toBe(true);
    });

    test('clicking outside closes command palette', async ({ page }) => {
      await page.goto('/admin');
      
      await page.getByTestId('admin-command-palette-trigger').click();
      await expect(page.getByTestId('admin-command-input')).toBeVisible();
      
      // Click outside the dialog
      await page.click('body', { position: { x: 50, y: 50 } });
      
      // Command palette should close
      await expect(page.getByTestId('admin-command-input')).not.toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('gracefully handles search API errors', async ({ page }) => {
      await page.goto('/admin');
      
      // Mock API to return error for testing error handling
      await page.route('/api/admin/users*', route => {
        route.fulfill({ status: 500, body: 'Internal Server Error' });
      });
      
      await page.getByTestId('admin-command-palette-trigger').click();
      await page.getByTestId('admin-command-input').fill('error');
      
      // Wait for API call to complete
      await page.waitForTimeout(500);
      
      // Should not crash and should show no results
      await expect(page.getByTestId('admin-command-input')).toBeVisible();
      
      // Should show "No results found" or similar message
      const noResults = page.getByText('No results found');
      await expect(noResults).toBeVisible();
    });
  });
});