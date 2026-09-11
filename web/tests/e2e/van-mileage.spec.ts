import { test, expect } from "./base";
import type { Page } from "@playwright/test";
import { loginAsAdmin, loginAsVolunteer } from "./helpers/auth";
import { gotoSettled, waitForStreamSettled } from "./helpers/streaming";

/**
 * The van mileage log's two critical paths: starting a trip and ending one.
 *
 * These run serially against a van created for this spec alone. The database
 * enforces one open trip per van, so sharing the seeded fleet with other specs
 * (or with a previous failed run) would make the results depend on order.
 */
// Each of these walks a whole multi-screen flow, sign-in included, so they need
// more than the suite's default per-test budget.
test.describe.configure({ mode: "serial", timeout: 60_000 });

const REGO = `E2E${Date.now().toString().slice(-4)}`;
const VAN_NAME = `E2E Test Van ${REGO}`;

/** The van's /v/[id] URL, resolved once the van exists. */
let vanUrl: string;
/** The van's id, for retiring it once the spec is done. */
let vanId: string;

async function createTestVan(page: Page) {
  await loginAsAdmin(page);
  await gotoSettled(page, "/admin/van/vehicles");

  await page.getByTestId("van-vehicle-add").first().click();
  await page.getByTestId("van-vehicle-name").fill(VAN_NAME);
  await page.getByTestId("van-vehicle-rego").fill(REGO);
  await page.getByTestId("van-vehicle-city").fill("Wellington");
  await page.getByTestId("van-vehicle-save").click();

  await expect(page.getByText(VAN_NAME).first()).toBeVisible({ timeout: 15000 });
}

/** Walk the driver from the van's status page to an open trip. */
async function startTrip(page: Page, reading: string) {
  await page.getByTestId("odometer-type-instead").first().click();
  await page.getByTestId("odometer-reading-input").first().fill(reading);
  await page.getByTestId("odometer-confirm").first().click();

  // Selecting the purpose *is* the submit: there is no separate confirm.
  await expect(page.getByText("Who is this trip for?").first()).toBeVisible();
  await page.getByText("Everybody Eats", { exact: true }).first().click();
  await expect(page.getByText("What is the van doing?").first()).toBeVisible();
  await page.getByText("Food Rescue", { exact: true }).first().click();

  await page.waitForURL(/\/drive\/trip\/[^/]+\?started=1/, { timeout: 15000 });
}

/*
 * This hook signs in twice, creates a van and navigates twice, so it needs
 * well over the config's default budget. That default is 15s locally against
 * 30s in CI (`playwright.config.ts`), and a file-level beforeAll takes the
 * global one — `test.describe.configure({ timeout })` does not reach it. Run
 * this spec locally with `--timeout=60000`, or it fails here with a hook
 * timeout that surfaces as `waitForURL: Test ended` on the first test and
 * reads like a routing regression.
 */
test.beforeAll(async ({ browser }) => {
  test.setTimeout(60_000);
  const page = await browser.newPage();
  await createTestVan(page);

  // Resolve the van's public URL from the picker rather than hardcoding an id.
  await loginAsVolunteer(page);
  await gotoSettled(page, "/drive/vans");
  await page.getByText(VAN_NAME).first().click();
  await page.waitForURL(/\/v\/[^/?]+/, { timeout: 15000 });
  vanUrl = new URL(page.url()).pathname;
  vanId = vanUrl.split("/").pop()!;

  await page.close();
});

test.afterAll(async ({ browser }) => {
  // Retire the van this spec created. Vehicles are long-lived reference data
  // shown to every driver, so a suite that leaves one behind on each run
  // slowly fills the fleet picker with test vans.
  if (!vanId) return;
  const page = await browser.newPage();
  try {
    await loginAsAdmin(page);
    await page.request.patch("/api/admin/van/vehicles", {
      data: { id: vanId, isActive: false },
    });
  } finally {
    await page.close();
  }
});

test.describe("van mileage log - the QR sticker's page", () => {
  test("shows the van to somebody who is not signed in, without a login form", async ({
    page,
  }) => {
    // The sticker is the first thing a new driver ever sees. Auth is required
    // by the action, not by the page.
    await page.context().clearCookies();
    await gotoSettled(page, vanUrl);

    await expect(page.getByTestId("van-name").first()).toHaveText(VAN_NAME);
    await expect(page.getByText(REGO).first()).toBeVisible();
    await expect(page.getByTestId("van-sign-in-to-start").first()).toBeVisible();
    // Not a form.
    await expect(page.getByLabel("Password")).toHaveCount(0);
  });

  test("sends a signed-out driver to sign in and back to this van", async ({
    page,
  }) => {
    await page.context().clearCookies();
    await gotoSettled(page, vanUrl);
    await page.getByTestId("van-sign-in-to-start").first().click();

    await page.waitForURL(/\/login\?/, { timeout: 15000 });
    const url = new URL(page.url());
    // Asks for the passkey prompt rather than presenting a form first, and
    // comes back into the flow the driver tapped.
    expect(url.searchParams.get("passkey")).toBe("1");
    expect(url.searchParams.get("callbackUrl")).toBe(`${vanUrl}?start=1`);
  });
});

test.describe("van mileage log - starting a trip", () => {
  test("an approved driver starts a trip and the van reads as out", async ({
    page,
  }) => {
    await loginAsVolunteer(page);
    await gotoSettled(page, vanUrl);

    await expect(page.getByText("Available").first()).toBeVisible();
    await page.getByTestId("van-start-trip").first().click();

    await startTrip(page, "100000");

    await expect(page.getByTestId("van-trip-open").first()).toBeVisible();
    await expect(page.getByText("On the road").first()).toBeVisible();
    await expect(page.getByText("100,000 km").first()).toBeVisible();

    // The van now reads as out on its own page.
    await gotoSettled(page, vanUrl);
    await expect(page.getByText("Out now").first()).toBeVisible();
  });

  test("refuses an end reading below the start reading", async ({ page }) => {
    // The single hard stop: it cannot be what the dial says, and the driver is
    // looking at both numbers.
    await loginAsVolunteer(page);
    await gotoSettled(page, vanUrl);
    await page.getByTestId("van-end-open-trip").first().click();
    await waitForStreamSettled(page);

    await page.getByTestId("odometer-type-instead").first().click();
    await page.getByTestId("odometer-reading-input").first().fill("99000");

    await expect(
      page.getByText(/Has to be more than 100,000/).first()
    ).toBeVisible();
    await expect(page.getByTestId("odometer-confirm").first()).toBeDisabled();
  });

  test("warns about an implausible reading but still records it", async ({
    page,
  }) => {
    await loginAsVolunteer(page);
    await gotoSettled(page, vanUrl);
    await page.getByTestId("van-end-open-trip").first().click();
    await waitForStreamSettled(page);

    await page.getByTestId("odometer-type-instead").first().click();
    // 512 km in the minutes since the trip opened.
    await page.getByTestId("odometer-reading-input").first().fill("100512");
    await page.getByTestId("odometer-confirm").first().click();

    const warning = page.getByTestId("van-implausible-warning");
    await expect(warning).toBeVisible({ timeout: 10000 });
    await expect(warning).toContainText("512 km");
    await expect(warning).toContainText("It does not stop you");

    // Warn, never block.
    await page.getByTestId("van-warning-confirm").click();
    await expect(page.getByTestId("van-trip-logged")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText("512 km").first()).toBeVisible();
  });
});

test.describe("van mileage log - ending a trip", () => {
  test("records the distance and returns the van to the fleet", async ({
    page,
  }) => {
    await loginAsVolunteer(page);
    await gotoSettled(page, vanUrl);
    await page.getByTestId("van-start-trip").first().click();
    await startTrip(page, "100512");

    await page.getByTestId("van-end-trip").first().click();
    await waitForStreamSettled(page);

    await page.getByTestId("odometer-type-instead").first().click();
    await page.getByTestId("odometer-reading-input").first().fill("100545");
    // The driver sees the distance before committing to it.
    await expect(
      page.getByTestId("odometer-distance-preview").first()
    ).toContainText("33 km");
    await page.getByTestId("odometer-confirm").first().click();

    await expect(page.getByTestId("van-trip-logged")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText("33 km").first()).toBeVisible();

    await gotoSettled(page, vanUrl);
    await expect(page.getByText("Available").first()).toBeVisible();
  });

  test("the trip shows up in the driver's own history", async ({ page }) => {
    await loginAsVolunteer(page);
    await gotoSettled(page, "/drive");

    await expect(page.getByTestId("van-driver-home").first()).toBeVisible();
    await expect(page.getByText("33 km").first()).toBeVisible();
  });
});

test.describe("van mileage log - the office", () => {
  test("shows the trips and lets an admin open the odometer photos", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await gotoSettled(page, "/admin/van/trips");

    await expect(page.getByTestId("van-trips-page").first()).toBeVisible();
    await expect(page.getByTestId("van-trips-summary").first()).toContainText(
      "km"
    );
    // A cell, not any text: the van's name is also an <option> in the filter.
    await expect(
      page.getByRole("cell", { name: VAN_NAME, exact: true }).first()
    ).toBeVisible();

    // The photo viewer is the whole reason photos are kept: the recorded
    // number has to be checkable against the picture.
    await page
      .getByRole("row", { name: new RegExp(VAN_NAME) })
      .first()
      .getByTestId(/^van-trip-photos-/)
      .click();
    const viewer = page.getByTestId("van-photo-viewer");
    await expect(viewer).toBeVisible();
    await expect(viewer).toContainText("recorded as");
  });

  test("narrows the ledger by period and says what is filtered", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await gotoSettled(page, "/admin/van/trips");

    // The screen exists to produce a month for the funder, so it opens on one.
    const month = page.getByTestId("van-trips-month").first();
    await expect(month).toBeVisible();
    const opened = await month.inputValue();

    // Stepping back a month is the primary navigation, and it only steps as
    // far as the record goes — so only assert it when there is a month to
    // step to.
    const previous = page.getByTestId("van-trips-month-previous").first();
    if (await previous.isEnabled()) {
      await previous.click();
      await expect
        .poll(() => month.inputValue())
        .not.toBe(opened);
    }

    await page.getByTestId("van-trips-period-all").first().click();
    await expect(page.getByTestId("van-trips-summary").first()).toContainText(
      "km"
    );

    // A filter that leaves no trace is how the totals above get misread as the
    // month's, so every active one is restated as a chip you can drop.
    await expect(page.getByTestId("van-trips-active-filters")).toHaveCount(0);
    await page
      .getByTestId("van-trips-filter-vehicle")
      .first()
      .selectOption({ label: VAN_NAME });

    const chips = page.getByTestId("van-trips-active-filters").first();
    await expect(chips).toBeVisible();
    await expect(chips).toContainText(VAN_NAME);
    await expect(
      page.getByRole("cell", { name: VAN_NAME, exact: true }).first()
    ).toBeVisible();

    await chips.getByRole("button", { name: "Clear all" }).click();
    await expect(page.getByTestId("van-trips-active-filters")).toHaveCount(0);
  });

  test("opens a trip from the keyboard alone", async ({ page }) => {
    await loginAsAdmin(page);
    await gotoSettled(page, "/admin/van/trips");

    // The row carries a click for the mouse, but the keyboard path is a real
    // focusable control inside it rather than a tabbable <tr>: putting
    // role="button" on the row would take it out of the table's accessibility
    // tree, so a screen reader would lose the columns it belongs to.
    const opener = page.getByTestId(/^van-trip-photos-/).first();
    await expect(opener).toHaveAttribute("aria-label", /^Open the .+ trip at /);
    await opener.focus();
    await page.keyboard.press("Enter");

    const viewer = page.getByTestId("van-photo-viewer");
    await expect(viewer).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(viewer).toBeHidden();

    // The rows are still rows, which is what the row-scoped queries above rely
    // on and what a screen reader reads the ledger with.
    expect(await page.getByRole("row").count()).toBeGreaterThan(1);
  });

  test("derives the implausible trip as an exception", async ({ page }) => {
    await loginAsAdmin(page);
    await gotoSettled(page, "/admin/van/exceptions");

    await expect(page.getByTestId("van-exceptions-page").first()).toBeVisible();
    // Nothing was stored to say this trip is wrong: the list recomputes it.
    await expect(
      page.getByTestId("van-exception-group-implausible-distance").first()
    ).toBeVisible();
  });

  test("only approved drivers can take a van out", async ({ page }) => {
    await loginAsAdmin(page);
    await gotoSettled(page, "/admin/van/drivers");

    await expect(page.getByTestId("van-drivers-page").first()).toBeVisible();
    await expect(page.getByTestId("van-drivers-approved").first()).toContainText(
      "Approved to drive"
    );
  });

  test("the office can add a driver without waiting for them to register", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await gotoSettled(page, "/admin/van/drivers");

    await page.getByTestId("van-driver-add").first().click();
    await expect(
      page.getByTestId("van-driver-add-person").first()
    ).toBeVisible();
    // The organisation list comes from the same rule the driver's own form
    // reads, so a seeded organisation has to be on offer here too.
    await expect(page.getByTestId("van-driver-add-org").first()).toContainText(
      "Everybody Eats"
    );

    // Nothing is written: this asserts the dialog says what picking somebody
    // will do, rather than approving a seeded driver and leaving the next run
    // looking at different data.
    await page.getByTestId("van-driver-add-person").first().click();
    await page
      .getByPlaceholder("Search by name or email...")
      .fill("volunteer@example.com");
    // The option inside the popover, not the driver card of the same name on
    // the page behind the dialog.
    const option = page
      .locator('[data-testid^="user-search-option-"]')
      .first();
    await option.waitFor({ timeout: 15000 });
    await option.click();
    await expect(
      page.getByTestId("van-driver-add-existing").first()
    ).toContainText("Already approved to drive");
  });
});
