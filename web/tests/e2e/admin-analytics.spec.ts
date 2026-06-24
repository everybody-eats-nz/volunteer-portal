import { test, expect } from "./base";
import { loginAsAdmin } from "./helpers/auth";

test.describe("Admin Restaurant Analytics", () => {
  test("loads, renders KPIs and charts, and switches across all tabs", async ({
    page,
  }) => {
    // Capture client-side errors so a broken chart fails the test loudly.
    // Scoped to the dashboard itself — unrelated app-wide endpoints (e.g.
    // notifications, profile photo) can 500 in a bare dev env and aren't our
    // concern here.
    const chartErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      const text = msg.text();
      if (/Chart failed to render|apexcharts|chart-theme|analytics/i.test(text)) {
        chartErrors.push(text);
      }
    });

    await loginAsAdmin(page);

    await page.goto("/admin/analytics");
    await expect(
      page.getByTestId("restaurant-analytics-page")
    ).toBeVisible();

    // KPI hero is present.
    await expect(page.getByText("Guests served").first()).toBeVisible();
    await expect(page.getByText("Total koha").first()).toBeVisible();

    // YTD is the default period.
    await expect(page.getByRole("tab", { name: "YTD" })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    // Overview renders charts (ApexCharts mounts client-side).
    await expect(page.getByText("Guests Trend")).toBeVisible();
    await expect(page.locator(".apexcharts-canvas").first()).toBeVisible({
      timeout: 15000,
    });

    // Each tab renders its signature content without crashing.
    await page.getByTestId("analytics-tab-donations").click();
    await expect(page.getByText("Metric Trends")).toBeVisible();
    await expect(page.getByText("Summary by Location")).toBeVisible();

    await page.getByTestId("analytics-tab-service").click();
    await expect(page.getByText("Protein Mix")).toBeVisible();
    await expect(page.getByText("Service Nights")).toBeVisible();

    await page.getByTestId("analytics-tab-history").click();
    await expect(
      page.getByText("Donations & Customers — By Year")
    ).toBeVisible();

    // Active tab is reflected in the URL (shareable / refresh-safe).
    await expect(page).toHaveURL(/[?&]tab=history/);

    await page.getByTestId("analytics-tab-overview").click();
    await expect(page.getByText("Koha by Method")).toBeVisible();

    // No chart hit its error boundary, and no chart-level console errors.
    await expect(
      page.getByText(/Couldn.t render this section/)
    ).toHaveCount(0);
    expect(chartErrors).toEqual([]);
  });

  test("switching period preset updates the dashboard", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/analytics");
    await expect(
      page.getByTestId("restaurant-analytics-page")
    ).toBeVisible();

    // Pick a different preset and apply; the URL reflects the applied filter.
    await page.getByRole("tab", { name: "3M" }).click();
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page).toHaveURL(/[?&]months=3/);
    await expect(
      page.getByTestId("restaurant-analytics-page")
    ).toBeVisible();
  });
});
