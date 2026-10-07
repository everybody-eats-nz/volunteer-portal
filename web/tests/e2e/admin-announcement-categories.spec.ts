import type { Page } from "@playwright/test";
import { test, expect } from "./base";
import { loginAsAdmin } from "./helpers/auth";
import { gotoSettled } from "./helpers/streaming";
import {
  createTestUser,
  deleteTestUsers,
  getUserByEmail,
} from "./helpers/test-helpers";
import { randomUUID } from "node:crypto";

/**
 * Announcement categories (issue #1317): every announcement is classified,
 * the composer can't publish without a category, shift-related ones must
 * target shifts, and admins can re-categorise from the list.
 */
test.describe("Admin announcement categories", () => {
  // Announcements this run published, deleted afterwards via the API.
  const created: string[] = [];

  test.afterEach(async ({ page }) => {
    for (const id of created.splice(0)) {
      await page.request.delete(`/api/admin/announcements/${id}`);
    }
  });

  async function openComposer(page: Page) {
    await loginAsAdmin(page);
    await gotoSettled(page, "/admin/announcements");
    await page.getByTestId("announcement-new").click();
    await expect(page.getByTestId("announcement-category")).toBeVisible();
  }

  test("requires a category before publishing", async ({ page }) => {
    await openComposer(page);

    await page.getByTestId("announcement-title").fill("Kia ora whānau");
    await page.getByTestId("announcement-body").fill("A message for everyone.");

    await expect(page.getByTestId("announcement-publish")).toBeDisabled();
    await expect(page.getByTestId("announcement-publish-blocker")).toHaveText(
      "Choose a category to publish."
    );

    await page.getByTestId("announcement-category-URGENT").click();
    await expect(page.getByTestId("announcement-publish")).toBeEnabled();
    await expect(page.getByTestId("announcement-publish-blocker")).toHaveCount(
      0
    );
  });

  test("blocks a shift-related announcement until shifts are targeted", async ({
    page,
  }) => {
    await openComposer(page);

    await page.getByTestId("announcement-title").fill("Uniform reminder");
    await page.getByTestId("announcement-body").fill("Black shirts please.");
    await page.getByTestId("announcement-category-SHIFT_RELATED").click();

    await expect(
      page.getByTestId("announcement-category-needs-shifts")
    ).toBeVisible();
    await expect(page.getByTestId("announcement-publish")).toBeDisabled();
    await expect(page.getByTestId("announcement-publish-blocker")).toHaveText(
      "Pick at least one shift for a shift-related announcement."
    );

    // The shortcut opens the audience's shift picker.
    await page.getByRole("button", { name: "Choose shifts" }).click();
    await expect(
      page.getByTestId("audience-group-specific-shifts")
    ).toHaveAttribute("aria-expanded", "true");

    // The API enforces the same rule.
    const res = await page.request.post("/api/admin/announcements", {
      data: {
        title: "Uniform reminder",
        body: "Black shirts please.",
        category: "SHIFT_RELATED",
      },
    });
    expect(res.status()).toBe(400);
  });

  test("publishes with a category and re-categorises from the list", async ({
    page,
  }) => {
    const title = `Student deals ${Date.now()}`;
    await openComposer(page);

    await page.getByTestId("announcement-category-PROMOTIONAL").click();
    await page.getByTestId("announcement-title").fill(title);
    await page.getByTestId("announcement-body").fill("Hopper Cafe deals.");

    const published = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/admin/announcements") &&
        r.request().method() === "POST"
    );
    await page.getByTestId("announcement-publish").click();
    const { announcement } = await (await published).json();
    created.push(announcement.id);
    expect(announcement.category).toBe("PROMOTIONAL");

    const row = page
      .getByTestId("announcement-row")
      .filter({ hasText: title });
    await expect(row.getByTestId("announcement-category-badge")).toHaveText(
      "Promotional"
    );

    // The category filter narrows the list to that category.
    await page.getByTestId("announcement-category-filter-SHIFT_SHORTAGE").click();
    await expect(row).toHaveCount(0);
    await page.getByTestId("announcement-category-filter-PROMOTIONAL").click();
    await expect(row).toHaveCount(1);
    // Clear the filter, or the row would vanish once it changes category.
    await page.getByTestId("announcement-category-filter-PROMOTIONAL").click();

    // Re-categorise. Shift-related is unavailable: this targets no shifts.
    await row.getByTestId("announcement-category-menu").click();
    await expect(
      page.getByTestId("announcement-category-option-SHIFT_RELATED")
    ).toHaveAttribute("data-disabled", "");
    const patched = page.waitForResponse(
      (r) =>
        r.url().endsWith(`/api/admin/announcements/${announcement.id}`) &&
        r.request().method() === "PATCH"
    );
    await page.getByTestId("announcement-category-option-SHIFT_SHORTAGE").click();
    expect((await patched).status()).toBe(200);

    await expect(row.getByTestId("announcement-category-badge")).toHaveText(
      "Shift shortage"
    );

    // Persisted: survives a reload.
    await gotoSettled(page, "/admin/announcements");
    await expect(
      page
        .getByTestId("announcement-row")
        .filter({ hasText: title })
        .getByTestId("announcement-category-badge")
    ).toHaveText("Shift shortage");
  });

  test("leaves volunteers who opted out of a category out of the reach", async ({
    page,
  }) => {
    const suffix = randomUUID();
    const optedIn = `ann-optin-${suffix}@test.com`;
    const optedOut = `ann-optout-${suffix}@test.com`;
    await createTestUser(page, optedIn, "VOLUNTEER");
    await createTestUser(page, optedOut, "VOLUNTEER", {
      announcementOptOuts: ["PROMOTIONAL"],
    });

    try {
      const ids = [
        (await getUserByEmail(page, optedIn))!.id,
        (await getUserByEmail(page, optedOut))!.id,
      ];
      await loginAsAdmin(page);
      await gotoSettled(page, `/admin/announcements?userIds=${ids.join(",")}`);

      const count = page.getByTestId("announcement-recipient-count");
      const optedOutCount = page.getByTestId("announcement-opted-out-count");

      // Promotional: the opted-out volunteer drops out of the reach.
      await page.getByTestId("announcement-category-PROMOTIONAL").click();
      await expect(count).toHaveText("~1");
      await expect(optedOutCount).toHaveText(
        "1 more opted out of promotional announcements"
      );

      // Urgent is mandatory, so both volunteers are reached.
      await page.getByTestId("announcement-category-URGENT").click();
      await expect(count).toHaveText("~2");
      await expect(optedOutCount).toHaveCount(0);
    } finally {
      await deleteTestUsers(page, [optedIn, optedOut]);
    }
  });
});
