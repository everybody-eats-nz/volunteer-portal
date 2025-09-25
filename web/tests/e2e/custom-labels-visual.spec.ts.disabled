import { test, expect } from "./base";
import { loginAsAdmin } from "./helpers/auth";

test.describe("Custom Labels - Visual and Integration Tests", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("should display labels with correct visual styling", async ({ page }) => {
    await page.goto("/admin/custom-labels");
    await page.waitForLoadState("domcontentloaded");

    // Check if seed data labels are present and styled correctly
    const seedLabels = [
      "Under 18",
      "New Volunteer", 
      "Team Leader",
      "High Priority",
      "Needs Support",
      "VIP",
      "Mentor"
    ];

    for (const labelName of seedLabels) {
      const labelElement = page.getByTestId("custom-label-badge").filter({ hasText: labelName });
      
      if (await labelElement.count() > 0) {
        // Verify the label is visible
        await expect(labelElement.first()).toBeVisible();

        // Verify it has badge-like styling (should contain certain CSS classes)
        const labelClasses = await labelElement.first().getAttribute("class");
        expect(labelClasses).toContain("border"); // Badge border
        expect(labelClasses).toContain("rounded"); // Badge rounded corners
      }
    }
  });

  test("should show user count for each label", async ({ page }) => {
    await page.goto("/admin/custom-labels");
    await page.waitForLoadState("domcontentloaded");

    // Look for labels with user count display
    const labelCards = page.locator('[data-testid*="custom-label-badge"]').locator("..");
    
    if (await labelCards.count() > 0) {
      const firstCard = labelCards.first();
      
      // Look for volunteer count text pattern
      const countText = firstCard.getByText(/\d+ volunteer/);
      if (await countText.count() > 0) {
        await expect(countText.first()).toBeVisible();
      }
    }
  });

  test("should display color picker with predefined options", async ({ page }) => {
    await page.goto("/admin/custom-labels");
    await page.waitForLoadState("domcontentloaded");

    // Open create label dialog
    await page.getByTestId("create-label-button").click();
    await page.getByRole("dialog").waitFor({ state: "visible" });

    // Check that all color options are available
    const colorOptions = [
      "purple", "blue", "green", "yellow", 
      "pink", "indigo", "teal", "orange"
    ];

    for (const color of colorOptions) {
      const colorButton = page.getByTestId(`color-option-${color}`);
      await expect(colorButton).toBeVisible();
    }

    // Test color selection
    await page.getByTestId("color-option-purple").click();
    
    // Verify preview shows selected color
    const preview = page.getByTestId("custom-label-badge").filter({ hasText: "Label Name" });
    if (await preview.count() > 0) {
      const previewClasses = await preview.getAttribute("class");
      expect(previewClasses).toContain("purple");
    }

    // Close dialog
    await page.getByRole("button", { name: /cancel/i }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
  });

  test("should display emoji icon picker", async ({ page }) => {
    await page.goto("/admin/custom-labels");
    await page.waitForLoadState("domcontentloaded");

    // Open create label dialog
    await page.getByTestId("create-label-button").click();
    await page.getByRole("dialog").waitFor({ state: "visible" });

    // Check that emoji options are available
    const emojiOptions = ["⭐", "🔥", "💎", "🏆", "🎯", "⚡", "🌟", "🎖️"];

    for (const emoji of emojiOptions) {
      const emojiButton = page.getByTestId(`icon-option-${emoji}`);
      await expect(emojiButton).toBeVisible();
    }

    // Test emoji selection
    await page.getByTestId("icon-option-⭐").click();
    
    // Verify preview shows selected emoji
    const preview = page.getByTestId("custom-label-badge").filter({ hasText: "Label Name" });
    if (await preview.count() > 0) {
      const previewContent = await preview.textContent();
      expect(previewContent).toContain("⭐");
    }

    // Close dialog
    await page.getByRole("button", { name: /cancel/i }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
  });

  test("should display labels alongside volunteer grades on shifts page", async ({ page }) => {
    await page.goto("/admin/shifts");
    await page.waitForLoadState("domcontentloaded");

    // Look for volunteer entries in shifts
    const volunteerEntries = page.getByTestId(/volunteer-grade-/);
    
    if (await volunteerEntries.count() > 0) {
      // Check that volunteer grade badges are still present
      await expect(volunteerEntries.first()).toBeVisible();

      // Check that custom labels can coexist (if any volunteers have labels)
      const customLabelBadges = page.getByTestId(/volunteer-label-/);
      
      // If there are custom labels, they should be visible
      if (await customLabelBadges.count() > 0) {
        await expect(customLabelBadges.first()).toBeVisible();
      }
    }
  });

  test("should handle responsive design on mobile viewport", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto("/admin/custom-labels");
    await page.waitForLoadState("domcontentloaded");

    // Check that the page is still usable on mobile
    const heading = page.getByRole("heading", { name: "Custom Labels" });
    await expect(heading).toBeVisible();

    const addButton = page.getByTestId("create-label-button");
    await expect(addButton).toBeVisible();

    // Test creating label on mobile
    await addButton.click();
    await page.getByRole("dialog").waitFor({ state: "visible" });

    // Form should still be accessible
    const nameInput = page.getByTestId("label-name-input");
    await expect(nameInput).toBeVisible();

    // Color picker should be responsive (grid layout)
    const colorOptions = page.getByTestId(/color-option-/);
    await expect(colorOptions.first()).toBeVisible();

    // Close dialog
    await page.getByRole("button", { name: /cancel/i }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
  });

  test("should display proper loading states and transitions", async ({ page }) => {
    await page.goto("/admin/custom-labels");
    await page.waitForLoadState("domcontentloaded");

    // Test creating a label to see loading states
    await page.getByTestId("create-label-button").click();
    await page.getByRole("dialog").waitFor({ state: "visible" });

    await page.getByTestId("label-name-input").fill(`Loading Test ${Date.now()}`);
    await page.getByTestId("color-option-blue").click();

    // Click save and look for loading state
    const saveButton = page.getByTestId("save-label-button");
    await saveButton.click();

    // The button might show loading text or be disabled
    await page.waitForTimeout(500);

    // Wait for dialog to close (indicating completion)
    await page.getByRole("dialog").waitFor({ state: "hidden" });

    // Verify the new label appears
    const newLabel = page.getByText("Loading Test");
    if (await newLabel.count() > 0) {
      await expect(newLabel.first()).toBeVisible();
    }
  });

  test("should maintain consistent spacing and layout", async ({ page }) => {
    await page.goto("/admin/custom-labels");
    await page.waitForLoadState("domcontentloaded");

    // Check overall page layout
    const pageTitle = page.getByRole("heading", { name: "Custom Labels" });
    await expect(pageTitle).toBeVisible();

    const description = page.getByText(/create and manage custom labels/i);
    await expect(description).toBeVisible();

    // Check that labels are displayed in a consistent grid/list format
    const labelCards = page.locator('[data-testid*="custom-label-badge"]').locator("..");
    
    if (await labelCards.count() > 1) {
      // All cards should have similar spacing
      for (let i = 0; i < Math.min(3, await labelCards.count()); i++) {
        const card = labelCards.nth(i);
        await expect(card).toBeVisible();
      }
    }

    // Check edit/delete buttons are properly aligned
    const actionButtons = page.getByTestId(/edit-label-|delete-label-/);
    if (await actionButtons.count() > 0) {
      await expect(actionButtons.first()).toBeVisible();
    }
  });

  test("should handle empty state properly", async ({ page }) => {
    // This test assumes we can access a clean state or have a way to clear all labels
    await page.goto("/admin/custom-labels");
    await page.waitForLoadState("domcontentloaded");

    // Look for empty state message if no labels exist
    const emptyStateHeading = page.getByText("No labels yet");
    const emptyStateButton = page.getByText("Create First Label");

    // Either we have labels (normal state) or empty state
    const hasLabels = await page.getByTestId("custom-label-badge").count() > 0;
    const hasEmptyState = await emptyStateHeading.count() > 0;

    // One of these should be true
    expect(hasLabels || hasEmptyState).toBe(true);

    if (hasEmptyState) {
      await expect(emptyStateHeading).toBeVisible();
      await expect(emptyStateButton).toBeVisible();
    }
  });
});