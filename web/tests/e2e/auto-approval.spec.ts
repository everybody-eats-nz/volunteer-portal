import { test, expect } from "./base";
import { loginAsAdmin, loginAsVolunteer } from "./helpers/auth";
import { createShift, deleteTestShifts } from "./helpers/test-helpers";
import { gotoSettled } from "./helpers/streaming";

test.describe("Auto-approval admin", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await gotoSettled(page, "/admin/auto-approval");
  });

  test("lands on the overview with the four surfaces available", async ({
    page,
  }) => {
    await expect(page.getByTestId("admin-page-header")).toContainText(
      "Auto-Approval"
    );

    const tabs = page.getByTestId("auto-approval-tabs");
    await expect(tabs.getByTestId("tab-overview")).toBeVisible();
    await expect(tabs.getByTestId("tab-coverage")).toBeVisible();
    await expect(tabs.getByTestId("tab-decisions")).toBeVisible();
    await expect(tabs.getByTestId("tab-rules")).toBeVisible();

    // Headline numbers render even with no history.
    await expect(page.getByTestId("stat-approved")).toBeVisible();
    await expect(page.getByTestId("stat-held")).toBeVisible();
  });

  test("shows rules grouped by evaluation order", async ({ page }) => {
    await page.getByTestId("tab-rules").click();

    await expect(page.getByTestId("rule-group-blocks")).toBeVisible();
    await expect(page.getByTestId("rule-group-approvals")).toBeVisible();

    // Blocks are described as running first - that ordering is the engine.
    await expect(
      page.getByText("Blocks are checked first", { exact: false })
    ).toBeVisible();
  });

  test("explains rule conditions in plain English", async ({ page }) => {
    await page.getByTestId("tab-rules").click();

    const firstRule = page.getByTestId("rule-card").first();
    await expect(firstRule).toBeVisible();
    await expect(
      firstRule.getByText(/Approves anyone|Holds anyone/)
    ).toBeVisible();
  });

  test("opens the rule editor with a live coverage preview", async ({
    page,
  }) => {
    await page.getByTestId("tab-rules").click();
    await page.getByTestId("new-rule").click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByTestId("rule-name-input")).toBeVisible();
    await expect(dialog.getByText("Who this catches")).toBeVisible();

    // A rule with no conditions can't be saved - it would match nobody.
    await dialog.getByTestId("rule-name-input").fill("Playwright test rule");
    await expect(dialog.getByTestId("save-rule")).toBeDisabled();
    await expect(
      dialog.getByText("Set at least one condition", { exact: false })
    ).toBeVisible();
  });

  test("previews who the live rules would approve", async ({ page }) => {
    await page.getByTestId("tab-coverage").click();

    await page.getByTestId("run-coverage").click();

    await expect(page.getByTestId("coverage-approved-count")).toBeVisible({
      timeout: 20000,
    });
    await expect(page.getByTestId("coverage-volunteers")).toBeVisible();
  });

  test("filters the decision log by outcome", async ({ page }) => {
    await page.getByTestId("tab-decisions").click();

    await expect(page.getByTestId("decisions-search")).toBeVisible();

    // Outcome chips are filters and tallies at once.
    const approvedChip = page.getByRole("button", { name: /^Approved/ });
    await expect(approvedChip).toBeVisible();
    await approvedChip.click();
    await expect(approvedChip).toHaveAttribute("aria-pressed", "true");
  });

  test("previews one rule on its own in a dialog", async ({ page }) => {
    await page.getByTestId("tab-rules").click();

    const previewButton = page
      .getByRole("button", { name: /^Preview who / })
      .first();
    await expect(previewButton).toBeVisible();
    await previewButton.click();

    const dialog = page.getByTestId("rule-preview-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId("coverage-approved-count")).toBeVisible({
      timeout: 20000,
    });
    await expect(
      dialog.getByText("The Coverage tab shows what happens", { exact: false })
    ).toBeVisible();
  });

  test("redirects the old auto-accept-rules URL", async ({ page }) => {
    await gotoSettled(page, "/admin/auto-accept-rules");
    await expect(page).toHaveURL(/\/admin\/auto-approval/);
  });
});

/**
 * The decision log only has rows once somebody has actually signed up, so this
 * block creates the decision it then goes looking for rather than relying on
 * whatever the seed happens to contain.
 */
test.describe("Auto-approval decision log", () => {
  // Three logins plus shift/user setup - well past the default 15s budget
  // once this runs alongside the other specs.
  test.describe.configure({ timeout: 60_000 });


  const createdShiftIds: string[] = [];
  // Unique per run so parallel shards don't fight over the same volunteer.
  const volunteerEmail = `auto-approval-decision-${Date.now()}@example.com`;

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await loginAsAdmin(page);
    await deleteTestShifts(page, createdShiftIds);
    await page.request.delete(
      `/api/test/users?email=${encodeURIComponent(volunteerEmail)}`
    );
    await page.close();
  });

  test("records a decision and explains it with a per-condition receipt", async ({
    page,
  }) => {
    await loginAsAdmin(page);

    // Take whatever shift type and location this environment has rather than
    // naming one - seed data differs between local and CI.
    const optionsResponse = await page.request.get(
      "/api/admin/auto-approval/options"
    );
    expect(optionsResponse.ok()).toBeTruthy();
    const options = await optionsResponse.json();
    const shiftType = options.shiftTypes[0];
    expect(shiftType, "at least one shift type must exist").toBeTruthy();

    // The shared quick-login volunteer has an incomplete profile, which the
    // signup route rejects. Make one that can actually sign up.
    const createUser = await page.request.post("/api/test/users", {
      data: {
        email: volunteerEmail,
        password: "Test123456",
        role: "VOLUNTEER",
        firstName: "Decision",
        lastName: "Log",
      },
    });
    expect(createUser.ok()).toBeTruthy();

    const start = new Date();
    start.setDate(start.getDate() + 2);
    start.setHours(10, 0, 0, 0);

    const shift = await createShift(page, {
      location: options.locations[0] ?? "Wellington",
      start,
      capacity: 5,
      shiftTypeId: shiftType.id,
      notes: "Auto-approval decision log test",
    });
    createdShiftIds.push(shift.id);

    // Signing up is what writes the decision.
    await loginAsVolunteer(page, volunteerEmail);
    const signup = await page.request.post(`/api/shifts/${shift.id}/signup`, {
      data: {},
    });
    expect(signup.ok(), await signup.text()).toBeTruthy();

    await loginAsAdmin(page);
    await gotoSettled(page, "/admin/auto-approval");
    await page.getByTestId("tab-decisions").click();

    const list = page.getByTestId("decisions-list");
    await expect(list).toBeVisible({ timeout: 20000 });

    await list.locator("li > button").first().click();

    // The receipt is the answer to "why?" - every rule considered, and for
    // each one what it asked for versus what was actually true.
    const receipt = page.getByTestId("decision-receipt");
    await expect(receipt).toBeVisible();
    await expect(
      receipt.getByText(/met · needs (all|any)/).first()
    ).toBeVisible();
  });
});
