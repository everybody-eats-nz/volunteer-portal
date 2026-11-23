import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./base";
import { loginAsAdmin } from "./helpers/auth";
import {
  createShift,
  deleteTestShifts,
  visibleTestId,
} from "./helpers/test-helpers";
import { gotoSettled } from "./helpers/streaming";

/**
 * A day's report can be a service night, an events & catering day or a cafe
 * day. Any day can hold as many events and catering gigs as were run, each
 * itemising its income and expenses with a GST flag per line, and working
 * out its profit; cafe days record hours and takings, shown incl. and excl.
 * GST. None of it is koha: it stays out of koha analytics but still shows in
 * cash reconciliation and on the Events & Cafe page.
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

  /** Choose "Events & catering" for the day (not the Event activity kind). */
  async function chooseEventsDay(report: Locator) {
    await report
      .getByRole("radio", { name: "Events & catering", exact: true })
      .click();
    await expect(report).toHaveAttribute("data-report-type", "EVENT");
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

    await chooseEventsDay(report);
    await expect(visibleTestId(page, "day-report-title")).toHaveText(
      "Events & Catering Report"
    );

    await report.getByTestId("activity-add-event").click();
    const event = report.getByTestId("activity-0");
    await expect(event).toHaveAttribute("data-kind", "EVENT");
    await event.getByLabel("Name", { exact: true }).fill("Quiz night");
    await event.getByLabel("Guests (pax)").fill("50");

    // Line 1: ticket sales on EFTPOS, GST-inclusive by default.
    const income = event.getByTestId("event-income-editor");
    await income.getByTestId("event-income-add").click();
    await event.getByLabel("Description, income line 1").fill("Tickets");
    await event.getByLabel("Amount, income line 1").fill("2300");
    await expect(event.getByLabel("Income line 1 includes GST")).toBeChecked();

    // Line 2: cash koha at the door, no GST.
    await income.getByTestId("event-income-add").click();
    await event.getByLabel("Category, income line 2").click();
    await page.getByRole("option", { name: /^Koha/ }).click();
    await event.getByLabel("Paid by, income line 2").click();
    await page.getByRole("option", { name: "Cash" }).click();
    await expect(
      event.getByLabel("Income line 2 includes GST")
    ).not.toBeChecked();
    await event.getByLabel("Amount, income line 2").fill("150.50");

    // Line 3: a venue hire invoice, paid by invoice and GST-inclusive.
    await income.getByTestId("event-income-add").click();
    await event.getByLabel("Category, income line 3").click();
    await page.getByRole("option", { name: /^Invoice/ }).click();
    await expect(event.getByLabel("Paid by, income line 3")).toHaveText(
      "Invoice"
    );
    await expect(event.getByLabel("Income line 3 includes GST")).toBeChecked();
    await event.getByLabel("Description, income line 3").fill("Venue hire");
    await event.getByLabel("Amount, income line 3").fill("1150");

    await expect(event.getByTestId("event-income-total")).toHaveText(
      "$3,600.50"
    );
    await expect(event.getByTestId("event-income-gst")).toHaveText("$450.00");
    await expect(event.getByTestId("event-income-total-ex-gst")).toHaveText(
      "$3,150.50"
    );

    // Expenses: food with GST, then staff wages without.
    const expenses = event.getByTestId("event-expense-editor");
    await expenses.getByTestId("event-expense-add").click();
    await event.getByLabel("Description, expense line 1").fill("Catering");
    await event.getByLabel("Amount, expense line 1").fill("575");
    await expect(
      event.getByLabel("Expense line 1 includes GST")
    ).toBeChecked();
    await expenses.getByTestId("event-expense-add").click();
    await event.getByLabel("Category, expense line 2").click();
    await page.getByRole("option", { name: /^Staffing/ }).click();
    await expect(
      event.getByLabel("Expense line 2 includes GST")
    ).not.toBeChecked();
    await event.getByLabel("Amount, expense line 2").fill("400");

    await expect(event.getByTestId("event-expense-total")).toHaveText(
      "$975.00"
    );
    await expect(event.getByTestId("event-expense-gst")).toHaveText("$75.00");
    await expect(event.getByTestId("event-profit-total")).toHaveText(
      "$2,625.50"
    );
    await expect(event.getByTestId("event-profit-ex-gst")).toHaveText(
      "$2,250.50"
    );

    await report.getByTestId("day-report-save").click();
    await expect(page.getByText("Events & Catering Report saved")).toBeVisible();

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
    await expect(reloaded.getByTestId("event-hero-pax")).toHaveText("50");

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
    const row = visibleTestId(page, `events-row-${DATE}-0`);
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

  test("plans an event with estimates, then records the actuals", async ({
    page,
  }) => {
    const name = await setUpDay(page);
    const report = await openReport(page, name);
    await chooseEventsDay(report);
    await report.getByTestId("activity-add-event").click();
    const event = report.getByTestId("activity-0");
    await event.getByLabel("Name", { exact: true }).fill("Christmas fundraiser");

    const status = (line: string) =>
      report.getByRole("group", { name: `Actual or estimate, ${line}` });

    // Planning: ticket sales are a guess, and a new line follows the last
    // one's status.
    const income = event.getByTestId("event-income-editor");
    await income.getByTestId("event-income-add").click();
    await expect(
      status("income line 1").getByRole("radio", { name: "Actual" })
    ).toBeChecked();
    await status("income line 1").getByText("Estimate", { exact: true }).click();
    await event.getByLabel("Description, income line 1").fill("Tickets");
    await event.getByLabel("Amount, income line 1").fill("3000");
    await income.getByTestId("event-income-add").click();
    await expect(
      status("income line 2").getByRole("radio", { name: "Estimate" })
    ).toBeChecked();
    // A cash sponsorship that's already in hand is actual.
    await status("income line 2").getByText("Actual", { exact: true }).click();
    await event.getByLabel("Category, income line 2").click();
    await page.getByRole("option", { name: /^Donation/ }).click();
    await event.getByLabel("Paid by, income line 2").click();
    await page.getByRole("option", { name: "Cash" }).click();
    await event.getByLabel("Amount, income line 2").fill("200");

    const expenses = event.getByTestId("event-expense-editor");
    await expenses.getByTestId("event-expense-add").click();
    await status("expense line 1").getByText("Estimate", { exact: true }).click();
    await event.getByLabel("Amount, expense line 1").fill("800");

    // Estimates count in the totals, which say they include them.
    await expect(event.getByTestId("event-income-total")).toHaveText(
      "$3,200.00"
    );
    await expect(event.getByTestId("event-income-estimates")).toHaveText(
      "Includes 1 estimate"
    );
    await expect(event.getByTestId("event-expense-estimates")).toHaveText(
      "Includes 1 estimate"
    );
    await expect(event.getByTestId("event-profit-total")).toHaveText(
      "$2,400.00"
    );
    await expect(event.getByTestId("event-profit")).toContainText(
      "Estimated profit"
    );

    await report.getByTestId("day-report-save").click();
    await expect(page.getByText("Events & Catering Report saved")).toBeVisible();

    const reloaded = await openReport(page, name);
    await reloaded.getByRole("button", { name: "Edit" }).click();
    await expect(
      status("income line 1").getByRole("radio", { name: "Estimate" })
    ).toBeChecked();
    await expect(
      status("income line 2").getByRole("radio", { name: "Actual" })
    ).toBeChecked();
    await expect(reloaded.getByTestId("event-hero-profit")).toHaveText(
      "$2,400.00"
    );

    // The Events page mixes estimates into its totals and flags them.
    const eventsPage = `/admin/analytics/events?year=${FY}&location=${encodeURIComponent(name)}`;
    await gotoSettled(page, eventsPage);
    await expect(visibleTestId(page, "events-total")).toHaveText("$3,200.00");
    await expect(visibleTestId(page, "events-estimates")).toHaveText(
      "Includes estimates"
    );
    await expect(
      visibleTestId(page, `events-row-${DATE}-0-profit-estimate`)
    ).toBeVisible();

    // An estimate was never banked: only the actual cash is reconciled.
    await gotoSettled(
      page,
      `/admin/analytics/cash?location=${encodeURIComponent(name)}&from=${DATE}&to=${DATE}`
    );
    await expect(visibleTestId(page, "cash-total")).toHaveText("$200.00");

    // After the event: the real figures replace the estimates.
    const after = await openReport(page, name);
    await after.getByRole("button", { name: "Edit" }).click();
    await status("income line 1").getByText("Actual", { exact: true }).click();
    await after.getByLabel("Amount, income line 1").fill("3450");
    await status("expense line 1").getByText("Actual", { exact: true }).click();
    await expect(after.getByTestId("event-income-estimates")).toBeHidden();
    await expect(after.getByTestId("event-profit")).not.toContainText(
      "Estimated"
    );
    await after.getByTestId("day-report-save").click();
    await expect(page.getByText("Events & Catering Report saved")).toBeVisible();

    await gotoSettled(page, eventsPage);
    await expect(visibleTestId(page, "events-total")).toHaveText("$3,650.00");
    await expect(page.getByTestId("events-estimates")).toHaveCount(0);
    await expect(
      page.getByTestId(`events-row-${DATE}-0-profit-estimate`)
    ).toHaveCount(0);
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

  test("switching a day's type clears its figures but keeps its catering", async ({
    page,
  }) => {
    const name = await setUpDay(page);
    const save = (data: Record<string, unknown>) =>
      page.request.post("/api/admin/meals-served", {
        data: { date: DATE, location: name, ...data },
      });
    const load = async () =>
      (
        await page.request.get(
          `/api/admin/meals-served?date=${DATE}&location=${encodeURIComponent(name)}`
        )
      ).json();

    expect(
      (
        await save({
          reportType: "SERVICE_NIGHT",
          mealsServed: 60,
          cash: 80,
          activities: [
            {
              kind: "CATERING",
              name: "Gala lunch",
              income: [{ source: "CASH", category: "INVOICE", amount: 500 }],
              expenses: [{ category: "FOOD", amount: 80 }],
            },
          ],
        })
      ).ok()
    ).toBe(true);

    // The form warns that a save would clear the koha, and that the
    // catering stays.
    const report = await openReport(page, name);
    await chooseEventsDay(report);
    await expect(report.getByTestId("report-type-switch-note")).toContainText(
      "clears its koha and service stats. Its events and catering stay."
    );

    // A client that sends no activities leaves them alone.
    expect((await save({ reportType: "EVENT" })).ok()).toBe(true);
    expect(await load()).toMatchObject({
      reportType: "EVENT",
      cash: null,
      mealsServed: null,
      activities: [
        {
          kind: "CATERING",
          name: "Gala lunch",
          income: [{ amount: 500 }],
          expenses: [{ amount: 80 }],
        },
      ],
    });

    // An events day has nothing of its own to clear.
    const back = await openReport(page, name);
    await back.getByRole("radio", { name: "Service night" }).click();
    await expect(back.getByTestId("report-type-switch-note")).toHaveCount(0);

    expect((await save({ activities: [] })).ok()).toBe(true);
    expect((await load()).activities).toEqual([]);
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
    await report.getByTestId("activity-add-event").click();
    await report.getByTestId("activity-0").getByLabel("Name", { exact: true }).fill("Street party");
    await report.getByTestId("day-report-save").click();
    await expect(page.getByText("Events & Catering Report saved")).toBeVisible();

    // Once recorded, the report shows on the empty day without asking.
    const reloaded = await openReport(page, name);
    await expect(reloaded).toHaveAttribute("data-report-type", "EVENT");
    await reloaded.getByRole("button", { name: "Edit" }).click();
    await expect(
      reloaded.getByTestId("activity-0").getByLabel("Name", { exact: true })
    ).toHaveValue("Street party");
  });

  test("never offers a blank form when the day can't be loaded", async ({
    page,
  }) => {
    const name = await setUpDay(page);
    const reportApi = "**/api/admin/meals-served?*";
    await page.route(reportApi, (route) =>
      route.request().method() === "GET"
        ? route.fulfill({ status: 500, body: "{}" })
        : route.continue()
    );
    await gotoSettled(
      page,
      `/admin/shifts?date=${DATE}&location=${encodeURIComponent(name)}`
    );

    // No form to save over the day's recorded figures and activities...
    await expect(visibleTestId(page, "day-report-load-error")).toBeVisible();
    await expect(page.getByTestId("day-report")).toHaveCount(0);

    // ...until it loads.
    await page.unroute(reportApi);
    await visibleTestId(page, "day-report-load-error")
      .getByRole("button", { name: "Try again" })
      .click();
    await expect(visibleTestId(page, "day-report")).toBeVisible();
  });

  test("records several catering gigs and an event on one day", async ({
    page,
  }) => {
    const name = await setUpDay(page);
    const report = await openReport(page, name);
    await chooseEventsDay(report);

    // Each gig is invoiced; the event takes cash at the door.
    const add = async (
      kind: "catering" | "event",
      index: number,
      activityName: string,
      amount: string
    ) => {
      await report.getByTestId(`activity-add-${kind}`).click();
      const activity = report.getByTestId(`activity-${index}`);
      await activity.getByLabel("Name", { exact: true }).fill(activityName);
      await activity.getByTestId("event-income-add").click();
      if (kind === "catering") {
        await activity.getByLabel("Category, income line 1").click();
        await page.getByRole("option", { name: /^Invoice/ }).click();
      } else {
        await activity.getByLabel("Paid by, income line 1").click();
        await page.getByRole("option", { name: "Cash" }).click();
      }
      await activity.getByLabel("Amount, income line 1").fill(amount);
      return activity;
    };
    const first = await add("catering", 0, "Xero staff lunch", "1150");
    await first.getByLabel("People catered for").fill("40");
    await add("catering", 1, "Board breakfast", "460");
    const quiz = await add("event", 2, "Quiz night", "300");
    await quiz.getByLabel("Guests (pax)").fill("70");

    await expect(report.getByTestId("event-hero-total")).toHaveText("$1,910.00");
    await expect(report.getByTestId("event-hero-pax")).toHaveText("110");
    await report.getByTestId("day-report-save").click();
    await expect(page.getByText("Events & Catering Report saved")).toBeVisible();

    // The day's headcount is its activities' guests, so impact counts them.
    const day = await (
      await page.request.get(
        `/api/admin/meals-served?date=${DATE}&location=${encodeURIComponent(name)}`
      )
    ).json();
    expect(day.mealsServed).toBe(110);

    // A list of activities reloads as summaries, in the order entered.
    const reloaded = await openReport(page, name);
    await reloaded.getByRole("button", { name: "Edit" }).click();
    await expect(reloaded.getByTestId("activity-0-title")).toHaveText(
      "Xero staff lunch"
    );
    await expect(reloaded.getByTestId("activity-1-title")).toHaveText(
      "Board breakfast"
    );
    await expect(reloaded.getByTestId("activity-2")).toHaveAttribute(
      "data-kind",
      "EVENT"
    );
    await expect(
      reloaded.getByTestId("activity-0").getByLabel("Name", { exact: true })
    ).toHaveCount(0);

    // Each is its own row on the Events & Cafe page, filterable by kind.
    await gotoSettled(
      page,
      `/admin/analytics/events?year=${FY}&location=${encodeURIComponent(name)}`
    );
    await expect(visibleTestId(page, "events-total")).toHaveText("$1,910.00");
    await expect(visibleTestId(page, `events-row-${DATE}-0`)).toContainText(
      "Xero staff lunch"
    );
    await expect(visibleTestId(page, `events-row-${DATE}-2`)).toContainText(
      "Quiz night"
    );
    await visibleTestId(page, "events-kind-catering").click();
    await expect(page).toHaveURL(/kind=CATERING/);
    await expect(visibleTestId(page, "events-total")).toHaveText("$1,610.00");
    await expect(page.getByTestId(`events-row-${DATE}-2`)).toHaveCount(0);

    // Cash reconciliation names the day by what was run; invoices aren't
    // banked on the day.
    await gotoSettled(
      page,
      `/admin/analytics/cash?location=${encodeURIComponent(name)}&from=${DATE}&to=${DATE}`
    );
    await expect(visibleTestId(page, `cash-night-type-${DATE}`)).toHaveText(
      "2 catering gigs and an event"
    );
    await expect(visibleTestId(page, "cash-total")).toHaveText("$300.00");
  });

  test("adds a catering gig to a service night, kept out of koha", async ({
    page,
  }) => {
    const name = await setUpDay(page);
    const report = await openReport(page, name);
    await report.getByRole("button", { name: "Record stats" }).click();
    await report.getByLabel("Customers served").fill("50");
    await report.locator("#cash").fill("100");

    await report.getByTestId("activity-add-catering").click();
    const gig = report.getByTestId("activity-0");
    await gig.getByLabel("Name", { exact: true }).fill("Xero lunch");
    await gig.getByTestId("event-income-add").click();
    await gig.getByLabel("Paid by, income line 1").click();
    await page.getByRole("option", { name: "Cash" }).click();
    await gig.getByLabel("Amount, income line 1").fill("40");

    await expect(report.getByTestId("day-activities-summary")).toContainText(
      "Also a catering gig: $40.00 income"
    );
    await report.getByTestId("day-report-save").click();
    await expect(page.getByText("Service Night Report saved")).toBeVisible();

    const reloaded = await openReport(page, name);
    await expect(reloaded).toHaveAttribute("data-report-type", "SERVICE_NIGHT");
    await expect(reloaded.getByTestId("day-activities-summary")).toBeVisible();

    // The night's koha is only its own.
    const nights = await (
      await page.request.get(
        `/api/admin/analytics/service-nights?location=${encodeURIComponent(name)}&from=2016-03-01&to=2016-03-31`
      )
    ).json();
    expect(nights.total).toBe(1);

    // The bank deposit has both.
    await gotoSettled(
      page,
      `/admin/analytics/cash?location=${encodeURIComponent(name)}&from=${DATE}&to=${DATE}`
    );
    await expect(visibleTestId(page, `cash-night-type-${DATE}`)).toHaveText(
      "Service night + Catering · Xero lunch"
    );
    await expect(visibleTestId(page, "cash-total")).toHaveText("$140.00");
  });
});
