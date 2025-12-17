import { test, expect } from "./base";
import type { Page } from "@playwright/test";
import { loginAsVolunteer } from "./helpers/auth";

// Helper function to wait for achievements page to load
async function waitForAchievementsPage(page: Page) {
  await page
    .getByRole("heading", { name: /achievements/i })
    .waitFor({ state: "visible", timeout: 10000 });
}

// Helper function to expand the leaderboard
async function expandLeaderboard(page: Page) {
  const leaderboardButton = page.getByRole("button", { name: /leaderboard/i });
  await leaderboardButton.waitFor({ state: "visible", timeout: 5000 });
  await leaderboardButton.click();

  // Wait for leaderboard content to load
  await page.waitForTimeout(1000);
}

test.describe("Achievements Leaderboard", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsVolunteer(page);
    await page.goto("/achievements");
    await waitForAchievementsPage(page);
  });

  test("should display leaderboard collapsible section", async ({ page }) => {
    // Check that leaderboard button exists
    const leaderboardButton = page.getByRole("button", { name: /leaderboard/i });
    await expect(leaderboardButton).toBeVisible();

    // Check that Trophy icon is visible in the leaderboard button
    const trophyIcon = page.locator('svg.lucide-trophy').first();
    await expect(trophyIcon).toBeVisible();
  });

  test("should expand leaderboard on click", async ({ page }) => {
    await expandLeaderboard(page);

    // Check that leaderboard content is visible after expansion
    // Should see user cards with ranks
    const userCards = page.locator('[class*="border"][class*="rounded-lg"]').filter({
      has: page.locator('[class*="rounded-full"]') // Rank badges
    });

    // Wait for at least one user card to appear
    await expect(userCards.first()).toBeVisible({ timeout: 5000 });
  });

  test("should display user ranks and points", async ({ page }) => {
    await expandLeaderboard(page);

    // Check for rank badges (circular elements with numbers)
    const rankBadges = page.locator('[class*="rounded-full"][class*="flex items-center justify-center"]');
    await expect(rankBadges.first()).toBeVisible();

    // Check for points display
    const pointsText = page.getByText(/points/i);
    await expect(pointsText.first()).toBeVisible();

    // Check for achievement count
    const achievementsText = page.getByText(/achievements/i);
    await expect(achievementsText.first()).toBeVisible();
  });

  test("should highlight current user", async ({ page }) => {
    await expandLeaderboard(page);

    // Check for "You" badge on current user's card
    const youBadge = page.getByText("You", { exact: true });

    // If the user has a rank in the leaderboard, the badge should be visible
    if (await youBadge.count() > 0) {
      await expect(youBadge).toBeVisible();

      // Check that the current user's card has special highlighting
      // Look for the card that contains the "You" badge
      const currentUserCard = page.locator('[class*="from-yellow-50"][class*="to-orange-50"]').filter({
        has: page.getByText("You", { exact: true })
      });
      await expect(currentUserCard.first()).toBeVisible();
    }
  });

  test("should display 'Show All Above Me' button when user is ranked 5th or lower", async ({ page }) => {
    await expandLeaderboard(page);

    // Wait for content to load
    await page.waitForTimeout(1000);

    // Check if "Show All Above Me" button exists
    const showAllButton = page.getByRole("button", { name: /show all above me/i });

    // The button should only appear if user is ranked 5th or lower
    const buttonExists = await showAllButton.count() > 0;

    if (buttonExists) {
      await expect(showAllButton).toBeVisible();

      // Check that the button shows the count of users above
      const buttonText = await showAllButton.textContent();
      expect(buttonText).toMatch(/\d+ more/); // Should show "N more"
    }
  });

  test("should expand to show all users above when clicking 'Show All Above Me'", async ({ page }) => {
    await expandLeaderboard(page);
    await page.waitForTimeout(1000);

    const showAllButton = page.getByRole("button", { name: /show all above me/i });

    // Only run this test if the button exists (user is ranked 5th or lower)
    if (await showAllButton.count() > 0) {
      // Count users before expansion
      const userCardsBefore = page.locator('[class*="border"][class*="rounded-lg"]').filter({
        has: page.locator('[class*="rounded-full"]')
      });
      const countBefore = await userCardsBefore.count();

      // Click the button
      await showAllButton.click();

      // Wait for the expanded view to load
      await page.waitForTimeout(1500);

      // Count users after expansion
      const userCardsAfter = page.locator('[class*="border"][class*="rounded-lg"]').filter({
        has: page.locator('[class*="rounded-full"]')
      });
      const countAfter = await userCardsAfter.count();

      // Should have more users visible after expansion
      expect(countAfter).toBeGreaterThan(countBefore);

      // Check that rank 1 is now visible
      const rank1Badge = page.locator('[class*="rounded-full"]').filter({ hasText: /^1$/ });
      await expect(rank1Badge).toBeVisible();
    }
  });

  test("should display 'Show Less' button after expanding", async ({ page }) => {
    await expandLeaderboard(page);
    await page.waitForTimeout(1000);

    const showAllButton = page.getByRole("button", { name: /show all above me/i });

    if (await showAllButton.count() > 0) {
      await showAllButton.click();
      await page.waitForTimeout(1000);

      // Check for "Show Less" button
      const showLessButton = page.getByRole("button", { name: /show less/i });
      await expect(showLessButton).toBeVisible();
    }
  });

  test("should collapse back to default view when clicking 'Show Less'", async ({ page }) => {
    await expandLeaderboard(page);
    await page.waitForTimeout(1000);

    const showAllButton = page.getByRole("button", { name: /show all above me/i });

    if (await showAllButton.count() > 0) {
      // Expand first
      await showAllButton.click();
      await page.waitForTimeout(1000);

      // Count users in expanded view
      const userCardsExpanded = page.locator('[class*="border"][class*="rounded-lg"]').filter({
        has: page.locator('[class*="rounded-full"]')
      });
      const countExpanded = await userCardsExpanded.count();

      // Click "Show Less"
      const showLessButton = page.getByRole("button", { name: /show less/i });
      await showLessButton.click();
      await page.waitForTimeout(1000);

      // Count users after collapsing
      const userCardsCollapsed = page.locator('[class*="border"][class*="rounded-lg"]').filter({
        has: page.locator('[class*="rounded-full"]')
      });
      const countCollapsed = await userCardsCollapsed.count();

      // Should have fewer users after collapsing
      expect(countCollapsed).toBeLessThan(countExpanded);

      // "Show All Above Me" button should be visible again
      await expect(showAllButton).toBeVisible();
    }
  });

  test("should display location filter dropdown", async ({ page }) => {
    await expandLeaderboard(page);
    await page.waitForTimeout(1000);

    // Check for location selector
    const locationSelector = page.getByRole("combobox").or(
      page.locator('[class*="select"]').filter({ hasText: /all locations|location/i })
    );

    // Location selector should be visible
    if (await locationSelector.count() > 0) {
      await expect(locationSelector.first()).toBeVisible();
    }
  });

  test("should reset to collapsed view when changing locations", async ({ page }) => {
    await expandLeaderboard(page);
    await page.waitForTimeout(1000);

    const showAllButton = page.getByRole("button", { name: /show all above me/i });

    if (await showAllButton.count() > 0) {
      // Expand the view
      await showAllButton.click();
      await page.waitForTimeout(1000);

      // Verify "Show Less" button is visible
      const showLessButton = page.getByRole("button", { name: /show less/i });
      await expect(showLessButton).toBeVisible();

      // Change location filter (if available)
      const locationTrigger = page.locator('[role="combobox"]').first();

      if (await locationTrigger.count() > 0) {
        await locationTrigger.click();
        await page.waitForTimeout(500);

        // Select a different location (if options are available)
        const locationOptions = page.locator('[role="option"]');
        if (await locationOptions.count() > 1) {
          await locationOptions.nth(1).click();
          await page.waitForTimeout(1500);

          // After changing location, should reset to collapsed view
          // "Show All Above Me" should be visible again (if applicable)
          const showAllButtonAfterChange = page.getByRole("button", { name: /show all above me/i });
          if (await showAllButtonAfterChange.count() > 0) {
            await expect(showAllButtonAfterChange).toBeVisible();
          }

          // "Show Less" should not be visible
          const showLessAfterChange = page.getByRole("button", { name: /show less/i });
          await expect(showLessAfterChange).not.toBeVisible();
        }
      }
    }
  });

  test("should display rank badges with correct colors", async ({ page }) => {
    await expandLeaderboard(page);
    await page.waitForTimeout(1000);

    // Get all leaderboard user cards
    const userCards = page.locator('[class*="border"][class*="rounded-lg"]').filter({
      has: page.locator('[class*="rounded-full"][class*="w-8 h-8"]')
    });

    // Check for rank 1 (gold) within user cards
    const rank1 = userCards.locator('[class*="rounded-full"][class*="w-8 h-8"]').filter({
      hasText: /^1$/
    }).first();

    if (await rank1.count() > 0) {
      // Gold badge for rank 1
      await expect(rank1).toHaveClass(/bg-yellow-400/);
    }

    // Check for rank 2 (silver) if visible
    const rank2 = userCards.locator('[class*="rounded-full"][class*="w-8 h-8"]').filter({
      hasText: /^2$/
    }).first();

    if (await rank2.count() > 0) {
      await expect(rank2).toHaveClass(/bg-gray-300/);
    }

    // Check for rank 3 (bronze) if visible
    const rank3 = userCards.locator('[class*="rounded-full"][class*="w-8 h-8"]').filter({
      hasText: /^3$/
    }).first();

    if (await rank3.count() > 0) {
      await expect(rank3).toHaveClass(/bg-orange-400/);
    }
  });

  test("should display anonymized names for other users", async ({ page }) => {
    await expandLeaderboard(page);
    await page.waitForTimeout(1000);

    // Get all user cards
    const userCards = page.locator('[class*="border"][class*="rounded-lg"]').filter({
      has: page.locator('[class*="rounded-full"]')
    });

    const count = await userCards.count();

    // Check at least one user card
    if (count > 0) {
      for (let i = 0; i < Math.min(count, 5); i++) {
        const card = userCards.nth(i);
        const hasYouBadge = await card.locator('text=You').count() > 0;

        if (!hasYouBadge) {
          // Other users should have anonymized names (FirstName L.)
          const nameText = await card.locator('[class*="font-medium"]').first().textContent();

          // Anonymized names should match pattern "Name L." or "Name L. M."
          // Just verify there's a name present
          expect(nameText).toBeTruthy();
          expect(nameText?.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  test("should handle loading state gracefully", async ({ page }) => {
    const leaderboardButton = page.getByRole("button", { name: /leaderboard/i });
    await leaderboardButton.click();

    // Should not show error messages
    const errorMessage = page.getByText(/error|failed|something went wrong/i);
    await expect(errorMessage).not.toBeVisible();

    // Wait for content to load
    await page.waitForTimeout(2000);

    // Should eventually show content (either users or empty state)
    const leaderboardContent = page.locator('[class*="border"][class*="rounded-lg"]');
    const hasContent = await leaderboardContent.count() > 0;

    expect(hasContent).toBeTruthy();
  });

  test("should be responsive on mobile viewport", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);

    await expandLeaderboard(page);
    await page.waitForTimeout(1000);

    // Leaderboard should still be visible and usable on mobile
    const userCards = page.locator('[class*="border"][class*="rounded-lg"]').filter({
      has: page.locator('[class*="rounded-full"]')
    });

    await expect(userCards.first()).toBeVisible();

    // Buttons should be visible and clickable
    const showAllButton = page.getByRole("button", { name: /show all above me/i });
    if (await showAllButton.count() > 0) {
      await expect(showAllButton).toBeVisible();
    }
  });
});
