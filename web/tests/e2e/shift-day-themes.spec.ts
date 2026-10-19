import type { Page } from "@playwright/test";
import { test, expect } from "./base";
import { loginAsAdmin, loginAsVolunteer } from "./helpers/auth";
import { createShift, deleteTestShifts } from "./helpers/test-helpers";
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
    monthLabel: format(start, "MMMM yyyy"),
    start: new Date(start.getTime()),
  };
}

async function setDayTheme(page: Page, dayKey: string, theme: string) {
  const response = await page.request.put("/api/admin/shift-day-themes", {
    data: { date: dayKey, location: LOCATION, theme },
  });
  expect(response.ok()).toBeTruthy();
}

/** Step the volunteer calendar forward until it shows the given month. */
async function showCalendarMonth(page: Page, monthLabel: string) {
  const heading = page.getByRole("heading", { level: 2, name: monthLabel });
  for (let i = 0; i < 3 && !(await heading.isVisible()); i++) {
    await page.getByTestId("calendar-next-month").click();
  }
  await expect(heading).toBeVisible();
}

test.describe("Shift day themes", () => {
  const testId = randomUUID().slice(0, 8);
  const theme = `Pasta Night ${testId}`;
  // Tests in a file run in parallel, so each works on its own day.
  const themedDays: string[] = [];
  const shiftIds: string[] = [];

  /** Log in as admin and put a shift on the day, so the calendar links it. */
  async function setUpDay(page: Page, daysAhead: number) {
    const day = upcomingServiceDay(daysAhead);
    themedDays.push(day.dayKey);
    await loginAsAdmin(page);
    const shift = await createShift(page, {
      location: LOCATION,
      start: day.start,
      capacity: 4,
    });
    shiftIds.push(shift.id);
    return day;
  }

  test.afterEach(async ({ page }) => {
    await loginAsAdmin(page);
    for (const dayKey of themedDays.splice(0)) {
      await setDayTheme(page, dayKey, "");
    }
    await deleteTestShifts(page, shiftIds.splice(0));
  });

  test("admin sets a theme that volunteers see beside the date", async ({
    page,
  }) => {
    const { dayKey, monthLabel } = await setUpDay(page, 9);
    await gotoSettled(
      page,
      `/admin/shifts?date=${dayKey}&location=${LOCATION}`
    );

    const input = page.getByTestId("shift-day-theme-input");
    await expect(input).toHaveValue("");
    await input.fill(`  ${theme}  `);
    await page.getByTestId("shift-day-theme-save").click();
    await expect(page.getByText("Day theme saved")).toBeVisible();
    await expect(input).toHaveValue(theme);
    await expect(page.getByTestId("shift-day-theme-remove")).toBeVisible();

    await loginAsVolunteer(page);

    // Desktop calendar: the theme sits beside the date number
    await gotoSettled(page, `/shifts?location=${LOCATION}`);
    await showCalendarMonth(page, monthLabel);
    await expect(
      page.getByTestId(`calendar-day-theme-${dayKey}`)
    ).toHaveText(theme);

    // The day's shift list repeats it beside the heading
    await gotoSettled(page, `/shifts/details?date=${dayKey}&location=${LOCATION}`);
    await expect(page.getByTestId("shifts-details-day-theme")).toHaveText(
      theme
    );

    // Phones: the cell only highlights the date, the theme is listed below
    await page.setViewportSize({ width: 375, height: 812 });
    await gotoSettled(page, `/shifts?location=${LOCATION}`);
    await showCalendarMonth(page, monthLabel);
    await expect(
      page.getByTestId(`calendar-day-theme-${dayKey}`)
    ).toBeHidden();
    await expect(page.getByTestId("calendar-day-theme-list")).toContainText(
      theme
    );
  });

  test("admin removes a theme", async ({ page }) => {
    const { dayKey } = await setUpDay(page, 11);
    await setDayTheme(page, dayKey, theme);

    await gotoSettled(
      page,
      `/admin/shifts?date=${dayKey}&location=${LOCATION}`
    );
    const input = page.getByTestId("shift-day-theme-input");
    await expect(input).toHaveValue(theme);

    await page.getByTestId("shift-day-theme-remove").click();
    await expect(page.getByText("Day theme removed")).toBeVisible();
    await expect(input).toHaveValue("");
    await expect(page.getByTestId("shift-day-theme-remove")).toBeHidden();

    await gotoSettled(page, `/shifts/details?date=${dayKey}&location=${LOCATION}`);
    await expect(page.getByTestId("shifts-details-page-header")).toBeVisible();
    await expect(page.getByTestId("shifts-details-day-theme")).toHaveCount(0);
  });
});
