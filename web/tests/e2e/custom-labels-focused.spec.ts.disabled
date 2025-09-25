import { test, expect } from "./base";
import { loginAsAdmin, loginAsVolunteer } from "./helpers/auth";
import {
  createCustomLabel,
  addLabelToUser,
  removeLabelFromUser,
  getFirstVolunteerId,
  registerTestUser,
  findUserByEmail,
  verifyUserHasLabel,
  verifyLabelsOnShiftsPage,
  cleanupTestData
} from "./helpers/custom-labels";

test.describe("Custom Labels System - Focused Tests", () => {
  const testLabelName = `Test Label ${Date.now()}`;
  const testUserEmail = `testuser_${Date.now()}@example.com`;

  test.afterAll(async ({ browser }) => {
    // Cleanup test data
    const page = await browser.newPage();
    await loginAsAdmin(page);
    await cleanupTestData(page, {
      labelNames: [testLabelName],
      userEmails: [testUserEmail]
    });
    await page.close();
  });

  test.describe("Label Management Workflow", () => {
    test("should create, assign, and display custom label", async ({ page }) => {
      await loginAsAdmin(page);

      // Step 1: Create a new custom label
      await createCustomLabel(page, {
        name: testLabelName,
        color: "purple",
        icon: "⭐"
      });

      // Step 2: Get a volunteer to assign the label to
      const volunteerId = await getFirstVolunteerId(page);
      
      if (volunteerId) {
        // Step 3: Assign the label to the volunteer
        await addLabelToUser(page, volunteerId, testLabelName);

        // Step 4: Verify the label appears on the user profile
        const hasLabel = await verifyUserHasLabel(page, volunteerId, testLabelName);
        expect(hasLabel).toBe(true);

        // Step 5: Verify the label appears on the shifts management page
        const labelsVisible = await verifyLabelsOnShiftsPage(page, [testLabelName]);
        expect(labelsVisible).toBe(true);

        // Step 6: Remove the label from the user
        await removeLabelFromUser(page, volunteerId, testLabelName);

        // Step 7: Verify the label is removed
        const stillHasLabel = await verifyUserHasLabel(page, volunteerId, testLabelName);
        expect(stillHasLabel).toBe(false);
      }
    });
  });

  test.describe("Auto-Labeling Integration", () => {
    test("should auto-assign labels to new underage user", async ({ page }) => {
      // Register a new underage user (16 years old)
      const registrationSuccess = await registerTestUser(page, {
        email: testUserEmail,
        firstName: "Test",
        lastName: "Minor",
        ageYears: 16
      });

      expect(registrationSuccess).toBe(true);

      // Login as admin to check the labels
      await loginAsAdmin(page);

      // Find the newly created user
      const userId = await findUserByEmail(page, testUserEmail);
      
      if (userId) {
        // Check if "Under 18" label was auto-assigned
        const hasUnder18Label = await verifyUserHasLabel(page, userId, "Under 18");
        expect(hasUnder18Label).toBe(true);

        // Check if "New Volunteer" label was auto-assigned
        const hasNewVolunteerLabel = await verifyUserHasLabel(page, userId, "New Volunteer");
        expect(hasNewVolunteerLabel).toBe(true);
      }
    });

    test("should auto-assign only new volunteer label to adult user", async ({ page }) => {
      const adultUserEmail = `adult_${Date.now()}@example.com`;
      
      // Register an adult user (25 years old)
      const registrationSuccess = await registerTestUser(page, {
        email: adultUserEmail,
        firstName: "Test",
        lastName: "Adult",
        ageYears: 25
      });

      expect(registrationSuccess).toBe(true);

      // Login as admin to check the labels
      await loginAsAdmin(page);

      // Find the newly created user
      const userId = await findUserByEmail(page, adultUserEmail);
      
      if (userId) {
        // Check that "Under 18" label was NOT assigned
        const hasUnder18Label = await verifyUserHasLabel(page, userId, "Under 18");
        expect(hasUnder18Label).toBe(false);

        // Check if "New Volunteer" label was auto-assigned
        const hasNewVolunteerLabel = await verifyUserHasLabel(page, userId, "New Volunteer");
        expect(hasNewVolunteerLabel).toBe(true);
      }
    });
  });

  test.describe("Security and Access Control", () => {
    test("should prevent volunteer access to admin features", async ({ page }) => {
      await loginAsVolunteer(page);

      // Test 1: Cannot access custom labels management page
      await page.goto("/admin/custom-labels");
      await page.waitForURL("/dashboard", { timeout: 10000 });
      expect(page.url()).toContain("/dashboard");

      // Test 2: Cannot see custom labels in navigation
      const customLabelsLink = page.getByText("Custom Labels");
      await expect(customLabelsLink).not.toBeVisible();

      // Test 3: Cannot see labels on own profile
      await page.goto("/profile");
      await page.waitForLoadState("domcontentloaded");
      
      const labelsSection = page.getByRole("heading", { name: "Custom Labels" });
      await expect(labelsSection).not.toBeVisible();
    });

    test("should prevent direct API access for volunteers", async ({ page }) => {
      await loginAsVolunteer(page);

      // Try to access label management API endpoints directly
      const responses = await Promise.all([
        page.request.get("/api/admin/custom-labels"),
        page.request.post("/api/admin/custom-labels", {
          data: { name: "Unauthorized", color: "red" }
        })
      ]);

      // All requests should return 403 Forbidden or redirect
      responses.forEach(response => {
        expect(response.status()).toBeGreaterThanOrEqual(400);
      });
    });
  });

  test.describe("UI Validation and Error Handling", () => {
    test("should validate label creation form", async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto("/admin/custom-labels");
      await page.waitForLoadState("domcontentloaded");

      // Open create label dialog
      await page.getByTestId("create-label-button").click();
      await page.getByRole("dialog").waitFor({ state: "visible" });

      // Test empty form validation
      const saveButton = page.getByTestId("save-label-button");
      await expect(saveButton).toBeDisabled();

      // Test partial form completion
      await page.getByTestId("label-name-input").fill("Test");
      await expect(saveButton).toBeEnabled();

      // Test clearing required field
      await page.getByTestId("label-name-input").fill("");
      await expect(saveButton).toBeDisabled();

      // Close dialog
      await page.getByRole("button", { name: /cancel/i }).click();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
    });

    test("should handle duplicate label names gracefully", async ({ page }) => {
      await loginAsAdmin(page);

      const duplicateName = `Duplicate Test ${Date.now()}`;

      // Create first label
      await createCustomLabel(page, {
        name: duplicateName,
        color: "blue"
      });

      // Try to create duplicate
      await page.goto("/admin/custom-labels");
      await page.getByTestId("create-label-button").click();
      await page.getByRole("dialog").waitFor({ state: "visible" });
      
      await page.getByTestId("label-name-input").fill(duplicateName);
      await page.getByTestId("color-option-red").click();
      await page.getByTestId("save-label-button").click();

      // Should show error or prevent creation
      await page.waitForTimeout(2000);
      
      // Dialog might still be open due to error, or closed with error toast
      // This verifies the system handles the duplicate gracefully
      const dialog = page.getByRole("dialog");
      const dialogVisible = await dialog.count() > 0 && await dialog.isVisible();
      
      if (!dialogVisible) {
        // If dialog closed, there should be only one instance of the label
        await page.goto("/admin/custom-labels");
        const labelCount = await page.getByText(duplicateName).count();
        expect(labelCount).toBeLessThanOrEqual(1);
      }
    });
  });
});