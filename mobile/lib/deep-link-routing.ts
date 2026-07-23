/**
 * Maps an incoming deep link (iOS Universal Link / Android App Link, or a
 * custom-scheme link) to the matching in-app route.
 *
 * The web app and the mobile app don't share a URL structure — e.g. web
 * `/shifts/:id` → mobile `/shift/[id]`, web `/friends/:id` → mobile
 * `/user/[id]`. This mirrors the notification-tap mapping in
 * `notification-routing.ts` so a tapped website link lands on the same screen
 * a notification would.
 *
 * Claimed paths are kept in sync with the association files:
 *   web/public/.well-known/apple-app-site-association (iOS `applinks`)
 *   web/public/.well-known/assetlinks.json + app.json Android intentFilters
 *
 * Security: this only ever returns an internal absolute path ("/…") or a
 * custom-scheme link we already recognise. http(s) URLs are honoured only for
 * our own domain, and a non-internal path collapses to "/". That stops a
 * crafted link (e.g. an http URL whose path is itself an absolute URL) from
 * navigating the app somewhere unexpected.
 */
export const WEB_HOST = "volunteers.everybodyeats.nz";

export function mapDeepLinkToRoute(rawPath: string): string {
  // Custom-scheme links (OAuth redirects, our own app scheme) aren't web URLs
  // — hand them back untouched so Expo Router resolves them as it did before.
  if (hasScheme(rawPath) && !isHttpUrl(rawPath)) {
    return rawPath;
  }

  let pathname = rawPath;
  let search = "";

  if (isHttpUrl(rawPath)) {
    const url = new URL(rawPath);
    // Only trust links to our own web domain.
    if (url.hostname !== WEB_HOST) return "/";
    pathname = url.pathname;
    search = url.search;
  } else {
    const q = pathname.indexOf("?");
    if (q !== -1) {
      search = pathname.slice(q);
      pathname = pathname.slice(0, q);
    }
  }

  // Defence in depth: only ever navigate to an internal absolute path.
  if (!pathname.startsWith("/")) return "/";

  const query = new URLSearchParams(search.replace(/^\?/, ""));

  // /shifts/:id -> shift detail modal. Exclude the web's non-id sub-routes
  // (/shifts/mine, /shifts/details) so they aren't treated as a shift id.
  const shiftDetail = pathname.match(/^\/shifts\/([^/]+)$/);
  if (shiftDetail && !["mine", "details"].includes(shiftDetail[1])) {
    return `/shift/${shiftDetail[1]}`;
  }

  // /shifts/details?date=YYYY-MM-DD&location=X -> shifts tab. Forward the
  // date and location so the tab can jump to that day and switch its filter
  // to the linked restaurant (mirrors notification-routing.ts). Encoded with
  // %20 rather than URLSearchParams' "+" — expo-router percent-decodes params
  // but doesn't apply the form-encoding plus-as-space rule.
  if (pathname === "/shifts/details") {
    const parts: string[] = [];
    const date = query.get("date");
    const location = query.get("location");
    if (date) parts.push(`date=${encodeURIComponent(date)}`);
    if (location) parts.push(`location=${encodeURIComponent(location)}`);
    return parts.length > 0
      ? `/(tabs)/shifts?${parts.join("&")}`
      : "/(tabs)/shifts";
  }

  // /shifts, /shifts/mine -> shifts tab
  if (pathname === "/shifts" || pathname.startsWith("/shifts/")) {
    return "/(tabs)/shifts";
  }

  // /dashboard -> home tab
  if (pathname === "/dashboard") return "/(tabs)";

  // /friends/:id -> unified user profile screen
  const friendProfile = pathname.match(/^\/friends\/([^/]+)$/);
  if (friendProfile) return `/user/${friendProfile[1]}`;

  // /friends?fromUserId=:id -> that user's profile (incoming request view)
  const fromUserId = query.get("fromUserId");
  if (pathname === "/friends" && fromUserId) return `/user/${fromUserId}`;

  // /friends* fallback -> profile tab (friends live under profile on mobile)
  if (pathname === "/friends" || pathname.startsWith("/friends/")) {
    return "/(tabs)/profile";
  }

  // /profile* -> profile tab
  if (pathname === "/profile" || pathname.startsWith("/profile/")) {
    return "/(tabs)/profile";
  }

  // /achievements* -> profile tab (achievements live under profile on mobile)
  if (pathname.startsWith("/achievements")) return "/(tabs)/profile";

  // Unrecognised but internal — pass the normalised path through.
  return pathname + search;
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function hasScheme(value: string): boolean {
  return /^[a-z][a-z0-9.+-]*:\/\//i.test(value);
}
