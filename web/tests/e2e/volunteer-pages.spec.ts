import { test, expect } from "./base";

// Public, unauthenticated SEO landing pages: /volunteer and /volunteer/[city].
test.describe("Volunteer landing pages", () => {
  test("index lists each city with working links", async ({ page }) => {
    await page.goto("/volunteer");
    await page.waitForLoadState("load");

    await expect(page).toHaveURL("/volunteer");
    await expect(page.getByTestId("volunteer-index-page")).toBeVisible();

    const wellington = page.getByTestId("volunteer-city-wellington");
    const auckland = page.getByTestId("volunteer-city-auckland");
    await expect(wellington).toBeVisible();
    await expect(auckland).toBeVisible();
    await expect(wellington).toHaveAttribute("href", "/volunteer/wellington");
    await expect(auckland).toHaveAttribute("href", "/volunteer/auckland");
  });

  test("city page renders hero, metadata and shifts-or-roles", async ({
    page,
  }) => {
    await page.goto("/volunteer/wellington");
    await page.waitForLoadState("load");

    await expect(page.getByTestId("volunteer-location-page")).toBeVisible();
    await expect(page.getByTestId("volunteer-hero-title")).toContainText(
      "Wellington"
    );
    await expect(page).toHaveTitle(/Volunteer in Wellington/);
    await expect(page.getByTestId("volunteer-cta-register")).toBeVisible();

    // The "Find your role" section renders either real shift cards or the
    // static role fallback — both are acceptable depending on DB state.
    await expect(page.getByTestId("volunteer-roles")).toBeVisible();
    const shiftCards = page.getByTestId("volunteer-shift-card");
    if ((await shiftCards.count()) > 0) {
      await expect(shiftCards.first()).toBeVisible();
    }
  });

  test("auckland page targets the city in its title", async ({ page }) => {
    await page.goto("/volunteer/auckland");
    await page.waitForLoadState("load");

    await expect(page.getByTestId("volunteer-hero-title")).toContainText(
      "Auckland"
    );
    await expect(page).toHaveTitle(/Volunteer in Auckland/);
  });

  test("unknown city slug does not render a city page", async ({ page }) => {
    await page.goto("/volunteer/christchurch");
    await page.waitForLoadState("load");

    // notFound() short-circuits before the city page renders, and the route's
    // metadata marks unknown slugs noindex so they can't be indexed.
    await expect(page.getByTestId("volunteer-location-page")).toHaveCount(0);
    await expect(page.getByTestId("volunteer-hero-title")).toHaveCount(0);
  });
});
