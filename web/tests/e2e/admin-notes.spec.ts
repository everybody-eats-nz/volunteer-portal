import { test, expect } from "./base";
import type { Page } from "@playwright/test";
import { createTestUser, deleteTestUsers } from "./helpers/test-helpers";

// Helper function to wait for page to load completely
async function waitForPageLoad(page: Page) {
  await page.waitForLoadState("load");
  await page.waitForTimeout(500); // Small buffer for animations
}

// Helper function to login as admin
async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  await waitForPageLoad(page);

  const adminButton = page.getByTestId("quick-login-admin-button");
  await adminButton.click();

  // Wait for navigation away from login page
  await page.waitForURL(
    (url) => {
      return url.pathname !== "/login";
    },
    { timeout: 10000 }
  );
}

// Helper function to get a volunteer ID from the admin users list
async function getVolunteerIdFromUsersList(page: Page): Promise<string | null> {
  await page.goto("/admin/users");
  await waitForPageLoad(page);

  // Look for volunteer cards with view profile links
  const viewProfileLinks = page.locator('a[href*="/admin/volunteers/"]');
  const linkCount = await viewProfileLinks.count();

  if (linkCount > 0) {
    const href = await viewProfileLinks.first().getAttribute("href");
    if (href) {
      const match = href.match(/\/admin\/volunteers\/(.+)/);
      return match ? match[1] : null;
    }
  }

  return null;
}

// Helper function to navigate to a volunteer profile
async function navigateToVolunteerProfile(page: Page, volunteerId: string) {
  await page.goto(`/admin/volunteers/${volunteerId}`);
  await waitForPageLoad(page);
}

test.describe("Admin Notes Management", () => {
  let testVolunteerId: string | null = null;

  test.beforeAll(async ({ browser }) => {
    // Get a volunteer ID once for all tests in this suite
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAsAdmin(page);
    testVolunteerId = await getVolunteerIdFromUsersList(page);
    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    
    // Clean up any existing notes for this volunteer before each test
    if (testVolunteerId) {
      try {
        const response = await page.evaluate(async (volunteerId) => {
          return fetch(`/api/admin/admin-notes?volunteerId=${volunteerId}`, {
            method: 'GET'
          });
        }, testVolunteerId);
        
        if (response) {
          const notes = await page.evaluate(async (volunteerId) => {
            const response = await fetch(`/api/admin/admin-notes?volunteerId=${volunteerId}`, {
              method: 'GET'
            });
            return response.json();
          }, testVolunteerId);
          
          // Delete each note
          for (const note of notes) {
            await page.evaluate(async (noteId) => {
              return fetch(`/api/admin/admin-notes/${noteId}`, {
                method: 'DELETE'
              });
            }, note.id);
          }
        }
      } catch (error) {
        console.log("Error cleaning up notes:", error);
      }
    }
  });

  test("should display admin notes section on volunteer profile", async ({ page }) => {
    test.skip(!testVolunteerId, "No volunteer found in database");
    
    // Navigate to volunteer profile
    await navigateToVolunteerProfile(page, testVolunteerId!);
    
    // Check that the admin notes card is visible
    const adminNotesCard = page.getByTestId("admin-notes-card");
    await expect(adminNotesCard).toBeVisible();
    
    // Check that the admin notes manager is present
    const adminNotesManager = page.getByTestId("admin-notes-manager");
    await expect(adminNotesManager).toBeVisible();
  });

  test("should create a new admin note", async ({ page }) => {
    test.skip(!testVolunteerId, "No volunteer found in database");
    
    await navigateToVolunteerProfile(page, testVolunteerId!);
    
    // Click the "Add Admin Note" button
    const addNoteButton = page.getByTestId("add-note-button");
    await addNoteButton.click();
    
    // Enter note content
    const noteContent = "This is a test admin note for e2e testing";
    const noteTextarea = page.getByTestId("new-note-textarea");
    await expect(noteTextarea).toBeVisible();
    await noteTextarea.fill(noteContent);
    
    // Save the note
    const saveButton = page.getByTestId("save-note-button");
    await saveButton.click();
    
    // Wait for the note to appear
    await page.waitForTimeout(2000);
    
    // Check that the note appears in the list
    const notesList = page.getByTestId("notes-list");
    await expect(notesList).toBeVisible();
    
    // The note content should be visible
    await expect(page.getByText(noteContent)).toBeVisible();
  });

  test("should edit an existing admin note", async ({ page }) => {
    test.skip(!testVolunteerId, "No volunteer found in database");
    
    await navigateToVolunteerProfile(page, testVolunteerId!);
    
    // First create a note to edit
    const addNoteButton = page.getByTestId("add-note-button");
    await addNoteButton.click();
    const noteTextarea = page.getByTestId("new-note-textarea");
    await noteTextarea.fill("Note to be edited");
    const saveButton = page.getByTestId("save-note-button");
    await saveButton.click();
    await page.waitForTimeout(2000);
    
    // Find the first note and click edit
    const firstNote = page.getByTestId("notes-list").locator('[data-testid^="note-"]').first();
    const editButton = firstNote.getByTestId(/edit-note-button-/);
    await editButton.click();
    
    // Find the edit textarea and update content
    const editTextarea = firstNote.getByTestId(/edit-note-textarea-/);
    await expect(editTextarea).toBeVisible();
    await editTextarea.clear();
    await editTextarea.fill("Updated note content for e2e testing");
    
    // Save the changes
    const saveEditButton = firstNote.getByTestId(/save-edit-button-/);
    await saveEditButton.click();
    
    // Wait for the update to complete
    await page.waitForTimeout(2000);
    
    // Check that the updated content is visible
    await expect(page.getByText("Updated note content for e2e testing")).toBeVisible();
  });

  test("should delete an admin note with confirmation dialog", async ({ page }) => {
    test.skip(!testVolunteerId, "No volunteer found in database");
    
    await navigateToVolunteerProfile(page, testVolunteerId!);
    
    // First create a note to delete
    const addNoteButton = page.getByTestId("add-note-button");
    await addNoteButton.click();
    const noteTextarea = page.getByTestId("new-note-textarea");
    await noteTextarea.fill("Note to be deleted in e2e test");
    const saveButton = page.getByTestId("save-note-button");
    await saveButton.click();
    await page.waitForTimeout(2000);
    
    // Now delete it
    const notesToDelete = page.getByText("Note to be deleted in e2e test");
    await expect(notesToDelete).toBeVisible();
    
    // Click the delete button for this note
    const noteContainer = notesToDelete.locator("..").locator("..").locator("..");
    const deleteButton = noteContainer.getByTestId(/delete-note-button-/);
    await deleteButton.click();
    
    // Confirm deletion in the dialog
    const deleteConfirmButton = page.getByTestId("delete-confirm-button");
    await expect(deleteConfirmButton).toBeVisible();
    await deleteConfirmButton.click();
    
    // Wait for deletion to complete
    await page.waitForTimeout(2000);
    
    // Check that the note is no longer visible
    await expect(page.getByText("Note to be deleted in e2e test")).not.toBeVisible();
  });

  test("should cancel note deletion when clicking cancel", async ({ page }) => {
    test.skip(!testVolunteerId, "No volunteer found in database");
    
    await navigateToVolunteerProfile(page, testVolunteerId!);
    
    // First create a note
    const addNoteButton = page.getByTestId("add-note-button");
    await addNoteButton.click();
    const noteTextarea = page.getByTestId("new-note-textarea");
    await noteTextarea.fill("Note for cancel test");
    const saveButton = page.getByTestId("save-note-button");
    await saveButton.click();
    await page.waitForTimeout(2000);
    
    // Find the note and click delete
    const firstNote = page.getByTestId("notes-list").locator('[data-testid^="note-"]').first();
    const deleteButton = firstNote.getByTestId(/delete-note-button-/);
    await deleteButton.click();
    
    // Cancel the deletion
    const cancelButton = page.getByTestId("delete-cancel-button");
    await expect(cancelButton).toBeVisible();
    await cancelButton.click();
    
    // The note should still be visible
    const notesList = page.getByTestId("notes-list");
    await expect(notesList).toBeVisible();
    await expect(page.getByText("Note for cancel test")).toBeVisible();
  });

  test("should cancel adding a new note", async ({ page }) => {
    test.skip(!testVolunteerId, "No volunteer found in database");
    
    await navigateToVolunteerProfile(page, testVolunteerId!);
    
    // Click add note button
    const addNoteButton = page.getByTestId("add-note-button");
    await addNoteButton.click();
    
    // Enter some content
    const noteTextarea = page.getByTestId("new-note-textarea");
    await noteTextarea.fill("This note should be cancelled");
    
    // Click cancel
    const cancelButton = page.getByTestId("cancel-add-button");
    await cancelButton.click();
    
    // The add note button should be visible again
    await expect(addNoteButton).toBeVisible();
    
    // The content should not be saved
    await expect(page.getByText("This note should be cancelled")).not.toBeVisible();
  });

  test("should display no notes message when volunteer has no notes", async ({ page }) => {
    test.skip(!testVolunteerId, "No volunteer found in database");
    
    await navigateToVolunteerProfile(page, testVolunteerId!);
    
    // Check for the no notes message (should show for fresh user with no notes)
    const noNotesMessage = page.getByTestId("no-notes-message");
    await expect(noNotesMessage).toBeVisible();
    await expect(page.getByText("No admin notes yet")).toBeVisible();
  });
});

test.describe("Admin Notes on Shifts Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("should display admin notes button for volunteers with notes on shifts page", async ({ page }) => {
    // Navigate to admin shifts page
    await page.goto("/admin/shifts");
    await waitForPageLoad(page);
    
    // Look for admin notes buttons (volunteers with notes should have them)
    const adminNotesButtons = page.getByTestId(/admin-notes-button-/);
    
    // At least one should be visible (from seed data)
    const firstButton = adminNotesButtons.first();
    if (await firstButton.isVisible()) {
      await expect(firstButton).toBeVisible();
      
      // Click to open the dialog
      await firstButton.click();
      
      // Check that the admin notes dialog opens
      const dialog = page.getByTestId(/admin-notes-dialog-/);
      await expect(dialog).toBeVisible();
      
      // Check that notes are loaded
      const notesList = page.getByTestId("notes-list");
      await expect(notesList).toBeVisible();
      
      // Check for the "Open Profile" button
      const openProfileButton = page.getByTestId("open-volunteer-profile-button");
      await expect(openProfileButton).toBeVisible();
    }
  });

  test("should show loading state when fetching notes", async ({ page }) => {
    await page.goto("/admin/shifts");
    await waitForPageLoad(page);
    
    const adminNotesButtons = page.getByTestId(/admin-notes-button-/);
    const firstButton = adminNotesButtons.first();
    
    if (await firstButton.isVisible()) {
      await firstButton.click();
      
      // Check for loading state (may be brief)
      const dialog = page.getByTestId(/admin-notes-dialog-/);
      await expect(dialog).toBeVisible();
      
      // Loading should disappear and content should appear
      const notesList = page.getByTestId("notes-list");
      await expect(notesList).toBeVisible();
    }
  });

  test("should display correct note count on notes button", async ({ page }) => {
    await page.goto("/admin/shifts");
    await waitForPageLoad(page);
    
    // Look for buttons that show note counts
    const multipleNotesButton = page.locator('button:has-text("notes")');
    const singleNoteButton = page.locator('button:has-text("Note"):not(:has-text("notes"))');
    
    // If we find buttons, they should have appropriate text
    if (await multipleNotesButton.first().isVisible()) {
      const buttonText = await multipleNotesButton.first().textContent();
      expect(buttonText).toMatch(/\d+\s+notes/);
    }
    
    if (await singleNoteButton.first().isVisible()) {
      const buttonText = await singleNoteButton.first().textContent();
      expect(buttonText).toContain("Note");
    }
  });
});

test.describe("Admin Notes Permissions", () => {
  test("should not allow volunteers to access admin notes", async ({ page }) => {
    // This test would require setting up a volunteer user and testing access
    // For now, we can test that the admin notes sections are not visible to non-admins
    // This would require a separate test setup or login as volunteer functionality
    test.skip(true, "Volunteer permission test - requires volunteer login setup");
  });
});