import { describe, expect, it } from "vitest";

import { isAllowedScrapeUrl } from "./scrape-allowlist";

describe("isAllowedScrapeUrl", () => {
  it.each([
    "https://everybodyeats.nz",
    "https://everybodyeats.nz/menu",
    "http://everybodyeats.nz/menu",
    "https://www.everybodyeats.nz/about?x=1",
    "https://EverybodyEats.NZ/menu",
    "https://everybodyeats.nz:443/menu",
  ])("allows %s", (url) => {
    expect(isAllowedScrapeUrl(url)).toBe(true);
  });

  it.each([
    "not a url",
    "",
    "https://example.com",
    "https://noteverybodyeats.nz",
    "https://everybodyeats.nz.evil.com",
    "https://everybodyeats.nz@evil.com",
    "https://everybodyeats.nz:8080/",
    "http://localhost:3000",
    "http://169.254.169.254/latest/meta-data/",
    "ftp://everybodyeats.nz/file",
    "file:///etc/passwd",
    "javascript:alert(1)",
  ])("rejects %s", (url) => {
    expect(isAllowedScrapeUrl(url)).toBe(false);
  });

  it("accepts URL objects", () => {
    expect(isAllowedScrapeUrl(new URL("https://everybodyeats.nz/menu"))).toBe(true);
    expect(isAllowedScrapeUrl(new URL("https://example.com"))).toBe(false);
  });
});
