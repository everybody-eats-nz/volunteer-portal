import { randomUUID } from "crypto";
import { test, expect } from "./base";
import { loginAsAdmin } from "./helpers/auth";
import { gotoSettled } from "./helpers/streaming";
import {
  createTestUser,
  deleteTestUsers,
  getUserByEmail,
} from "./helpers/test-helpers";

/**
 * Labels that ask for a note (e.g. "Management Note"): the setting on the
 * label, the note prompt when it's added to a volunteer, and the note on
 * their profile. Plus the shift applications report that sits beside them.
 */
test.describe("Label notes", () => {
  const suffix = randomUUID().slice(0, 8);
  const labelName = `Mgmt Note ${suffix}`;
  const volunteerEmail = `label-note-${suffix}@example.com`;
  let volunteerId: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await createTestUser(page, volunteerEmail);
    volunteerId = (await getUserByEmail(page, volunteerEmail))!.id;
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await deleteTestUsers(page, [volunteerEmail]);
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("a label can ask for a note, and the note is required when adding it", async ({
    page,
  }) => {
    await gotoSettled(page, "/admin/custom-labels");
    await page.getByTestId("create-label-button").click();
    await page.getByTestId("label-name-input").fill(labelName);
    await page.getByTestId("label-requires-note-switch").click();
    await expect(page.getByTestId("label-requires-note-switch")).toHaveAttribute(
      "data-state",
      "checked"
    );
    await page.getByTestId("save-label-button").click();
    await expect(page.getByRole("dialog")).toBeHidden();

    const card = page
      .locator('[data-testid^="label-card-"]')
      .filter({ hasText: labelName });
    await expect(card.getByText("Asks for a note")).toBeVisible();

    // Add it to a volunteer: picking it asks for the note first
    await gotoSettled(page, `/admin/volunteers/${volunteerId}`);
    await page.getByTestId("add-label-button").click();
    await page
      .getByRole("dialog")
      .locator('[cmdk-item]')
      .filter({ hasText: labelName })
      .click();

    const save = page.getByTestId("save-label-note-button");
    await expect(save).toBeDisabled();
    const note = "Please bring a support person to shifts.";
    await page.getByTestId("label-note-input").fill(note);
    await expect(save).toBeEnabled();
    await save.click();

    const notes = page.getByTestId("label-notes");
    await expect(notes).toContainText(labelName);
    await expect(notes).toContainText(note);
  });

  test("the shift applications report loads", async ({ page }) => {
    await gotoSettled(page, "/admin/analytics/applications");
    await expect(page.getByTestId("applications-target-card")).toBeVisible();
    await expect(page.getByTestId("applications-overdue-card")).toBeVisible();
    await expect(page.getByTestId("applications-by-location-table")).toBeVisible();
  });
});
