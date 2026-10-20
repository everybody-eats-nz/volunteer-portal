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
 * A day's report can be a service night, an event (fundraiser) or a cafe day.
 * Events itemise their income and expenses with a GST flag per line, and
 * work out the profit; cafe days record hours and takings, shown incl. and
 * excl. GST. Neither is koha: both stay out of koha analytics but still show
 * in cash reconciliation and on the Events & Cafe page.
 *
 * Each test uses a fresh location and a day long before any real data
 * (financial year 2015/16), and deletes its reports afterwards.
 */
const DATE = "2016-03-15";
const FY = "2016"; // 1 Apr 2015 - 31 Mar 2016

test.describe("Day report types", () => {
  let location: { id: string; name: string } | null = null;
  let shiftIds: string[] = [];

  async function setUpDay(page: Page, { withShift = true } = {}) {
    const response = await page.request.post("/api/admin/locations", {
      data: {
        name: `Report Type Test ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        address: "1 Report Street, Wellington",
        defaultMealsServed: 60,
      },
    });
    expect(response.ok()).toBe(true);
    location = await response.json();

    if (withShift) {
      const shift = await createShift(page, {
        location: location!.name,
        start: new Date("2016-03-15T05:30:00Z"), // 5:30pm NZ
        capacity: 4,
      });
      shiftIds.push(shift.id);
    }
    return location!.name;
  }

  async function openReport(page: Page, name: string) {
    await gotoSettled(
      page,
      `/admin/shifts?date=${DATE}&location=${encodeURIComponent(name)}`
    );
    const report = visibleTestId(page, "day-report");
    await expect(report).toBeVisible();
    return report;
  }

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test.afterEach(async ({ page }) => {
    await deleteTestShifts(page, shiftIds);
    shiftIds = [];
    if (location) {
      await page.request.delete(
        `/api/test/day-reports?location=${encodeURIComponent(location.name)}`
      );
      await page.request.delete(`/api/admin/locations/${location.id}`);
      location = null;
    }
  });

  test("records a fundraiser's itemised income, kept out of koha", async ({
    page,
  }) => {
    const name = await setUpDay(page);
    const report = await openReport(page, name);

    await report.getByRole("radio", { name: "Event" }).click();
    await expect(report).toHaveAttribute("data-report-type", "EVENT");
    await expect(visibleTestId(page, "day-report-title")).toHaveText(
      "Event Report"
    );

    await report.getByLabel("Event name").fill("Quiz night");
    await report.getByLabel("Guests (pax)").fill("50");

    // Line 1: ticket sales on EFTPOS, GST-inclusive by default.
    const income = report.getByTestId("event-income-editor");
    await income.getByTestId("event-income-add").click();
    await report.getByLabel("Description, income line 1").fill("Tickets");
    await report.getByLabel("Amount, income line 1").fill("2300");
    await expect(report.getByLabel("Income line 1 includes GST")).toBeChecked();

    // Line 2: cash koha at the door, no GST.
    await income.getByTestId("event-income-add").click();
    await report.getByLabel("Category, income line 2").click();
    await page.getByRole("option", { name: /^Koha/ }).click();
    await report.getByLabel("Paid by, income line 2").click();
    await page.getByRole("option", { name: "Cash" }).click();
    await expect(
      report.getByLabel("Income line 2 includes GST")
    ).not.toBeChecked();
    await report.getByLabel("Amount, income line 2").fill("150.50");

    // Line 3: a venue hire invoice, paid by invoice and GST-inclusive.
    await income.getByTestId("event-income-add").click();
    await report.getByLabel("Category, income line 3").click();
    await page.getByRole("option", { name: /^Invoice/ }).click();
    await expect(report.getByLabel("Paid by, income line 3")).toHaveText(
      "Invoice"
    );
    await expect(report.getByLabel("Income line 3 includes GST")).toBeChecked();
    await report.getByLabel("Description, income line 3").fill("Venue hire");
    await report.getByLabel("Amount, income line 3").fill("1150");

    await expect(report.getByTestId("event-income-total")).toHaveText(
      "$3,600.50"
    );
    await expect(report.getByTestId("event-income-gst")).toHaveText("$450.00");
    await expect(report.getByTestId("event-income-total-ex-gst")).toHaveText(
      "$3,150.50"
    );

    // Expenses: food with GST, then staff wages without.
    const expenses = report.getByTestId("event-expense-editor");
    await expenses.getByTestId("event-expense-add").click();
    await report.getByLabel("Description, expense line 1").fill("Catering");
    await report.getByLabel("Amount, expense line 1").fill("575");
    await expect(
      report.getByLabel("Expense line 1 includes GST")
    ).toBeChecked();
    await expenses.getByTestId("event-expense-add").click();
    await report.getByLabel("Category, expense line 2").click();
    await page.getByRole("option", { name: /^Staffing/ }).click();
    await expect(
      report.getByLabel("Expense line 2 includes GST")
    ).not.toBeChecked();
    await report.getByLabel("Amount, expense line 2").fill("400");

    await expect(report.getByTestId("event-expense-total")).toHaveText(
      "$975.00"
    );
    await expect(report.getByTestId("event-expense-gst")).toHaveText("$75.00");
    await expect(report.getByTestId("event-profit-total")).toHaveText(
      "$2,625.50"
    );
    await expect(report.getByTestId("event-profit-ex-gst")).toHaveText(
      "$2,250.50"
    );

    await report.getByTestId("day-report-save").click();
    await expect(page.getByText("Event Report saved")).toBeVisible();

    // Survives a reload.
    const reloaded = await openReport(page, name);
    await expect(reloaded).toHaveAttribute("data-report-type", "EVENT");
    await expect(reloaded.getByTestId("event-hero-total")).toHaveText(
      "$3,600.50"
    );
    await expect(reloaded.getByTestId("event-hero-expenses")).toHaveText(
      "$975.00"
    );
    await expect(reloaded.getByTestId("event-hero-profit")).toHaveText(
      "$2,625.50"
    );

    // Not koha: absent from service-night analytics...
    const nights = await page.request.get(
      `/api/admin/analytics/service-nights?location=${encodeURIComponent(name)}&from=2016-03-01&to=2016-03-31`
    );
    expect((await nights.json()).total).toBe(0);

    // ...but on the Events & Cafe page...
    await gotoSettled(
      page,
      `/admin/analytics/events?year=${FY}&location=${encodeURIComponent(name)}`
    );
    await expect(visibleTestId(page, "events-total")).toHaveText("$3,600.50");
    await expect(visibleTestId(page, "events-expenses")).toHaveText("$975.00");
    await expect(visibleTestId(page, "events-profit")).toHaveText("$2,625.50");
    await expect(visibleTestId(page, "events-profit-ex-gst")).toHaveText(
      "$2,250.50"
    );
    await expect(
      visibleTestId(page, "events-expense-breakdown")
    ).toContainText("Staffing");
    const row = visibleTestId(page, `events-row-${DATE}`);
    await expect(row).toContainText("Quiz night");
    await expect(row).toContainText("$2,625.50");

    // ...and its cash in cash reconciliation, labelled as an event.
    await gotoSettled(
      page,
      `/admin/analytics/cash?location=${encodeURIComponent(name)}&from=${DATE}&to=${DATE}`
    );
    await expect(visibleTestId(page, `cash-night-type-${DATE}`)).toHaveText(
      "Event · Quiz night"
    );
    await expect(visibleTestId(page, "cash-total")).toHaveText("$150.50");
  });

  test("records a cafe day's hours and takings", async ({ page }) => {
    const name = await setUpDay(page);
    const report = await openReport(page, name);

    await report.getByRole("radio", { name: "Cafe" }).click();
    await report.getByLabel("Opened").fill("07:30");
    await report.getByLabel("Closed").fill("14:00");
    await report.getByLabel("Customers served").fill("40");
    await report.getByLabel("Cash").fill("100");
    await report.getByLabel("EFTPOS").fill("300");

    await expect(report.getByTestId("cafe-hero-total")).toHaveText("$400.00");
    // Takings include GST: $400 holds $52.17 of it.
    await expect(report.getByTestId("cafe-hero-ex-gst")).toHaveText("$347.83");
    await expect(report.getByTestId("cafe-gst")).toHaveText("$52.17");
    await expect(report.getByTestId("cafe-total-ex-gst")).toHaveText(
      "$347.83"
    );
    await report.getByTestId("day-report-save").click();
    await expect(page.getByText("Cafe Report saved")).toBeVisible();

    const nights = await page.request.get(
      `/api/admin/analytics/service-nights?location=${encodeURIComponent(name)}&from=2016-03-01&to=2016-03-31`
    );
    expect((await nights.json()).total).toBe(0);

    await gotoSettled(
      page,
      `/admin/analytics/events?year=${FY}&location=${encodeURIComponent(name)}&view=cafe`
    );
    await expect(visibleTestId(page, "cafe-total")).toHaveText("$400.00");
    await expect(visibleTestId(page, "cafe-total-ex-gst")).toHaveText(
      "$347.83 excl. GST"
    );
    const cafeRow = visibleTestId(page, `cafe-row-${DATE}`);
    await expect(cafeRow).toContainText("7:30am to 2pm");
    await expect(cafeRow).toContainText("$347.83 excl. GST");
  });

  test("switching a day's type clears the other report's figures", async ({
    page,
  }) => {
    const name = await setUpDay(page);
    const save = (data: Record<string, unknown>) =>
      page.request.post("/api/admin/meals-served", {
        data: { date: DATE, location: name, ...data },
      });

    expect(
      (
        await save({
          reportType: "EVENT",
          eventName: "Gala",
          income: [{ source: "CASH", category: "DONATION", amount: 500 }],
          expenses: [{ category: "DECOR", amount: 80 }],
        })
      ).ok()
    ).toBe(true);

    // The form warns before a save would clear the event's income.
    const report = await openReport(page, name);
    await report.getByRole("radio", { name: "Service night" }).click();
    await expect(report.getByTestId("report-type-switch-note")).toContainText(
      "clears its event name, income and expenses"
    );

    expect((await save({ reportType: "SERVICE_NIGHT", cash: 80 })).ok()).toBe(
      true
    );
    const day = await (
      await page.request.get(
        `/api/admin/meals-served?date=${DATE}&location=${encodeURIComponent(name)}`
      )
    ).json();
    expect(day).toMatchObject({
      reportType: "SERVICE_NIGHT",
      eventName: null,
      income: [],
      expenses: [],
      cash: 80,
    });
  });

  test("never carries cafe takings into a service night's koha", async ({
    page,
  }) => {
    const name = await setUpDay(page);
    const saved = await page.request.post("/api/admin/meals-served", {
      data: {
        date: DATE,
        location: name,
        reportType: "CAFE",
        cash: 50,
        eftpos: 70,
      },
    });
    expect(saved.ok()).toBe(true);

    const report = await openReport(page, name);
    await report.getByRole("button", { name: "Edit" }).click();
    await expect(report.getByLabel("Cash")).toHaveValue("50");

    // Service night starts with blank koha rather than the cafe's takings...
    await report.getByRole("radio", { name: "Service night" }).click();
    await expect(report.locator("#cash")).toHaveValue("");
    await expect(report.locator("#eftpos")).toHaveValue("");

    // ...and switching back brings the cafe's figures back.
    await report.getByRole("radio", { name: "Cafe" }).click();
    await expect(report.getByLabel("Cash")).toHaveValue("50");
    await expect(report.getByLabel("EFTPOS")).toHaveValue("70");
  });

  test("records an event on a day with no shifts", async ({ page }) => {
    const name = await setUpDay(page, { withShift: false });
    await gotoSettled(
      page,
      `/admin/shifts?date=${DATE}&location=${encodeURIComponent(name)}`
    );

    // No report card on an empty day until it's asked for.
    await expect(visibleTestId(page, "day-report")).toHaveCount(0);
    await visibleTestId(page, "day-report-start").click();

    const report = visibleTestId(page, "day-report");
    await expect(report).toHaveAttribute("data-report-type", "EVENT");
    await report.getByLabel("Event name").fill("Street party");
    await report.getByTestId("day-report-save").click();
    await expect(page.getByText("Event Report saved")).toBeVisible();

    // Once recorded, the report shows on the empty day without asking.
    const reloaded = await openReport(page, name);
    await expect(reloaded).toHaveAttribute("data-report-type", "EVENT");
    await reloaded.getByRole("button", { name: "Edit" }).click();
    await expect(reloaded.getByLabel("Event name")).toHaveValue("Street party");
  });
});
