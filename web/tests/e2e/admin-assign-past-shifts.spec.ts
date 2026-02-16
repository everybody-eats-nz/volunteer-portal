import { test, expect } from "./base";
import { loginAsAdmin } from "./helpers/auth";
import {
  createShift,
  createTestUser,
  deleteTestUsers,
  deleteTestShifts,
  getUserByEmail,
} from "./helpers/test-helpers";
import { randomUUID } from "crypto";

test.describe.configure({ mode: "serial" });

/**
 * Tests for assigning volunteers to past shifts.
 *
 * This feature allows admins to retroactively assign volunteers to shifts
 * that have already occurred, useful for tracking walk-ins who showed up
 * without signing up beforehand.
 */
test.describe("Admin - Assign Volunteers to Past Shifts", () => {
  const testId = randomUUID().slice(0, 8);
  const testEmails = [
    `admin-past-shift-${testId}@example.com`,
    `volunteer-past-shift-${testId}@example.com`,
  ];
  const testShiftIds: string[] = [];
  let pastShift: { id: string; start: Date; dateStr: string };
  let futureShift: { id: string; start: Date; dateStr: string };
  let volunteerId: string;

  test.beforeEach(async ({ page }) => {
    // Create admin user
    await createTestUser(page, testEmails[0], "ADMIN");

    // Create volunteer user
    await createTestUser(page, testEmails[1], "VOLUNTEER", {
      firstName: "Test",
      lastName: "Volunteer",
      name: "Test Volunteer",
      volunteerGrade: "GREEN",
    });

    // Login as admin
    await loginAsAdmin(page);

    // Get volunteer ID
    const volunteer = await getUserByEmail(page, testEmails[1]);
    if (!volunteer) {
      throw new Error("Failed to retrieve test volunteer user");
    }
    volunteerId = volunteer.id;

    // Create a past shift (7 days ago) using NZ timezone format
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 7);
    const pastYear = pastDate.getFullYear();
    const pastMonth = String(pastDate.getMonth() + 1).padStart(2, "0");
    const pastDay = String(pastDate.getDate()).padStart(2, "0");
    const pastDateStr = `${pastYear}-${pastMonth}-${pastDay}`;
    const pastShiftStartISO = `${pastDateStr}T12:00:00+13:00`;

    const createdPastShift = await createShift(page, {
      location: "Wellington",
      start: new Date(pastShiftStartISO),
      capacity: 6,
    });
    pastShift = {
      ...createdPastShift,
      dateStr: pastDateStr,
    };
    testShiftIds.push(pastShift.id);

    // Create a future shift (7 days from now) using NZ timezone format
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    const futureYear = futureDate.getFullYear();
    const futureMonth = String(futureDate.getMonth() + 1).padStart(2, "0");
    const futureDay = String(futureDate.getDate()).padStart(2, "0");
    const futureDateStr = `${futureYear}-${futureMonth}-${futureDay}`;
    const futureShiftStartISO = `${futureDateStr}T12:00:00+13:00`;

    const createdFutureShift = await createShift(page, {
      location: "Wellington",
      start: new Date(futureShiftStartISO),
      capacity: 6,
    });
    futureShift = {
      ...createdFutureShift,
      dateStr: futureDateStr,
    };
    testShiftIds.push(futureShift.id);
  });

  test.afterEach(async ({ page }) => {
    // Cleanup test users and shifts
    await deleteTestUsers(page, testEmails);
    await deleteTestShifts(page, testShiftIds);

    // Clear the arrays for the next test
    testShiftIds.length = 0;
  });

  test("should show 'Assign to Past Shift' button for past shifts", async ({
    page,
  }) => {
    // Navigate to the date of the past shift
    await page.goto(`/admin/shifts?date=${pastShift.dateStr}&location=Wellington`);
    await page.waitForLoadState("load");

    // Wait for the shift card to be visible
    const shiftCard = page.locator(`[data-testid="shift-card-${pastShift.id}"]`).first();
    await expect(shiftCard).toBeVisible({ timeout: 10000 });

    // Check that "Assign to Past Shift" button is visible
    const assignButton = page.locator(
      `[data-testid="assign-volunteer-button-${pastShift.id}"]`
    ).first();
    await expect(assignButton).toBeVisible();
    await expect(assignButton).toContainText("Assign to Past Shift");
  });

  test("should show 'Assign Volunteer' button for future shifts", async ({
    page,
  }) => {
    // Navigate to the date of the future shift
    await page.goto(`/admin/shifts?date=${futureShift.dateStr}&location=Wellington`);
    await page.waitForLoadState("load");

    // Wait for the shift card to be visible
    const shiftCard = page.locator(
      `[data-testid="shift-card-${futureShift.id}"]`
    ).first();
    await expect(shiftCard).toBeVisible({ timeout: 10000 });

    // Check that "Assign Volunteer" button is visible
    const assignButton = page.locator(
      `[data-testid="assign-volunteer-button-${futureShift.id}"]`
    ).first();
    await expect(assignButton).toBeVisible();
    await expect(assignButton).toContainText("Assign Volunteer");
    await expect(assignButton).not.toContainText("Assign to Past Shift");
  });

  test("should not show Edit and Delete buttons for past shifts", async ({
    page,
  }) => {
    // Navigate to the date of the past shift
    await page.goto(`/admin/shifts?date=${pastShift.dateStr}&location=Wellington`);
    await page.waitForLoadState("load");

    // Wait for the shift card to be visible
    const shiftCard = page.locator(`[data-testid="shift-card-${pastShift.id}"]`).first();
    await expect(shiftCard).toBeVisible({ timeout: 10000 });

    // Check that Edit button is NOT visible
    const editButton = page.locator(
      `[data-testid="edit-shift-button-${pastShift.id}"]`
    ).first();
    await expect(editButton).not.toBeVisible();

    // Check that Delete button is NOT visible
    const deleteButton = page.locator(
      `[data-testid="delete-shift-button-${pastShift.id}"]`
    ).first();
    await expect(deleteButton).not.toBeVisible();
  });

  test("should show Edit and Delete buttons for future shifts", async ({
    page,
  }) => {
    // Navigate to the date of the future shift

    await page.goto(`/admin/shifts?date=${futureShift.dateStr}&location=Wellington`);
    await page.waitForLoadState("load");

    // Wait for the shift card to be visible
    const shiftCard = page.locator(
      `[data-testid="shift-card-${futureShift.id}"]`
    ).first();
    await expect(shiftCard).toBeVisible({ timeout: 10000 });

    // Check that Edit button IS visible
    const editButton = page.locator(
      `[data-testid="edit-shift-button-${futureShift.id}"]`
    ).first();
    await expect(editButton).toBeVisible();

    // Check that Delete button IS visible
    const deleteButton = page.locator(
      `[data-testid="delete-shift-button-${futureShift.id}"]`
    ).first();
    await expect(deleteButton).toBeVisible();
  });

  test("should open assign volunteer dialog for past shifts", async ({
    page,
  }) => {
    // Navigate to the date of the past shift
    await page.goto(`/admin/shifts?date=${pastShift.dateStr}&location=Wellington`);
    await page.waitForLoadState("load");

    // Click the "Assign to Past Shift" button
    const assignButton = page.locator(
      `[data-testid="assign-volunteer-button-${pastShift.id}"]`
    ).first();
    await expect(assignButton).toBeVisible();
    await assignButton.click();

    // Check that the dialog opened
    const dialog = page.getByTestId("assign-volunteer-dialog");
    await expect(dialog).toBeVisible();

    // Check dialog title
    const dialogTitle = page.getByTestId("assign-volunteer-dialog-title");
    await expect(dialogTitle).toContainText("Assign Volunteer to Shift");

    // Check dialog description
    const dialogDescription = page.getByTestId(
      "assign-volunteer-dialog-description"
    );
    await expect(dialogDescription).toContainText(
      "Manually assign a volunteer to this shift"
    );
  });

  test("should successfully assign a volunteer to a past shift", async ({
    page,
  }) => {
    // Navigate to the date of the past shift
    await page.goto(`/admin/shifts?date=${pastShift.dateStr}&location=Wellington`);
    await page.waitForLoadState("load");

    // Click the "Assign to Past Shift" button
    const assignButton = page.locator(
      `[data-testid="assign-volunteer-button-${pastShift.id}"]`
    ).first();
    await assignButton.click();

    // Wait for dialog to open
    const dialog = page.getByTestId("assign-volunteer-dialog");
    await expect(dialog).toBeVisible();

    // Search for volunteer
    const searchInput = page.getByTestId("volunteer-search-input");
    await searchInput.fill("Test Volunteer");

    // Wait for search results
    await page.waitForTimeout(500); // Wait for debounce

    // Click on the volunteer in search results
    const volunteerResult = page.locator(
      `[data-testid="volunteer-search-result-${volunteerId}"]`
    );
    await expect(volunteerResult).toBeVisible();
    await volunteerResult.click();

    // Verify volunteer was selected
    const selectedVolunteer = page.getByTestId("selected-volunteer-display");
    await expect(selectedVolunteer).toBeVisible();
    await expect(selectedVolunteer).toContainText("Test Volunteer");

    // Add a note
    const noteTextarea = page.getByTestId("assign-volunteer-note");
    await noteTextarea.fill("Walk-in volunteer who showed up without signing up");

    // Click confirm button
    const confirmButton = page.getByTestId("assign-volunteer-confirm-button");
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();

    // Wait for success message
    const successMessage = page.getByTestId("assign-success");
    await expect(successMessage).toBeVisible({ timeout: 5000 });

    // Dialog should close automatically after success
    await expect(dialog).not.toBeVisible({ timeout: 3000 });

    // Page should refresh and show the volunteer in the shift
    await page.waitForLoadState("load");

    // Verify the volunteer appears in the shift
    await expect(page.getByText("Test Volunteer").first()).toBeVisible();
  });

  test("should show correct status badge for volunteer assigned to past shift", async ({
    page,
  }) => {
    // First, assign a volunteer to the past shift via API
    await page.request.post(
      `/api/admin/shifts/${pastShift.id}/assign`,
      {
        data: {
          volunteerId: volunteerId,
          status: "CONFIRMED",
          note: "Test assignment",
        },
      }
    );

    // Navigate to the date of the past shift
    await page.goto(`/admin/shifts?date=${pastShift.dateStr}&location=Wellington`);
    await page.waitForLoadState("load");

    // For past shifts, confirmed volunteers should show "Attended" status
    await expect(page.getByText("Attended").first()).toBeVisible();
    await expect(page.getByText("Test Volunteer").first()).toBeVisible();
  });

  test("should prevent duplicate assignment to past shifts", async ({
    page,
  }) => {
    // First, assign a volunteer to the past shift
    await page.request.post(
      `/api/admin/shifts/${pastShift.id}/assign`,
      {
        data: {
          volunteerId: volunteerId,
          status: "CONFIRMED",
        },
      }
    );

    // Navigate to the date of the past shift
    await page.goto(`/admin/shifts?date=${pastShift.dateStr}&location=Wellington`);
    await page.waitForLoadState("load");

    // Try to assign the same volunteer again
    const assignButton = page.locator(
      `[data-testid="assign-volunteer-button-${pastShift.id}"]`
    ).first();
    await assignButton.click();

    // Search for the same volunteer
    const searchInput = page.getByTestId("volunteer-search-input");
    await searchInput.fill("Test Volunteer");
    await page.waitForTimeout(500);

    // Click on the volunteer
    const volunteerResult = page.locator(
      `[data-testid="volunteer-search-result-${volunteerId}"]`
    );
    await volunteerResult.click();

    // Try to confirm
    const confirmButton = page.getByTestId("assign-volunteer-confirm-button");
    await confirmButton.click();

    // Should show error message
    const errorMessage = page.getByTestId("assign-error");
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText("already");
  });

  test("should handle capacity warning when assigning to full past shift", async ({
    page,
  }) => {
    // Create a past shift with capacity 1
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 5);
    pastDate.setHours(14, 0, 0, 0);

    const smallShift = await createShift(page, {
      location: "Wellington",
      start: pastDate,
      capacity: 1,
    });
    testShiftIds.push(smallShift.id);

    // Assign first volunteer to fill capacity
    const firstVolunteer = await getUserByEmail(page, testEmails[1]);
    await page.request.post(
      `/api/admin/shifts/${smallShift.id}/assign`,
      {
        data: {
          volunteerId: firstVolunteer!.id,
          status: "CONFIRMED",
        },
      }
    );

    // Create second volunteer to exceed capacity
    const secondVolunteerEmail = `second-vol-${testId}@example.com`;
    testEmails.push(secondVolunteerEmail);
    await createTestUser(page, secondVolunteerEmail, "VOLUNTEER", {
      firstName: "Second",
      lastName: "Volunteer",
      name: "Second Volunteer",
    });
    const secondVolunteer = await getUserByEmail(page, secondVolunteerEmail);

    // Navigate to the shift
    const year = pastDate.getFullYear();
    const month = String(pastDate.getMonth() + 1).padStart(2, "0");
    const day = String(pastDate.getDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${day}`;

    await page.goto(`/admin/shifts?date=${dateStr}&location=Wellington`);
    await page.waitForLoadState("load");

    // Open assign dialog
    const assignButton = page.locator(
      `[data-testid="assign-volunteer-button-${smallShift.id}"]`
    ).first();
    await assignButton.click();

    // Check for capacity warning
    const capacityWarning = page.getByTestId("capacity-warning");
    await expect(capacityWarning).toBeVisible();
    await expect(capacityWarning).toContainText("at capacity");

    // Should still allow assignment (admin override)
    const searchInput = page.getByTestId("volunteer-search-input");
    await searchInput.fill("Second Volunteer");
    await page.waitForTimeout(500);

    const volunteerResult = page.locator(
      `[data-testid="volunteer-search-result-${secondVolunteer!.id}"]`
    );
    await volunteerResult.click();

    const confirmButton = page.getByTestId("assign-volunteer-confirm-button");
    await expect(confirmButton).toBeEnabled();
  });
});
