import type { Browser, Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { test, expect } from "./base";
import { loginAsAdmin, loginAsVolunteer } from "./helpers/auth";
import { gotoSettled } from "./helpers/streaming";
import {
  createShift,
  createSignup,
  createTestUser,
  deleteSignupsByShiftIds,
  deleteTestShifts,
  deleteTestUsers,
  getUserByEmail,
} from "./helpers/test-helpers";

/**
 * Year in mahi: the admin switch, the volunteer page and dashboard banner,
 * and an admin previewing someone's video. The switch is site-wide, so the
 * file runs serially and puts the original settings back afterwards.
 * (The MP4 is rendered on the server with the Remotion bundle and Chrome that
 * only the production image carries, so rendering itself isn't run here.)
 */
test.describe.configure({ mode: "serial" });

type Settings = { enabled: boolean; year: number };

test.describe("Year in mahi", () => {
  const runId = randomUUID().slice(0, 8);
  const volunteerEmail = `year-in-review-${runId}@example.com`;
  const shiftIds: string[] = [];

  // A finished shift three hours ago, so the volunteer has a video this year.
  const shiftStart = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const year = Number(
    new Intl.DateTimeFormat("en-NZ", {
      timeZone: "Pacific/Auckland",
      year: "numeric",
    }).format(shiftStart)
  );
  let originalSettings: Settings | null = null;

  async function saveSettings(page: Page, settings: Settings) {
    const response = await page.request.put("/api/admin/year-in-review", {
      data: settings,
    });
    expect(response.ok()).toBe(true);
  }

  async function asAdmin<T>(
    browser: Browser,
    run: (page: Page) => Promise<T>
  ): Promise<T> {
    const page = await browser.newPage();
    try {
      await loginAsAdmin(page);
      return await run(page);
    } finally {
      await page.close();
    }
  }

  test.beforeAll(async ({ browser }) => {
    await asAdmin(browser, async (page) => {
      // Remember what the switch was set to, from the admin page's controls.
      await gotoSettled(page, "/admin/year-in-review");
      originalSettings = {
        enabled:
          (await page
            .getByTestId("year-in-review-enabled-switch")
            .getAttribute("aria-checked")) === "true",
        year: Number(
          await page.getByTestId("year-in-review-year-select").textContent()
        ),
      };

      await createTestUser(page, volunteerEmail, "VOLUNTEER", {
        firstName: "Aroha",
        lastName: `Mahi ${runId}`,
      });
      const volunteer = await getUserByEmail(page, volunteerEmail);
      if (!volunteer) throw new Error("Test volunteer not created");

      const shift = await createShift(page, {
        location: "Wellington",
        start: shiftStart,
        end: new Date(shiftStart.getTime() + 3 * 60 * 60 * 1000),
        capacity: 6,
      });
      shiftIds.push(shift.id);
      await createSignup(page, {
        userId: volunteer.id,
        shiftId: shift.id,
        status: "CONFIRMED",
      });
    });
  });

  test.afterAll(async ({ browser }) => {
    await asAdmin(browser, async (page) => {
      if (originalSettings) await saveSettings(page, originalSettings);
      await deleteSignupsByShiftIds(page, shiftIds);
      await deleteTestShifts(page, shiftIds);
      await deleteTestUsers(page, [volunteerEmail]);
    });
  });

  test("volunteers can't see it until it's switched on", async ({ page }) => {
    await loginAsAdmin(page);
    await saveSettings(page, { enabled: false, year });

    await loginAsVolunteer(page, volunteerEmail);
    await expect(
      page.getByTestId("dashboard-year-in-review-banner")
    ).toHaveCount(0);

    await gotoSettled(page, "/year-in-review");
    await expect(page.getByTestId("year-in-review-empty")).toContainText(
      "Not quite ready"
    );
    await expect(page.getByTestId("year-in-review-player")).toHaveCount(0);
  });

  test("an admin switches it on and the volunteer gets their video", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await saveSettings(page, { enabled: false, year });
    await gotoSettled(page, "/admin/year-in-review");

    const toggle = page.getByTestId("year-in-review-enabled-switch");
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await toggle.click();
    await expect(page.getByText("Year in mahi is on for everyone")).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-checked", "true");

    await loginAsVolunteer(page, volunteerEmail);
    const banner = page.getByTestId("dashboard-year-in-review-banner");
    await expect(banner).toContainText(`Your ${year} in mahi is ready`);
    // Followed by URL rather than a click: a fresh volunteer's first-shift
    // achievement celebration can open over the dashboard at any moment.
    await expect(banner).toHaveAttribute("href", "/year-in-review");

    await gotoSettled(page, "/year-in-review");
    await expect(page.getByTestId("year-in-review-heading")).toContainText(
      String(year)
    );
    await expect(page.getByTestId("year-in-review-player")).toBeVisible();
    await expect(
      page.getByTestId("year-in-review-export-button")
    ).toBeVisible();
  });

  test("an admin can watch anyone's video", async ({ page }) => {
    await loginAsAdmin(page);
    await saveSettings(page, { enabled: false, year });
    await gotoSettled(page, "/admin/year-in-review");

    await page.getByTestId("year-in-review-person-search").fill(volunteerEmail);
    await page.getByRole("option", { name: new RegExp(volunteerEmail) }).click();

    const preview = page.getByTestId("year-in-review-preview");
    await expect(preview.getByTestId("year-in-review-player")).toBeVisible();
    await expect(preview).toContainText(`Aroha Mahi ${runId}'s ${year}`);
  });

  test("the mobile endpoint needs the app's token", async ({ request }) => {
    const response = await request.get("/api/mobile/year-in-review");
    expect(response.status()).toBe(401);
  });

  // Only checks access: asking for a video starts a server render, which
  // needs the Remotion bundle and Chrome that only the production image has.
  test("volunteers can only get their own video", async ({
    page,
    request,
  }) => {
    expect((await request.get("/api/year-in-review/video")).status()).toBe(
      401
    );

    await loginAsAdmin(page);
    await saveSettings(page, { enabled: true, year });

    await loginAsVolunteer(page, volunteerEmail);
    const own = await page.request.get("/api/year-in-review/video");
    expect(own.status()).toBe(200);
    expect(await own.json()).toMatchObject({ status: "NONE", fileUrl: null });

    for (const path of ["video", "video/file"]) {
      const someoneElse = await page.request.get(
        `/api/year-in-review/${path}?userId=someone-else`
      );
      expect(someoneElse.status()).toBe(403);
    }
  });
});
