import type { Page } from "@playwright/test";
import { test, expect } from "./base";
import { loginAsAdmin } from "./helpers/auth";
import { gotoSettled } from "./helpers/streaming";
import { createTestUser, deleteTestUsers } from "./helpers/test-helpers";
import { randomUUID } from "crypto";

/**
 * Manually archiving an individual volunteer, from both admin surfaces:
 * the users-table row menu and the volunteer profile's Admin Actions card.
 */
test.describe("Admin manual volunteer archiving", () => {
  const testEmails: string[] = [];

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test.afterEach(async ({ page }) => {
    if (testEmails.length > 0) {
      await deleteTestUsers(page, testEmails);
      testEmails.length = 0;
    }
  });

  /**
   * Creates a volunteer and returns their user id, resolved by searching the
   * admin users list for the unique email and reading the row's testid.
   */
  async function createVolunteerAndFindId(
    page: Page,
    email: string
  ): Promise<string> {
    await createTestUser(page, email, "VOLUNTEER");
    testEmails.push(email);

    await gotoSettled(page, `/admin/users?search=${encodeURIComponent(email)}`);

    const row = page.locator("[data-testid^='user-row-']:visible").first();
    await expect(row).toBeVisible({ timeout: 10_000 });

    const rowTestId = await row.getAttribute("data-testid");
    const userId = rowTestId?.replace("user-row-", "");
    expect(userId).toBeTruthy();
    return userId as string;
  }

  test("archives a volunteer from the users table row menu", async ({
    page,
  }) => {
    const email = `manual-archive-table-${randomUUID()}@example.com`;
    const userId = await createVolunteerAndFindId(page, email);

    // An active volunteer offers Archive, not Reactivate.
    await page.getByTestId(`user-actions-${userId}`).click();
    await expect(page.getByTestId(`archive-user-${userId}`)).toBeVisible();
    await expect(page.getByTestId(`reactivate-user-${userId}`)).toHaveCount(0);

    await page.getByTestId(`archive-user-${userId}`).click();

    const dialog = page.getByTestId("archive-user-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(email);

    await page
      .getByTestId("archive-user-note-input")
      .fill("Archived by e2e test");
    await page.getByTestId("archive-user-confirm-button").click();

    await expect(dialog).toBeHidden({ timeout: 10_000 });

    // The row now reads as archived, and the menu flips to Reactivate.
    await gotoSettled(
      page,
      `/admin/users?search=${encodeURIComponent(email)}&archived=all`
    );
    await page.getByTestId(`user-actions-${userId}`).click();
    await expect(page.getByTestId(`reactivate-user-${userId}`)).toBeVisible();
    await expect(page.getByTestId(`archive-user-${userId}`)).toHaveCount(0);
  });

  test("archives a volunteer from their profile and shows the archived banner", async ({
    page,
  }) => {
    const email = `manual-archive-profile-${randomUUID()}@example.com`;
    const userId = await createVolunteerAndFindId(page, email);

    await gotoSettled(page, `/admin/volunteers/${userId}`);

    // Archiving lives in Admin Actions, not the page header.
    const section = page.getByTestId("archive-volunteer-section");
    await expect(section).toBeVisible();
    await expect(page.getByTestId("volunteer-archived-banner")).toHaveCount(0);

    await page.getByTestId("volunteer-archive-button").click();

    const dialog = page.getByTestId("archive-user-dialog");
    await expect(dialog).toBeVisible();
    await page.getByTestId("archive-user-confirm-button").click();
    await expect(dialog).toBeHidden({ timeout: 10_000 });

    // Archived state: banner + Reactivate, and the archive section is gone.
    const banner = page.getByTestId("volunteer-archived-banner");
    await expect(banner).toBeVisible({ timeout: 10_000 });
    await expect(banner).toContainText("Manually archived");
    await expect(page.getByTestId("volunteer-reactivate-button")).toBeVisible();
    await expect(page.getByTestId("archive-volunteer-section")).toHaveCount(0);
    await expect(page.getByTestId("archived-member-badge")).toBeVisible();
  });

  test("reactivating an archived volunteer restores the archive action", async ({
    page,
  }) => {
    const email = `manual-archive-roundtrip-${randomUUID()}@example.com`;
    const userId = await createVolunteerAndFindId(page, email);

    await gotoSettled(page, `/admin/volunteers/${userId}`);
    await page.getByTestId("volunteer-archive-button").click();
    await page.getByTestId("archive-user-confirm-button").click();
    await expect(page.getByTestId("volunteer-archived-banner")).toBeVisible({
      timeout: 10_000,
    });

    await page.getByTestId("volunteer-reactivate-button").click();
    await page.getByTestId("reactivate-user-confirm-button").click();

    await expect(page.getByTestId("volunteer-archived-banner")).toHaveCount(0, {
      timeout: 10_000,
    });
    await expect(page.getByTestId("archive-volunteer-section")).toBeVisible();
  });
});
