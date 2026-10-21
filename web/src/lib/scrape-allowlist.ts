/**
 * Which URLs the website scraper (`scrape-url.ts`) may fetch: plain
 * http(s) on the default port, on everybodyeats.nz or one of its subdomains.
 *
 * Kept free of server-only imports so the admin UI can run the same check
 * before calling the API.
 */
export function isAllowedScrapeUrl(url: string | URL): boolean {
  let parsed: URL;
  try {
    parsed = typeof url === "string" ? new URL(url) : url;
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
  // An explicit port could reach a non-web service on an allowed host
  if (parsed.port !== "") return false;

  // Exact domain or subdomains - a bare endsWith would also match
  // e.g. "noteverybodyeats.nz"
  const hostname = parsed.hostname.toLowerCase();
  return hostname === "everybodyeats.nz" || hostname.endsWith(".everybodyeats.nz");
}
