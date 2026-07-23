import { test, expect } from "./base";
import type { Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth";
import { createShift, deleteTestShifts } from "./helpers/test-helpers";

/**
 * E2E tests for the admin merge-locations page: fold a duplicate location
 * into the real one, moving shifts and settings across.
 */

async function createTestLocation(
  page: Page,
  name: string
): Promise<{ id: string; name: string }> {
  const uniqueName = `${name}-${Date.now()}`;
  const response = await page.request.post("/api/admin/locations", {
    data: {
      name: uniqueName,
      address: "123 Test Street",
      defaultMealsServed: 60,
    },
  });
  if (!response.ok()) {
    throw new Error(`Failed to create test location: ${response.status()}`);
  }
  return await response.json();
}

test.describe("Admin merge locations", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("merges a duplicate location into the target via the UI", async ({
    page,
  }) => {
    const from = await createTestLocation(page, "MergeDup");
    const into = await createTestLocation(page, "MergeKeep");
    const shiftIds: string[] = [];

    try {
      // A shift under the duplicate that should move across
      const start = new Date();
      start.setDate(start.getDate() + 14);
      start.setHours(17, 0, 0, 0);
      const shift = await createShift(page, {
        location: from.name,
        start,
        capacity: 4,
      });
      shiftIds.push(shift.id);

      await page.goto("/admin/locations/merge");

      await page.getByTestId("merge-from-select").click();
      await page.getByRole("option", { name: from.name }).click();
      await page.getByTestId("merge-into-select").click();
      await page.getByRole("option", { name: into.name }).click();

      await page.getByTestId("merge-preview-button").click();

      const plan = page.getByTestId("merge-plan");
      await expect(plan).toBeVisible();
      await expect(plan).toContainText("1 will move");

      await page.getByTestId("merge-apply-button").click();
      await page.getByTestId("merge-confirm-button").click();

      await expect(page.getByTestId("merge-success")).toBeVisible();
      await expect(page.getByTestId("merge-success")).toContainText(
        `Merged "${from.name}" into "${into.name}"`
      );

      // Nothing references the duplicate any more, and its row is gone
      const recheck = await page.request.post("/api/admin/locations/merge", {
        data: { from: from.name, into: into.name },
      });
      expect(recheck.ok()).toBe(true);
      const { plan: emptyPlan } = await recheck.json();
      expect(emptyPlan.shifts.total).toBe(0);
      expect(emptyPlan.fromLocationExists).toBe(false);

      const locations = await (
        await page.request.get("/api/admin/locations")
      ).json();
      const names = locations.map((loc: { name: string }) => loc.name);
      expect(names).toContain(into.name);
      expect(names).not.toContain(from.name);
    } finally {
      await deleteTestShifts(page, shiftIds);
      const locations = await (
        await page.request.get("/api/admin/locations")
      ).json();
      for (const loc of locations as { id: string; name: string }[]) {
        if (loc.name === into.name || loc.name === from.name) {
          await page.request.delete(`/api/admin/locations/${loc.id}`);
        }
      }
    }
  });

  test("merges an orphaned shift venue with no Location row", async ({
    page,
  }) => {
    const into = await createTestLocation(page, "MergeKeepOrphan");
    // Shifts can reference a venue name with no Location record (e.g. debris
    // from a pre-cascade rename) - the merge page offers those as sources.
    const orphanName = `OrphanVenue-${Date.now()}`;
    const shiftIds: string[] = [];

    try {
      const start = new Date();
      start.setDate(start.getDate() + 14);
      start.setHours(17, 0, 0, 0);
      const shift = await createShift(page, {
        location: orphanName,
        start,
        capacity: 4,
      });
      shiftIds.push(shift.id);

      await page.goto("/admin/locations/merge");

      await page.getByTestId("merge-from-select").click();
      await page
        .getByRole("option", {
          name: `${orphanName} (shifts only, no location record)`,
        })
        .click();
      await page.getByTestId("merge-into-select").click();
      await page.getByRole("option", { name: into.name }).click();

      await page.getByTestId("merge-preview-button").click();

      const plan = page.getByTestId("merge-plan");
      await expect(plan).toBeVisible();
      await expect(plan).toContainText("has no location record");
      await expect(plan).toContainText("1 will move");

      await page.getByTestId("merge-apply-button").click();
      await page.getByTestId("merge-confirm-button").click();

      await expect(page.getByTestId("merge-success")).toBeVisible();

      // The shift no longer references the orphan name
      const recheck = await page.request.post("/api/admin/locations/merge", {
        data: { from: orphanName, into: into.name },
      });
      expect(recheck.ok()).toBe(true);
      const { plan: emptyPlan } = await recheck.json();
      expect(emptyPlan.shifts.total).toBe(0);
      expect(emptyPlan.fromLocationExists).toBe(false);
    } finally {
      await deleteTestShifts(page, shiftIds);
      const locations = await (
        await page.request.get("/api/admin/locations")
      ).json();
      for (const loc of locations as { id: string; name: string }[]) {
        if (loc.name === into.name) {
          await page.request.delete(`/api/admin/locations/${loc.id}`);
        }
      }
    }
  });

  test("preview requires two different locations", async ({ page }) => {
    await page.goto("/admin/locations/merge");
    await expect(page.getByTestId("merge-preview-button")).toBeDisabled();
  });
});
