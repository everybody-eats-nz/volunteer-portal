/**
 * Which URLs the website scraper (`scrape-url.ts`) may fetch: the public
 * everybodyeats.nz site, over http(s) on the default port.
 *
 * Kept free of server-only imports so the admin UI can run the same check
 * before calling the API.
 */

/**
 * Returns the https URL to fetch for `url`, or `null` if it isn't allowed.
 * Allowed hosts are the ones serving the public website (www redirects to
 * the bare domain).
 *
 * The result starts with a literal origin per host rather than anything
 * taken from the input, so only the path and query come from the caller and
 * the request can't be pointed at another host. Keep each origin and its
 * trailing slash in one literal - that's what lets CodeQL's request-forgery
 * check see the host is fixed.
 */
export function toScrapeUrl(url: string | URL): string | null {
  let parsed: URL;
  try {
    parsed = typeof url === "string" ? new URL(url) : url;
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  // An explicit port could reach a non-web service on an allowed host
  if (parsed.port !== "") return null;

  const pathAndQuery = `${parsed.pathname.slice(1)}${parsed.search}`;
  switch (parsed.hostname.toLowerCase()) {
    case "everybodyeats.nz":
      return `https://everybodyeats.nz/${pathAndQuery}`;
    case "www.everybodyeats.nz":
      return `https://www.everybodyeats.nz/${pathAndQuery}`;
    default:
      return null;
  }
}

export function isAllowedScrapeUrl(url: string | URL): boolean {
  return toScrapeUrl(url) !== null;
}
