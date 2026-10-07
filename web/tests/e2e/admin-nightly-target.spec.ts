import type { Page } from "@playwright/test";
import { test, expect } from "./base";
import { loginAsAdmin } from "./helpers/auth";
import {
  createShift,
  deleteTestShifts,
  visibleTestId,
} from "./helpers/test-helpers";
import { gotoSettled } from "./helpers/streaming";

/**
 * The Service Night Report on the shifts page opens with tonight's koha
 * against the nightly target, coloured red / yellow / green as koha is typed.
 *
 * Each test uses a fresh location and a night long before any real service
 * data (budget year 2016), so no budget or service-night record exists. Koha
 * is typed but never saved.
 */
const DATE = "2016-03-15";
const BUDGET_YEAR = 2016; // 1 Apr 2015 - 31 Mar 2016

test.describe("Service Night Report nightly target", () => {
  let location: { id: string; name: string } | null = null;
  let shiftIds: string[] = [];

  async function setUpNight(page: Page, targetPerNight: number | null) {
    const response = await page.request.post("/api/admin/locations", {
      data: {
        name: `Target Test ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        address: "1 Target Street, Wellington",
        defaultMealsServed: 60,
        targetPerNight,
      },
    });
    expect(response.ok()).toBe(true);
    location = await response.json();

    const shift = await createShift(page, {
      location: location!.name,
      start: new Date("2016-03-15T05:30:00Z"), // 5:30pm NZ
      capacity: 4,
    });
    shiftIds.push(shift.id);
    return location!.name;
  }

  async function openReport(page: Page, name: string) {
    await gotoSettled(
      page,
      `/admin/shifts?date=${DATE}&location=${encodeURIComponent(name)}`
    );
    const strip = visibleTestId(page, "nightly-target");
    await expect(strip).toBeVisible();
    return strip;
  }

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test.afterEach(async ({ page }) => {
    await deleteTestShifts(page, shiftIds);
    shiftIds = [];
    if (location) {
      await page.request.delete(
        `/api/admin/location-budgets?locationId=${location.id}&year=${BUDGET_YEAR}`
      );
      await page.request.delete(`/api/admin/locations/${location.id}`);
      location = null;
    }
  });

  test("colours koha against the venue's standing target as it's typed", async ({
    page,
  }) => {
    const name = await setUpNight(page, 1000);
    const strip = await openReport(page, name);

    await expect(strip).toHaveAttribute("data-status", "pending");
    await expect(strip).toContainText("$1,000");
    await expect(strip).toContainText("Not banked");
    await expect(strip).toContainText(`Standing target for ${name}`);

    await page.getByRole("button", { name: "Record stats" }).first().click();

    await page.locator("#cash").fill("500");
    await expect(strip).toHaveAttribute("data-status", "red");
    await expect(strip.getByTestId("nightly-target-percent")).toHaveText("50%");
    await expect(strip).toContainText("Below target");
    await expect(strip).toContainText("$500 to go");

    await page.locator("#eftpos").fill("450");
    await expect(strip).toHaveAttribute("data-status", "yellow");
    await expect(strip.getByTestId("nightly-target-percent")).toHaveText("95%");
    await expect(strip).toContainText("Close to target");

    await page.locator("#stripe").fill("100");
    await expect(strip).toHaveAttribute("data-status", "green");
    await expect(strip.getByTestId("nightly-target-percent")).toHaveText("105%");
    await expect(strip).toContainText("On target");
    await expect(strip).toContainText("$50 over");
  });

  test("uses the budget's nightly share when the year has a budget", async ({
    page,
  }) => {
    const name = await setUpNight(page, 1000);
    const budget = await page.request.put("/api/admin/location-budgets", {
      data: {
        locationId: location!.id,
        year: BUDGET_YEAR,
        annualTarget: 50000,
        plannedServiceNights: 200,
      },
    });
    expect(budget.ok()).toBe(true);

    const strip = await openReport(page, name);
    await expect(strip).toContainText("$250");
    await expect(strip).toContainText("Nightly share of the 2015/16 budget");
    await expect(
      strip.getByRole("link", { name: "Budget tracking" })
    ).toHaveAttribute(
      "href",
      `/admin/analytics/budget?${new URLSearchParams({ location: name, year: String(BUDGET_YEAR) })}`
    );
  });

  test("prompts for a budget when the venue has no target", async ({
    page,
  }) => {
    const name = await setUpNight(page, null);
    const strip = await openReport(page, name);

    await expect(strip).toContainText("No koha target set for this night.");
    await expect(strip.getByRole("link", { name: "Set a budget" })).toBeVisible();
  });
});
