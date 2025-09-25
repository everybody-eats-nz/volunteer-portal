import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Helper functions for custom labels e2e testing
 */

export interface CreateLabelOptions {
  name: string;
  color: "purple" | "blue" | "green" | "yellow" | "pink" | "indigo" | "teal" | "orange";
  icon?: string;
}

/**
 * Creates a new custom label through the UI
 */
export async function createCustomLabel(page: Page, options: CreateLabelOptions) {
  // Navigate to custom labels page
  await page.goto("/admin/custom-labels");
  await page.waitForLoadState("domcontentloaded");

  // Click add label button
  await page.getByTestId("create-label-button").click();

  // Wait for dialog to open
  await page.getByRole("dialog").waitFor({ state: "visible" });

  // Fill in label details
  await page.getByTestId("label-name-input").fill(options.name);
  
  // Select color
  await page.getByTestId(`color-option-${options.color}`).click();
  
  // Select icon if provided
  if (options.icon) {
    await page.getByTestId(`icon-option-${options.icon}`).click();
  }

  // Save the label
  await page.getByTestId("save-label-button").click();

  // Wait for dialog to close
  await page.getByRole("dialog").waitFor({ state: "hidden" });

  // Verify the label was created
  const newLabel = page.getByText(options.name);
  await expect(newLabel).toBeVisible();

  return options.name;
}

/**
 * Deletes a custom label by name
 */
export async function deleteCustomLabel(page: Page, labelName: string) {
  await page.goto("/admin/custom-labels");
  await page.waitForLoadState("domcontentloaded");

  // Find the label and click delete button
  const labelRow = page.locator(`[data-testid*="delete-label-"]`, { hasText: labelName });
  
  if (await labelRow.count() > 0) {
    await labelRow.click();
    
    // Confirm deletion if dialog appears
    await page.waitForTimeout(1000);
    
    // Check if label is removed from list
    const deletedLabel = page.getByText(labelName);
    await expect(deletedLabel).not.toBeVisible();
  }
}

/**
 * Adds a label to a user profile by user ID
 */
export async function addLabelToUser(page: Page, userId: string, labelName: string) {
  // Navigate to user profile
  await page.goto(`/admin/volunteers/${userId}`);
  await page.waitForLoadState("domcontentloaded");

  // Click add label button
  const addLabelButton = page.getByTestId("add-label-button");
  await addLabelButton.click();

  // Wait for command palette to open
  await page.waitForTimeout(1000);

  // Find and click the label
  const labelOption = page.getByText(labelName);
  if (await labelOption.count() > 0) {
    await labelOption.click();
    
    // Wait for label to be added
    await page.waitForTimeout(2000);
    
    // Verify label appears on profile
    const assignedLabel = page.getByTestId(/user-label-/).filter({ hasText: labelName });
    await expect(assignedLabel).toBeVisible();
  }
}

/**
 * Removes a label from a user profile
 */
export async function removeLabelFromUser(page: Page, userId: string, labelName: string) {
  await page.goto(`/admin/volunteers/${userId}`);
  await page.waitForLoadState("domcontentloaded");

  // Find the label and hover to show remove button
  const labelBadge = page.getByTestId(/user-label-/).filter({ hasText: labelName });
  
  if (await labelBadge.count() > 0) {
    await labelBadge.hover();
    
    // Click remove button (X)
    const removeButton = page.getByTestId(/remove-label-/).filter({ hasText: labelName });
    if (await removeButton.count() > 0) {
      await removeButton.click();
      
      // Wait for removal
      await page.waitForTimeout(1000);
      
      // Verify label is removed
      await expect(labelBadge).not.toBeVisible();
    }
  }
}

/**
 * Gets the first available volunteer ID for testing
 */
export async function getFirstVolunteerId(page: Page): Promise<string | null> {
  await page.goto("/admin/volunteers");
  await page.waitForLoadState("domcontentloaded");

  // Look for volunteer profile links
  const volunteerLink = page.getByTestId(/volunteer-name-link-/).first();
  
  if (await volunteerLink.count() > 0) {
    const href = await volunteerLink.getAttribute("href");
    if (href) {
      // Extract ID from URL like "/admin/volunteers/123"
      const match = href.match(/\/admin\/volunteers\/([^\/]+)$/);
      return match ? match[1] : null;
    }
  }
  
  return null;
}

/**
 * Registers a new test user with specific age
 */
export async function registerTestUser(page: Page, options: {
  email: string;
  firstName: string;
  lastName: string;
  ageYears: number;
  password?: string;
}): Promise<boolean> {
  const password = options.password || "TestPassword123";
  
  await page.goto("/register");
  await page.waitForLoadState("domcontentloaded");

  // Calculate date of birth
  const today = new Date();
  const birthDate = new Date(today.getFullYear() - options.ageYears, today.getMonth(), today.getDate());
  const dateString = birthDate.toISOString().split('T')[0];

  try {
    // Fill form fields
    await page.getByLabel(/email/i).fill(options.email);
    await page.getByLabel(/first name/i).fill(options.firstName);
    await page.getByLabel(/last name/i).fill(options.lastName);
    await page.getByLabel(/password/i).first().fill(password);
    await page.getByLabel(/confirm password/i).fill(password);
    
    // Fill date of birth
    const dobField = page.getByLabel(/date of birth/i);
    if (await dobField.count() > 0) {
      await dobField.fill(dateString);
    }

    // Accept required agreements
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
      return true;
    }
  } catch (error) {
    console.log("Registration failed:", error);
    return false;
  }
  
  return false;
}

/**
 * Finds a user by email in the admin volunteers list
 */
export async function findUserByEmail(page: Page, email: string): Promise<string | null> {
  await page.goto("/admin/volunteers");
  await page.waitForLoadState("domcontentloaded");

  // Look for the email in the table
  const userRow = page.getByText(email);
  
  if (await userRow.count() > 0) {
    // Try to find the associated profile link
    const profileLink = userRow.locator("..").getByTestId(/volunteer-name-link-/).first();
    
    if (await profileLink.count() > 0) {
      const href = await profileLink.getAttribute("href");
      if (href) {
        const match = href.match(/\/admin\/volunteers\/([^\/]+)$/);
        return match ? match[1] : null;
      }
    }
  }
  
  return null;
}

/**
 * Verifies a label exists in the custom labels list
 */
export async function verifyLabelExists(page: Page, labelName: string): Promise<boolean> {
  await page.goto("/admin/custom-labels");
  await page.waitForLoadState("domcontentloaded");

  const label = page.getByText(labelName);
  return (await label.count()) > 0;
}

/**
 * Verifies a user has a specific label assigned
 */
export async function verifyUserHasLabel(page: Page, userId: string, labelName: string): Promise<boolean> {
  await page.goto(`/admin/volunteers/${userId}`);
  await page.waitForLoadState("domcontentloaded");

  const labelBadge = page.getByTestId(/user-label-/).filter({ hasText: labelName });
  return (await labelBadge.count()) > 0;
}

/**
 * Verifies labels are visible on the shifts management page
 */
export async function verifyLabelsOnShiftsPage(page: Page, expectedLabels: string[] = []): Promise<boolean> {
  await page.goto("/admin/shifts");
  await page.waitForLoadState("domcontentloaded");

  // Check if any volunteer labels are visible
  const volunteerLabels = page.getByTestId(/volunteer-label-/);
  
  if (expectedLabels.length === 0) {
    // Just check if any labels are visible
    return (await volunteerLabels.count()) > 0;
  }
  
  // Check for specific labels
  for (const label of expectedLabels) {
    const specificLabel = page.getByTestId(/volunteer-label-/).filter({ hasText: label });
    if (await specificLabel.count() === 0) {
      return false;
    }
  }
  
  return true;
}

/**
 * Clean up test data - removes test labels and users
 */
export async function cleanupTestData(page: Page, options: {
  labelNames?: string[];
  userEmails?: string[];
}) {
  // Clean up labels
  if (options.labelNames && options.labelNames.length > 0) {
    await page.goto("/admin/custom-labels");
    await page.waitForLoadState("domcontentloaded");
    
    for (const labelName of options.labelNames) {
      const deleteButton = page.getByTestId(/delete-label-/).filter({ hasText: labelName });
      if (await deleteButton.count() > 0) {
        await deleteButton.click();
        await page.waitForTimeout(500);
      }
    }
  }
  
  // Note: User cleanup would require additional API endpoints or database access
  // For now, test users will remain in the system
}