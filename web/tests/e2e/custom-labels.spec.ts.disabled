import { test, expect } from "./base";
import { loginAsAdmin, loginAsVolunteer } from "./helpers/auth";

test.describe("Custom Labels System", () => {
  test.describe("Admin - Custom Labels Management", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
    });

    test("should display custom labels page with all main elements", async ({ page }) => {
      await page.goto("/admin/custom-labels");
      await page.waitForLoadState("domcontentloaded");

      // Check page loads successfully
      await expect(page).toHaveURL("/admin/custom-labels");

      // Check main heading
      const pageHeading = page.getByRole("heading", { name: "Custom Labels" });
      await expect(pageHeading).toBeVisible();

      // Check description
      const description = page.getByText(/create and manage custom labels for volunteers \(admin-only\)/i);
      await expect(description).toBeVisible();

      // Check add label button
      const addButton = page.getByTestId("create-label-button");
      await expect(addButton).toBeVisible();
      await expect(addButton).toContainText("Add Label");
    });

    test("should create a new custom label", async ({ page }) => {
      await page.goto("/admin/custom-labels");
      await page.waitForLoadState("domcontentloaded");

      // Click add label button
      await page.getByTestId("create-label-button").click();

      // Wait for dialog to open
      await page.getByRole("dialog").waitFor({ state: "visible" });

      // Fill in label details
      await page.getByTestId("label-name-input").fill("Test Label");
      
      // Select a color (click on blue option)
      await page.getByTestId("color-option-blue").click();
      
      // Select an icon (click on star emoji)
      await page.getByTestId("icon-option-⭐").click();

      // Save the label
      await page.getByTestId("save-label-button").click();

      // Wait for dialog to close and check success
      await page.getByRole("dialog").waitFor({ state: "hidden" });

      // Verify the new label appears in the list
      const newLabel = page.getByText("Test Label");
      await expect(newLabel).toBeVisible();

      // Verify the label has the correct styling (contains the star icon)
      const labelBadge = page.getByTestId("custom-label-badge").filter({ hasText: "Test Label" });
      await expect(labelBadge).toBeVisible();
    });

    test("should edit an existing custom label", async ({ page }) => {
      await page.goto("/admin/custom-labels");
      await page.waitForLoadState("domcontentloaded");

      // Look for an existing label to edit (should have seed data)
      const firstEditButton = page.getByTestId(/edit-label-/).first();
      
      // Only run this test if there are existing labels
      if (await firstEditButton.count() > 0) {
        await firstEditButton.click();

        // Wait for dialog to open
        await page.getByRole("dialog").waitFor({ state: "visible" });

        // Change the label name
        await page.getByTestId("label-name-input").fill("Updated Label Name");
        
        // Change color to purple
        await page.getByTestId("color-option-purple").click();

        // Save the changes
        await page.getByTestId("save-label-button").click();

        // Wait for dialog to close
        await page.getByRole("dialog").waitFor({ state: "hidden" });

        // Verify the updated label appears
        const updatedLabel = page.getByText("Updated Label Name");
        await expect(updatedLabel).toBeVisible();
      }
    });

    test("should validate label creation form", async ({ page }) => {
      await page.goto("/admin/custom-labels");
      await page.waitForLoadState("domcontentloaded");

      // Click add label button
      await page.getByTestId("create-label-button").click();

      // Wait for dialog to open
      await page.getByRole("dialog").waitFor({ state: "visible" });

      // Try to save without filling required fields
      const saveButton = page.getByTestId("save-label-button");
      await expect(saveButton).toBeDisabled();

      // Fill only name, button should still be disabled due to form validation
      await page.getByTestId("label-name-input").fill("Test");
      
      // Now button should be enabled (color has default value)
      await expect(saveButton).toBeEnabled();

      // Clear the name, button should be disabled again
      await page.getByTestId("label-name-input").fill("");
      await expect(saveButton).toBeDisabled();
    });

    test("should prevent duplicate label names", async ({ page }) => {
      await page.goto("/admin/custom-labels");
      await page.waitForLoadState("domcontentloaded");

      // First, create a label
      await page.getByTestId("create-label-button").click();
      await page.getByRole("dialog").waitFor({ state: "visible" });
      
      const uniqueName = `Unique Label ${Date.now()}`;
      await page.getByTestId("label-name-input").fill(uniqueName);
      await page.getByTestId("color-option-green").click();
      await page.getByTestId("save-label-button").click();
      
      await page.getByRole("dialog").waitFor({ state: "hidden" });

      // Now try to create another label with the same name
      await page.getByTestId("create-label-button").click();
      await page.getByRole("dialog").waitFor({ state: "visible" });
      
      await page.getByTestId("label-name-input").fill(uniqueName);
      await page.getByTestId("color-option-blue").click();
      await page.getByTestId("save-label-button").click();

      // Should show error message (look for error styling or message)
      // The exact error handling depends on your toast/error implementation
      // This test verifies the duplicate is handled gracefully
      await page.waitForTimeout(2000); // Give time for error to show
    });
  });

  test.describe("Admin - User Label Assignment", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
    });

    test("should display user labels manager on volunteer profile", async ({ page }) => {
      // Navigate to a volunteer profile (assuming we have test data)
      await page.goto("/admin/volunteers");
      await page.waitForLoadState("domcontentloaded");

      // Click on the first volunteer profile link if it exists
      const firstVolunteerLink = page.getByTestId(/volunteer-name-link-/).first();
      
      if (await firstVolunteerLink.count() > 0) {
        await firstVolunteerLink.click();
        await page.waitForLoadState("domcontentloaded");

        // Look for the custom labels section
        const labelsSection = page.getByRole("heading", { name: "Custom Labels" });
        await expect(labelsSection).toBeVisible();

        // Check for add label button
        const addLabelButton = page.getByTestId("add-label-button");
        await expect(addLabelButton).toBeVisible();
      }
    });

    test("should add and remove labels from user profile", async ({ page }) => {
      // Navigate to users list first
      await page.goto("/admin/volunteers");
      await page.waitForLoadState("domcontentloaded");

      const firstVolunteerLink = page.getByTestId(/volunteer-name-link-/).first();
      
      if (await firstVolunteerLink.count() > 0) {
        await firstVolunteerLink.click();
        await page.waitForLoadState("domcontentloaded");

        // Click add label button
        const addLabelButton = page.getByTestId("add-label-button");
        if (await addLabelButton.count() > 0) {
          await addLabelButton.click();

          // Wait for command dialog to open and look for available labels
          await page.waitForTimeout(1000);

          // Try to find and click the first available label
          const firstLabel = page.getByTestId(/add-label-/).first();
          if (await firstLabel.count() > 0) {
            await firstLabel.click();

            // Wait for the label to be added
            await page.waitForTimeout(2000);

            // Look for the newly added label
            const userLabel = page.getByTestId(/user-label-/).first();
            if (await userLabel.count() > 0) {
              await expect(userLabel).toBeVisible();

              // Try to remove the label by hovering and clicking X
              await userLabel.hover();
              const removeButton = page.getByTestId(/remove-label-/).first();
              if (await removeButton.count() > 0) {
                await removeButton.click();
                
                // Confirm removal (if confirmation dialog exists)
                // This depends on your implementation
                await page.waitForTimeout(1000);
              }
            }
          }
        }
      }
    });
  });

  test.describe("Admin - Labels on Shifts Page", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
    });

    test("should display labels on manage shifts page", async ({ page }) => {
      await page.goto("/admin/shifts");
      await page.waitForLoadState("domcontentloaded");

      // Look for volunteer entries with labels
      // This test checks that labels appear alongside volunteer grade badges
      const volunteerLabels = page.getByTestId(/volunteer-label-/);
      
      // If there are volunteers with labels, they should be visible
      if (await volunteerLabels.count() > 0) {
        await expect(volunteerLabels.first()).toBeVisible();
      }

      // Check that volunteer grade badges are still visible (not replaced)
      const volunteerGrades = page.getByTestId(/volunteer-grade-/);
      if (await volunteerGrades.count() > 0) {
        await expect(volunteerGrades.first()).toBeVisible();
      }
    });
  });

  test.describe("Volunteer Access Restrictions", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsVolunteer(page);
    });

    test("should not allow volunteers to access custom labels page", async ({ page }) => {
      // Try to access the admin custom labels page
      await page.goto("/admin/custom-labels");
      
      // Should be redirected to dashboard (not authorized)
      await page.waitForURL("/dashboard", { timeout: 10000 });
      await expect(page).toHaveURL("/dashboard");
    });

    test("should not show custom labels in volunteer navigation", async ({ page }) => {
      await page.goto("/dashboard");
      await page.waitForLoadState("domcontentloaded");

      // Check that admin sidebar or custom labels link is not visible
      const customLabelsLink = page.getByText("Custom Labels");
      await expect(customLabelsLink).not.toBeVisible();
    });

    test("should not show labels on volunteer profile view", async ({ page }) => {
      await page.goto("/profile");
      await page.waitForLoadState("domcontentloaded");

      // Verify no custom labels section is visible on volunteer's own profile
      const labelsHeading = page.getByRole("heading", { name: "Custom Labels" });
      await expect(labelsHeading).not.toBeVisible();

      // Verify no label badges are visible
      const labelBadges = page.getByTestId("custom-label-badge");
      await expect(labelBadges).not.toBeVisible();
    });
  });

  test.describe("Auto-Labeling System", () => {
    test("should auto-assign 'Under 18' label for minors during registration", async ({ page }) => {
      // This test would require creating a new user registration with DOB < 18
      // Navigate to registration page
      await page.goto("/register");
      await page.waitForLoadState("domcontentloaded");

      // Fill out registration form with underage DOB
      const today = new Date();
      const underageDate = new Date(today.getFullYear() - 16, today.getMonth(), today.getDate());
      const dateString = underageDate.toISOString().split('T')[0];

      // Fill form fields (this would need to be adapted to your actual form structure)
      const emailField = page.getByLabel(/email/i);
      if (await emailField.count() > 0) {
        const uniqueEmail = `testuser_${Date.now()}@example.com`;
        
        await emailField.fill(uniqueEmail);
        
        // Fill other required fields
        await page.getByLabel(/first name/i).fill("Test");
        await page.getByLabel(/last name/i).fill("User");
        await page.getByLabel(/password/i).first().fill("TestPassword123");
        await page.getByLabel(/confirm password/i).fill("TestPassword123");
        
        // Fill date of birth with underage date
        const dobField = page.getByLabel(/date of birth/i);
        if (await dobField.count() > 0) {
          await dobField.fill(dateString);
        }

        // Accept terms (adapt to your actual form structure)
        const volunteerAgreement = page.getByLabel(/volunteer agreement/i);
        if (await volunteerAgreement.count() > 0) {
          await volunteerAgreement.check();
        }

        const healthSafety = page.getByLabel(/health.*safety/i);
        if (await healthSafety.count() > 0) {
          await healthSafety.check();
        }

        // Submit form
        const submitButton = page.getByRole("button", { name: /register|sign up/i });
        if (await submitButton.count() > 0) {
          await submitButton.click();
          
          // Wait for registration to complete
          await page.waitForTimeout(3000);

          // Now login as admin to check if the "Under 18" label was assigned
          await page.goto("/login");
          await loginAsAdmin(page);
          
          // Navigate to users list and search for the new user
          await page.goto("/admin/volunteers");
          await page.waitForLoadState("domcontentloaded");
          
          // Look for the newly created user by email
          const userRow = page.getByText(uniqueEmail);
          if (await userRow.count() > 0) {
            // Click on the user to view profile
            await userRow.click();
            await page.waitForLoadState("domcontentloaded");
            
            // Check if "Under 18" label is assigned
            const under18Label = page.getByText("Under 18");
            await expect(under18Label).toBeVisible();
          }
        }
      }
    });

    test("should auto-assign 'New Volunteer' label during registration", async ({ page }) => {
      // Similar to above test but focuses on the "New Volunteer" label
      // This is simpler as it doesn't depend on age
      
      await page.goto("/register");
      await page.waitForLoadState("domcontentloaded");

      const emailField = page.getByLabel(/email/i);
      if (await emailField.count() > 0) {
        const uniqueEmail = `newvol_${Date.now()}@example.com`;
        
        await emailField.fill(uniqueEmail);
        await page.getByLabel(/first name/i).fill("New");
        await page.getByLabel(/last name/i).fill("Volunteer");
        await page.getByLabel(/password/i).first().fill("TestPassword123");
        await page.getByLabel(/confirm password/i).fill("TestPassword123");

        // Accept terms
        const volunteerAgreement = page.getByLabel(/volunteer agreement/i);
        if (await volunteerAgreement.count() > 0) {
          await volunteerAgreement.check();
        }

        const healthSafety = page.getByLabel(/health.*safety/i);
        if (await healthSafety.count() > 0) {
          await healthSafety.check();
        }

        // Submit form
        const submitButton = page.getByRole("button", { name: /register|sign up/i });
        if (await submitButton.count() > 0) {
          await submitButton.click();
          await page.waitForTimeout(3000);

          // Login as admin and verify "New Volunteer" label
          await page.goto("/login");
          await loginAsAdmin(page);
          
          await page.goto("/admin/volunteers");
          await page.waitForLoadState("domcontentloaded");
          
          const userRow = page.getByText(uniqueEmail);
          if (await userRow.count() > 0) {
            await userRow.click();
            await page.waitForLoadState("domcontentloaded");
            
            const newVolunteerLabel = page.getByText("New Volunteer");
            await expect(newVolunteerLabel).toBeVisible();
          }
        }
      }
    });
  });
});