import { test, expect } from "./base";
import { loginAsAdmin } from "./helpers/auth";

test.describe("Auto-approval admin", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/auto-approval");
    await page.waitForLoadState("load");
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

  test("explains a decision with a per-condition receipt", async ({ page }) => {
    await page.getByTestId("tab-decisions").click();

    const list = page.getByTestId("decisions-list");
    await expect(list).toBeVisible();

    const firstRow = list.locator("li > button").first();
    await firstRow.click();

    // The receipt is the answer to "why?" - every rule considered, and for
    // each one what it asked for versus what was true.
    const receipt = page.getByTestId("decision-receipt");
    await expect(receipt).toBeVisible();
    await expect(receipt.getByText(/met · needs (all|any)/).first()).toBeVisible();
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
    await page.goto("/admin/auto-accept-rules");
    await page.waitForLoadState("load");
    await expect(page).toHaveURL(/\/admin\/auto-approval/);
  });
});
