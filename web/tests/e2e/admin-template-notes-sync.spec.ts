import { test, expect } from "./base";
import { loginAsAdmin } from "./helpers/auth";
import { gotoSettled } from "./helpers/streaming";
import {
  createShift,
  createShiftTemplate,
  deleteShiftTemplates,
  deleteTestShifts,
  getShiftTypeByName,
} from "./helpers/test-helpers";
import { randomUUID } from "crypto";

/**
 * Editing a template's notes carries them through to the shifts that template
 * has already put on the roster - the shifts admins are looking at today, not
 * just the ones they create next. Shifts whose notes were edited on their own
 * keep their version.
 */
test.describe("Template notes reach shifts already on the roster", () => {
  const templateIds: string[] = [];
  const shiftIds: string[] = [];

  let templateName: string;
  let shiftTypeId: string;
  let followingShiftId: string;
  let customisedShiftId: string;

  const ORIGINAL_NOTES = "Bring closed-toe shoes";
  const UPDATED_NOTES = "Bring closed-toe shoes and an apron";
  const CUSTOM_NOTES = "Ask for Sam at the back door";

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);

    // "Kitchen Prep" is a seeded shift type - a bare "Kitchen" only exists once
    // something has created it, so it is not there on a freshly seeded CI run.
    const shiftType = await getShiftTypeByName(page, "Kitchen Prep");
    if (!shiftType) throw new Error("Seeded shift type 'Kitchen Prep' not found");
    shiftTypeId = shiftType.id;

    templateName = `Notes Sync ${randomUUID().slice(0, 8)}`;
    const template = await createShiftTemplate(page, {
      name: templateName,
      shiftTypeId,
      location: "Wellington",
      startTime: "10:00",
      endTime: "13:00",
      capacity: 4,
      notes: ORIGINAL_NOTES,
    });
    templateIds.push(template.id);

    // Two upcoming shifts from the template: one still carrying the template's
    // notes, one an admin has since written their own notes on.
    const start = new Date();
    start.setDate(start.getDate() + 14);
    start.setHours(10, 0, 0, 0);
    const end = new Date(start);
    end.setHours(13, 0, 0, 0);

    const following = await createShift(page, {
      location: "Wellington",
      start,
      end,
      capacity: 4,
      shiftTypeId,
      notes: ORIGINAL_NOTES,
      templateId: template.id,
    });
    followingShiftId = following.id;
    shiftIds.push(following.id);

    const customised = await createShift(page, {
      location: "Wellington",
      start,
      end,
      capacity: 4,
      shiftTypeId,
      notes: CUSTOM_NOTES,
      templateId: template.id,
    });
    customisedShiftId = customised.id;
    shiftIds.push(customised.id);
  });

  test.afterEach(async ({ page }) => {
    await deleteTestShifts(page, shiftIds);
    await deleteShiftTemplates(page, templateIds);
    shiftIds.length = 0;
    templateIds.length = 0;
  });

  test("applies edited template notes to upcoming shifts that still follow the template", async ({
    page,
  }) => {
    await gotoSettled(page, "/admin/shifts/new?tab=templates");

    // Open the Wellington group, then this template's edit dialog. Locators here
    // are scoped to the visible copy: while React relocates streamed content out
    // of its hidden staging container, admin markup briefly exists twice (see
    // helpers/streaming.ts).
    await page
      .getByTestId("template-location-group-wellington")
      .locator("visible=true")
      .click();

    const templateRow = page
      .locator("li")
      .filter({ hasText: templateName })
      .locator("visible=true")
      .first();
    await expect(templateRow).toContainText("2 upcoming shifts");
    await templateRow.getByRole("button", { name: "Edit" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // The option is on by default and says what it will reach
    const applyNotes = dialog.getByTestId("apply-notes-to-upcoming-checkbox");
    await expect(applyNotes).toBeChecked();
    await expect(dialog).toContainText("2 upcoming shifts");

    await dialog.getByLabel("Notes (Optional)").fill(UPDATED_NOTES);
    await dialog.getByRole("button", { name: "Update Template" }).click();

    await expect(
      page.getByTestId("shift-creation-feedback").locator("visible=true")
    ).toContainText("1 upcoming shift");

    // The shift that was still following the template now shows the new notes
    await gotoSettled(page, `/admin/shifts/${followingShiftId}/edit`);
    await expect(
      page.getByTestId("edit-shift-notes-textarea").locator("visible=true")
    ).toHaveValue(UPDATED_NOTES);

    // The shift with its own notes keeps them
    await gotoSettled(page, `/admin/shifts/${customisedShiftId}/edit`);
    await expect(
      page.getByTestId("edit-shift-notes-textarea").locator("visible=true")
    ).toHaveValue(CUSTOM_NOTES);
  });

  test("leaves rostered shifts alone when the option is unchecked", async ({
    page,
  }) => {
    await gotoSettled(page, "/admin/shifts/new?tab=templates");

    await page
      .getByTestId("template-location-group-wellington")
      .locator("visible=true")
      .click();

    const templateRow = page
      .locator("li")
      .filter({ hasText: templateName })
      .locator("visible=true")
      .first();
    await templateRow.getByRole("button", { name: "Edit" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByTestId("apply-notes-to-upcoming-checkbox").uncheck();
    await dialog.getByLabel("Notes (Optional)").fill(UPDATED_NOTES);
    await dialog.getByRole("button", { name: "Update Template" }).click();

    await expect(
      page.getByTestId("shift-creation-feedback").locator("visible=true")
    ).toContainText("Template updated.");

    await gotoSettled(page, `/admin/shifts/${followingShiftId}/edit`);
    await expect(
      page.getByTestId("edit-shift-notes-textarea").locator("visible=true")
    ).toHaveValue(ORIGINAL_NOTES);
  });
});
