import { test, expect } from "./base";
import { loginAsAdmin } from "./helpers/auth";
import { gotoSettled } from "./helpers/streaming";

/**
 * Budget tracking: an admin enters an annual koha target and planned service
 * nights for one location and year, sees it scored, then removes it.
 *
 * Uses a fresh location and a far-future year so it never touches the budgets
 * or service nights other specs (or real data) rely on.
 */
const YEAR = 2099;

test.describe("Admin budget tracking", () => {
  let location: { id: string; name: string } | null = null;

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    const response = await page.request.post("/api/admin/locations", {
      data: {
        name: `Budget Test ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        address: "1 Budget Street, Wellington",
        defaultMealsServed: 60,
      },
    });
    expect(response.ok()).toBe(true);
    location = await response.json();
  });

  test.afterEach(async ({ page }) => {
    if (location) {
      await page.request.delete(
        `/api/admin/location-budgets?locationId=${location.id}&year=${YEAR}`
      );
      await page.request.delete(`/api/admin/locations/${location.id}`);
    }
  });

  test("admin sets, sees and removes a location's annual budget", async ({
    page,
  }) => {
    const name = location!.name;
    await gotoSettled(
      page,
      `/admin/analytics/budget?location=${encodeURIComponent(name)}&year=${YEAR}`
    );

    await page.getByTestId("budget-set-button").first().click();
    const dialog = page.getByTestId("budget-form-dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByTestId("budget-annual-input").fill("50000");
    await dialog.getByTestId("budget-nights-input").fill("200");
    await expect(dialog.getByTestId("budget-nightly-preview")).toHaveText(
      "$250.00"
    );
    await dialog.getByTestId("budget-save-button").click();
    await expect(dialog).toBeHidden();

    const scoreboard = page.getByTestId("budget-scoreboard").first();
    await expect(scoreboard).toBeVisible();
    await expect(scoreboard).toContainText("$50,000 budget");
    await expect(scoreboard).toContainText("0 of 200 planned nights held");
    // No nights yet: every planned night needs the plain nightly target.
    await expect(
      page.getByTestId("budget-figure-needed").first()
    ).toContainText("$250");

    // The budget is listed on the all-restaurants view too.
    await gotoSettled(page, `/admin/analytics/budget?location=all&year=${YEAR}`);
    await expect(page.getByTestId(`budget-card-${name}`).first()).toContainText(
      "0/200"
    );

    // Remove it again.
    await page.getByTestId(`budget-card-edit-${name}`).first().click();
    await page.getByTestId("budget-remove-button").click();
    await page.getByRole("button", { name: "Remove budget" }).click();
    await expect(
      page.getByTestId(`budget-card-set-${name}`).first()
    ).toBeVisible();
  });

  test("rejects a budget without planned service nights", async ({ page }) => {
    const response = await page.request.put("/api/admin/location-budgets", {
      data: {
        locationId: location!.id,
        year: YEAR,
        annualTarget: 50000,
        plannedServiceNights: 0,
      },
    });
    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBe("Plan at least one service night");
  });
});
