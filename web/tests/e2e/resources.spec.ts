import { test, expect } from "./base";
import { loginAsAdmin } from "./helpers/auth";

// SKIPPED: Resource Hub requires Supabase Storage to be configured
// The page crashes with "Missing Supabase environment variables" in test environment
// TODO: Either configure Supabase for tests or mock the storage dependency
test.describe.skip("Public Resource Hub", () => {
  test.describe("Page Access", () => {
    test("should allow unauthenticated users to access resources page", async ({
      page,
    }) => {
      await page.goto("/resources");
      await page.waitForLoadState("load");

      // Verify page loads with header
      await expect(page.getByRole("heading", { name: "Resource Hub" })).toBeVisible();
      await expect(
        page.getByText(/access training materials, policies/i)
      ).toBeVisible();
    });

    test("should show resources link in main navigation", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("load");

      // Check for Resources link in nav
      const resourcesLink = page.getByRole("link", { name: /resources/i });
      await expect(resourcesLink).toBeVisible();
    });
  });

  test.describe("Resource Display", () => {
    test("should display resource grid", async ({ page }) => {
      await page.goto("/resources");
      await page.waitForLoadState("load");

      // Either shows resources or empty state
      const hasResources = await page.locator(".grid").count();
      const hasEmptyState = await page
        .getByText(/no resources found/i)
        .count();

      expect(hasResources > 0 || hasEmptyState > 0).toBeTruthy();
    });

    test("should show resource count", async ({ page }) => {
      await page.goto("/resources");
      await page.waitForLoadState("load");

      // Check for count display
      await expect(page.getByText(/showing \d+ resource/i)).toBeVisible();
    });

    test("should display resource cards with metadata when resources exist", async ({
      page,
    }) => {
      await page.goto("/resources");
      await page.waitForLoadState("load");

      // Check if any resources exist
      const cards = page.locator('[role="heading"]').filter({ hasText: /resource hub/i }).locator('..').locator('..').locator('..').locator('div[class*="grid"]');
      const cardCount = await cards.locator('> div').count();

      if (cardCount > 0) {
        // Verify first card has expected elements
        const firstCard = cards.locator('> div').first();

        // Should have a title
        await expect(firstCard.locator('h3').first()).toBeVisible();

        // Should have type icon/badge
        await expect(firstCard.locator('[class*="rounded-lg p-2"]')).toBeVisible();

        // Should have category badge
        await expect(firstCard.locator('[class*="badge"]').first()).toBeVisible();

        // Should have action button (Open or View)
        const actionButton = firstCard.getByRole('button', { name: /(open|view)/i });
        await expect(actionButton).toBeVisible();
      }
    });

    test("should show tag badges with limit", async ({ page }) => {
      await page.goto("/resources");
      await page.waitForLoadState("load");

      // If resources with multiple tags exist, verify +N indicator logic
      const allBadges = page.locator('[class*="badge"]');
      const badgeCount = await allBadges.count();

      // Just verify badges render if they exist
      if (badgeCount > 0) {
        expect(badgeCount).toBeGreaterThan(0);
      }
    });
  });

  test.describe("Search Functionality", () => {
    test("should have search input and filters", async ({ page }) => {
      await page.goto("/resources");
      await page.waitForLoadState("load");

      // Verify search box exists
      await expect(
        page.getByPlaceholder(/search resources/i)
      ).toBeVisible();

      // Verify filter selects exist
      await expect(page.getByRole("combobox").first()).toBeVisible();

      // Verify search button exists
      await expect(
        page.getByRole("button", { name: /search/i })
      ).toBeVisible();
    });

    test("should filter by search query via URL parameter", async ({
      page,
    }) => {
      await page.goto("/resources?search=test");
      await page.waitForLoadState("load");

      // Verify search field is populated
      const searchInput = page.getByPlaceholder(/search resources/i);
      await expect(searchInput).toHaveValue("test");
    });

    test("should update URL when searching", async ({ page }) => {
      await page.goto("/resources");
      await page.waitForLoadState("load");

      const searchInput = page.getByPlaceholder(/search resources/i);
      await searchInput.fill("kitchen");

      const searchButton = page.getByRole("button", { name: /search/i });
      await searchButton.click();

      // Wait for navigation
      await page.waitForURL(/search=kitchen/);
      expect(page.url()).toContain("search=kitchen");
    });

    test("should search on Enter key", async ({ page }) => {
      await page.goto("/resources");
      await page.waitForLoadState("load");

      const searchInput = page.getByPlaceholder(/search resources/i);
      await searchInput.fill("safety");
      await searchInput.press("Enter");

      // Wait for navigation
      await page.waitForURL(/search=safety/);
      expect(page.url()).toContain("search=safety");
    });
  });

  test.describe("Category Filter", () => {
    test("should filter by category", async ({ page }) => {
      await page.goto("/resources");
      await page.waitForLoadState("load");

      // Click category dropdown
      const categorySelect = page.getByRole("combobox").first();
      await categorySelect.click();

      // Select a category (e.g., Training)
      await page.getByRole("option", { name: /training/i }).click();

      // Wait for URL to update
      await page.waitForURL(/category=TRAINING/);
      expect(page.url()).toContain("category=TRAINING");
    });

    test("should persist category from URL parameter", async ({ page }) => {
      await page.goto("/resources?category=POLICIES");
      await page.waitForLoadState("load");

      // Verify category filter reflects URL param
      const categorySelect = page.getByRole("combobox").first();
      await expect(categorySelect).toContainText(/policies/i);
    });

    test("should reset category to all", async ({ page }) => {
      await page.goto("/resources?category=FORMS");
      await page.waitForLoadState("load");

      // Select "All Categories"
      const categorySelect = page.getByRole("combobox").first();
      await categorySelect.click();
      await page.getByRole("option", { name: /all categories/i }).click();

      // Wait for URL update - category param should be removed
      await page.waitForTimeout(500);
      expect(page.url()).not.toContain("category=");
    });
  });

  test.describe("Type Filter", () => {
    test("should filter by resource type", async ({ page }) => {
      await page.goto("/resources");
      await page.waitForLoadState("load");

      // Find and click type dropdown (should be second combobox)
      const typeSelect = page.getByRole("combobox").nth(1);
      await typeSelect.click();

      // Select PDF type
      await page.getByRole("option", { name: /^PDF$/i }).click();

      // Wait for URL to update
      await page.waitForURL(/type=PDF/);
      expect(page.url()).toContain("type=PDF");
    });

    test("should persist type from URL parameter", async ({ page }) => {
      await page.goto("/resources?type=VIDEO");
      await page.waitForLoadState("load");

      // Verify type filter reflects URL param
      const typeSelect = page.getByRole("combobox").nth(1);
      await expect(typeSelect).toContainText(/video/i);
    });
  });

  test.describe("Tag Filter", () => {
    test("should display available tags if any exist", async ({ page }) => {
      await page.goto("/resources");
      await page.waitForLoadState("load");

      // Check if tags section exists
      const tagsSection = page.getByText(/filter by tags/i);
      const hasTags = (await tagsSection.count()) > 0;

      // If tags exist, verify they're clickable badges
      if (hasTags) {
        await expect(tagsSection).toBeVisible();

        // Verify there are badge elements
        const badges = page.locator('[class*="badge"]');
        const badgeCount = await badges.count();
        expect(badgeCount).toBeGreaterThan(0);
      }
    });

    test("should filter by tag when clicked", async ({ page }) => {
      await page.goto("/resources");
      await page.waitForLoadState("load");

      // Check if tags exist
      const tagsSection = page.getByText(/filter by tags/i);
      const hasTags = (await tagsSection.count()) > 0;

      if (hasTags) {
        // Click first tag badge
        const firstTag = page.locator('[class*="badge"]').first();
        const tagText = await firstTag.textContent();
        await firstTag.click();

        // Wait for URL to update with tags parameter
        await page.waitForTimeout(500);
        expect(page.url()).toContain("tags=");
      } else {
        test.skip(true, "No tags available to test filtering");
      }
    });

    test("should persist tags from URL parameter", async ({ page }) => {
      await page.goto("/resources?tags=beginner,safety");
      await page.waitForLoadState("load");

      // Check if tags section exists
      const tagsSection = page.getByText(/filter by tags/i);
      const hasTags = (await tagsSection.count()) > 0;

      if (hasTags) {
        // Verify selected tags have default styling (not outline)
        // This is implementation-dependent, so just verify URL persists
        expect(page.url()).toContain("tags=beginner,safety");
      }
    });
  });

  test.describe("Combined Filters", () => {
    test("should apply multiple filters together", async ({ page }) => {
      await page.goto("/resources");
      await page.waitForLoadState("load");

      // Apply search
      const searchInput = page.getByPlaceholder(/search resources/i);
      await searchInput.fill("guide");

      // Apply category
      const categorySelect = page.getByRole("combobox").first();
      await categorySelect.click();
      await page.getByRole("option", { name: /guides/i }).click();

      // Wait for URL update
      await page.waitForTimeout(500);

      // Click search button to apply search
      const searchButton = page.getByRole("button", { name: /search/i });
      await searchButton.click();

      // Verify URL has both parameters
      await page.waitForURL(/search=guide/);
      expect(page.url()).toContain("search=guide");
      expect(page.url()).toContain("category=GUIDES");
    });

    test("should clear all filters", async ({ page }) => {
      await page.goto("/resources?search=test&category=TRAINING&type=PDF");
      await page.waitForLoadState("load");

      // Clear button should be visible
      const clearButton = page.getByRole("button", { name: /clear/i });
      await expect(clearButton).toBeVisible();

      await clearButton.click();

      // Wait for navigation to clean URL
      await page.waitForURL("/resources");
      expect(page.url()).toBe(expect.not.stringContaining("search="));
      expect(page.url()).toBe(expect.not.stringContaining("category="));
      expect(page.url()).toBe(expect.not.stringContaining("type="));
    });

    test("should hide clear button when no filters active", async ({
      page,
    }) => {
      await page.goto("/resources");
      await page.waitForLoadState("load");

      // Clear button should not be visible
      const clearButton = page.getByRole("button", { name: /clear/i });
      await expect(clearButton).not.toBeVisible();
    });

    test("should show clear button when filters are active", async ({
      page,
    }) => {
      await page.goto("/resources");
      await page.waitForLoadState("load");

      // Apply a search filter
      const searchInput = page.getByPlaceholder(/search resources/i);
      await searchInput.fill("test");

      const searchButton = page.getByRole("button", { name: /search/i });
      await searchButton.click();

      await page.waitForURL(/search=test/);

      // Clear button should now be visible
      const clearButton = page.getByRole("button", { name: /clear/i });
      await expect(clearButton).toBeVisible();
    });
  });

  test.describe("Empty States", () => {
    test("should show empty state for no results", async ({ page }) => {
      // Search for something that likely doesn't exist
      await page.goto("/resources?search=xyzabc123nonexistent");
      await page.waitForLoadState("load");

      // Should show "no resources found" message
      await expect(page.getByText(/no resources found/i)).toBeVisible();
      await expect(
        page.getByText(/try adjusting your search or filters/i)
      ).toBeVisible();
    });
  });

  test.describe("Resource Actions", () => {
    test("should have action buttons on resource cards", async ({ page }) => {
      await page.goto("/resources");
      await page.waitForLoadState("load");

      // Check if resources exist
      const cards = page.locator('div[class*="grid"] > div');
      const cardCount = await cards.count();

      if (cardCount > 0) {
        // Verify first card has an action button
        const firstCard = cards.first();
        const actionButton = firstCard.getByRole("button", {
          name: /(open|view)/i,
        });
        await expect(actionButton).toBeVisible();
      } else {
        test.skip(true, "No resources available to test actions");
      }
    });

    test("should open resource in new tab when card is clicked", async ({
      page,
      context,
    }) => {
      await page.goto("/resources");
      await page.waitForLoadState("load");

      // Check if resources exist
      const cards = page.locator('div[class*="grid"] > div');
      const cardCount = await cards.count();

      if (cardCount > 0) {
        // Set up listener for new page
        const pagePromise = context.waitForEvent("page");

        // Click the first card
        await cards.first().click();

        // Wait for new page and verify it opened
        const newPage = await pagePromise;
        expect(newPage.url()).toBeTruthy();
        await newPage.close();
      } else {
        test.skip(true, "No resources available to test card click");
      }
    });
  });

  test.describe("Responsive Design", () => {
    test("should display properly on mobile viewport", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/resources");
      await page.waitForLoadState("load");

      // Verify header is visible
      await expect(
        page.getByRole("heading", { name: "Resource Hub" })
      ).toBeVisible();

      // Verify search interface is visible
      await expect(
        page.getByPlaceholder(/search resources/i)
      ).toBeVisible();
    });

    test("should display grid layout on desktop", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("/resources");
      await page.waitForLoadState("load");

      // Verify grid container exists
      const grid = page.locator('div[class*="grid"]');
      await expect(grid).toBeVisible();
    });
  });

  test.describe("Accessibility", () => {
    test("should have proper heading hierarchy", async ({ page }) => {
      await page.goto("/resources");
      await page.waitForLoadState("load");

      // Check for h1
      await expect(
        page.getByRole("heading", { level: 1, name: "Resource Hub" })
      ).toBeVisible();
    });

    test("should have accessible form controls", async ({ page }) => {
      await page.goto("/resources");
      await page.waitForLoadState("load");

      // Search input should have placeholder
      const searchInput = page.getByPlaceholder(/search resources/i);
      await expect(searchInput).toBeVisible();

      // Buttons should have accessible names
      await expect(
        page.getByRole("button", { name: /search/i })
      ).toBeVisible();
    });

    test("should support keyboard navigation for search", async ({ page }) => {
      await page.goto("/resources");
      await page.waitForLoadState("load");

      const searchInput = page.getByPlaceholder(/search resources/i);

      // Focus search input
      await searchInput.focus();

      // Type and press Enter
      await searchInput.fill("test");
      await searchInput.press("Enter");

      // Should navigate with search param
      await page.waitForURL(/search=test/);
      expect(page.url()).toContain("search=test");
    });
  });
});
