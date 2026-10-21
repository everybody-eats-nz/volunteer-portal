/**
 * Which URLs the website scraper (`scrape-url.ts`) may fetch: the public
 * everybodyeats.nz site, over http(s) on the default port.
 *
 * Kept free of server-only imports so the admin UI can run the same check
 * before calling the API.
 */

/** Hosts serving the public website (www redirects to the bare domain). */
const SCRAPE_HOSTS = ["everybodyeats.nz", "www.everybodyeats.nz"] as const;

/**
 * Returns the https URL to fetch for `url`, or `null` if it isn't allowed.
 *
 * The result is rebuilt from the matching constant in `SCRAPE_HOSTS` rather
 * than from the input, so only the path and query come from the caller and
 * the request can't be pointed at another host.
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

  const host = SCRAPE_HOSTS.find((h) => h === parsed.hostname.toLowerCase());
  if (!host) return null;

  return `https://${host}/${parsed.pathname.slice(1)}${parsed.search}`;
}

export function isAllowedScrapeUrl(url: string | URL): boolean {
  return toScrapeUrl(url) !== null;
}
