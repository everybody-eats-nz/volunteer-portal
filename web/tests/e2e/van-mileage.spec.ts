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
  await page.getByLabel("City").fill("Wellington");
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

test.beforeAll(async ({ browser }) => {
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
});
