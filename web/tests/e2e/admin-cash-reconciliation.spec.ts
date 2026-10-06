import { test, expect } from "./base";
import { loginAsAdmin } from "./helpers/auth";
import {
  createShift,
  deleteTestShifts,
  visibleTestId,
} from "./helpers/test-helpers";

test.describe("Admin Cash Reconciliation", () => {
  test("defaults to the last 14 days and switches presets", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/analytics/cash");

    await expect(visibleTestId(page, "cash-reconciliation-page")).toBeVisible();
    await expect(visibleTestId(page, "cash-total")).toHaveText(/^\$[\d,]+\.\d{2}$/);
    await expect(visibleTestId(page, "cash-nights-table")).toBeVisible();
    await expect(page.getByRole("tab", { name: "Last 14 days" })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    await page.getByRole("tab", { name: "Last week" }).click();
    await expect(page).toHaveURL(/[?&]range=last-week/);
    await expect(page.getByRole("tab", { name: "Last week" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  test("flags a night where shifts ran but nothing was recorded", async ({
    page,
  }) => {
    await loginAsAdmin(page);

    // A night long before any recorded service data, so no record exists.
    const shift = await createShift(page, {
      location: "Wellington",
      start: new Date("2016-03-15T05:30:00Z"), // 5:30pm NZ
      capacity: 4,
    });

    try {
      await page.goto(
        "/admin/analytics/cash?location=Wellington&from=2016-03-14&to=2016-03-20"
      );

      const row = visibleTestId(page, "cash-night-2016-03-15");
      await expect(row).toHaveAttribute("data-status", "no-record");
      await expect(row).toContainText("Night not recorded");
      await expect(visibleTestId(page, "cash-flag-callout")).toContainText(
        "1 night with no cash recorded"
      );
      await expect(visibleTestId(page, "cash-flagged-count")).toHaveText("1");
      await expect(visibleTestId(page, "cash-total")).toHaveText("$0.00");

      // The flag links to where the night's takings are entered.
      await expect(row.getByRole("link")).toHaveAttribute(
        "href",
        "/admin/shifts?date=2016-03-15&location=Wellington"
      );
    } finally {
      await deleteTestShifts(page, [shift.id]);
    }
  });
});
