import type { Page } from "@playwright/test";
import { test, expect } from "./base";
import { loginAsAdmin, loginAsVolunteer } from "./helpers/auth";
import {
  clickUntilVisible,
  createShift,
  deleteTestShifts,
} from "./helpers/test-helpers";
import { gotoSettled } from "./helpers/streaming";
import { randomUUID } from "crypto";
import { addDays, format } from "date-fns";
import { TZDate } from "@date-fns/tz";

const NZ_TIMEZONE = "Pacific/Auckland";
const LOCATION = "Wellington";

/** A service day a little ahead, as its NZ "yyyy-MM-dd" key and a 5:30pm start. */
function upcomingServiceDay(daysAhead: number) {
  const day = addDays(TZDate.tz(NZ_TIMEZONE), daysAhead);
  const start = new TZDate(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    17,
    30,
    NZ_TIMEZONE
  );
  return {
    dayKey: format(start, "yyyy-MM-dd"),
    dayOfWeek: start.getDay(),
    weekday: format(start, "EEEE"),
    monthLabel: format(start, "MMMM yyyy"),
    start: new Date(start.getTime()),
  };
}

/** Step the volunteer calendar forward until it shows the given month. */
async function showCalendarMonth(page: Page, monthLabel: string) {
  const heading = page.getByRole("heading", { level: 2, name: monthLabel });
  for (let i = 0; i < 3 && !(await heading.isVisible()); i++) {
    await page.getByTestId("calendar-next-month").click();
  }
  await expect(heading).toBeVisible();
}

// The standard roster is per location, so this file's tests share it and run
// one at a time.
test.describe.configure({ mode: "serial" });

test.describe("Chef and FOH Manager on the shift calendar", () => {
  const testId = randomUUID().slice(0, 6);
  const standardChef = `Sam ${testId}`;
  const standardFoh = `Alex ${testId}`;
  const coverChef = `Kiri ${testId}`;
  const shiftIds: string[] = [];
  const overrideDays: string[] = [];

  test.afterEach(async ({ page }) => {
    await loginAsAdmin(page);
    for (const date of overrideDays.splice(0)) {
      await page.request.put("/api/admin/day-leads", {
        data: { date, location: LOCATION, chef: "", fohManager: "" },
      });
    }
    await page.request.put("/api/admin/day-leads/roster", {
      data: { location: LOCATION, days: [] },
    });
    await deleteTestShifts(page, shiftIds.splice(0));
  });

  test("the standard roster fills each week, and a swap changes one day", async ({
    page,
  }) => {
    const day = upcomingServiceDay(9);
    const nextWeek = upcomingServiceDay(16);
    overrideDays.push(day.dayKey);

    await loginAsAdmin(page);
    for (const { start } of [day, nextWeek]) {
      const shift = await createShift(page, {
        location: LOCATION,
        start,
        capacity: 4,
      });
      shiftIds.push(shift.id);
    }

    await gotoSettled(
      page,
      `/admin/shifts?date=${day.dayKey}&location=${LOCATION}`
    );
    const summary = page.getByTestId("day-leads-summary");
    await expect(summary).toContainText("No chef or FOH manager listed");

    // Set the standard roster for this weekday
    const dialog = page.getByTestId("day-leads-roster-dialog");
    await clickUntilVisible(page.getByTestId("day-leads-roster-button"), dialog);
    await dialog
      .getByTestId(`day-leads-roster-${day.dayOfWeek}-chef`)
      .fill(standardChef);
    await dialog
      .getByTestId(`day-leads-roster-${day.dayOfWeek}-fohManager`)
      .fill(standardFoh);
    await dialog.getByTestId("day-leads-roster-save").click();
    await expect(
      page.getByText(`Standard roster saved for ${LOCATION}`)
    ).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId("day-leads-summary-chef")).toHaveText(
      standardChef
    );
    await expect(page.getByTestId("day-leads-summary-fohManager")).toHaveText(
      standardFoh
    );
    await expect(page.getByTestId("day-leads-changed-badge")).toBeHidden();

    // Someone covers the chef on this one day
    const chefInput = page.getByTestId("day-leads-chef-input");
    await clickUntilVisible(page.getByTestId("day-leads-edit"), chefInput);
    await expect(chefInput).toHaveValue("");
    await expect(chefInput).toHaveAttribute("placeholder", standardChef);
    await chefInput.fill(coverChef);
    await page.getByTestId("day-leads-save").click();
    await expect(
      page.getByText("Chef and FOH manager saved for this day")
    ).toBeVisible();
    await expect(page.getByTestId("day-leads-summary-chef")).toHaveText(
      coverChef
    );
    await expect(page.getByTestId("day-leads-summary-fohManager")).toHaveText(
      standardFoh
    );
    await expect(page.getByTestId("day-leads-changed-badge")).toBeVisible();

    await loginAsVolunteer(page);

    // Desktop calendar: first names under the day's availability
    await gotoSettled(page, `/shifts?location=${LOCATION}`);
    await showCalendarMonth(page, day.monthLabel);
    const cellLeads = page.getByTestId(`calendar-day-leads-${day.dayKey}`);
    await expect(cellLeads).toContainText(coverChef);
    await expect(cellLeads).toContainText(standardFoh);
    await expect(page.getByTestId("calendar-day-leads-key")).toBeVisible();

    // The day's page, and the next week's, which keeps the standard roster
    await gotoSettled(
      page,
      `/shifts/details?date=${day.dayKey}&location=${LOCATION}`
    );
    const dayStrip = page.getByTestId("shifts-day-leads-wellington");
    await expect(dayStrip).toContainText(`Chef${coverChef}`);
    await expect(dayStrip).toContainText(`FOH Manager${standardFoh}`);

    await gotoSettled(
      page,
      `/shifts/details?date=${nextWeek.dayKey}&location=${LOCATION}`
    );
    await expect(page.getByTestId("shifts-day-leads-wellington")).toContainText(
      `Chef${standardChef}`
    );

    // The shift's own page
    await gotoSettled(page, `/shifts/${shiftIds[0]}`);
    await expect(page.getByTestId("shift-day-leads")).toContainText(coverChef);
  });

  test("an admin puts a changed day back on the standard roster", async ({
    page,
  }) => {
    const day = upcomingServiceDay(10);
    overrideDays.push(day.dayKey);

    await loginAsAdmin(page);
    const shift = await createShift(page, {
      location: LOCATION,
      start: day.start,
      capacity: 4,
    });
    shiftIds.push(shift.id);
    await page.request.put("/api/admin/day-leads/roster", {
      data: {
        location: LOCATION,
        days: [
          {
            dayOfWeek: day.dayOfWeek,
            chef: standardChef,
            fohManager: standardFoh,
          },
        ],
      },
    });
    await page.request.put("/api/admin/day-leads", {
      data: {
        date: day.dayKey,
        location: LOCATION,
        chef: coverChef,
        fohManager: "",
      },
    });

    await gotoSettled(
      page,
      `/admin/shifts?date=${day.dayKey}&location=${LOCATION}`
    );
    await expect(page.getByTestId("day-leads-summary-chef")).toHaveText(
      coverChef
    );
    const reset = page.getByTestId("day-leads-reset");
    await clickUntilVisible(page.getByTestId("day-leads-edit"), reset);
    await reset.click();
    await expect(
      page.getByText(
        `Back to the standard ${day.weekday} roster`
      )
    ).toBeVisible();
    await expect(page.getByTestId("day-leads-summary-chef")).toHaveText(
      standardChef
    );
    await expect(page.getByTestId("day-leads-changed-badge")).toBeHidden();
  });
});
