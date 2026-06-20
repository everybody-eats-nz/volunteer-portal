/**
 * Rewrites incoming deep links (iOS Universal Links / Android App Links, plus
 * custom-scheme links) to the matching in-app route before Expo Router
 * navigates.
 *
 * The web app and the mobile app don't share a URL structure — e.g. the web
 * has `/shifts/:id` and `/friends/:id`, while mobile has `/shift/[id]` and
 * `/user/[id]`. This mirrors the notification-tap mapping in
 * `lib/notification-routing.ts` so a tapped link from the website lands on the
 * same screen a notification would.
 *
 * Claimed paths are kept in sync with the association files:
 *   web/public/.well-known/apple-app-site-association (iOS `applinks`)
 *   web/public/.well-known/assetlinks.json + app.json Android intentFilters
 *
 * Anything we don't recognise (OAuth redirects, unmapped paths) is returned
 * unchanged so Expo Router resolves it normally.
 */
export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}): string {
  try {
    return mapToAppRoute(path);
  } catch {
    return path;
  }
}

function mapToAppRoute(rawPath: string): string {
  let pathname = rawPath;
  let search = "";

  // Normalise full URLs (https://…) and custom-scheme links down to a path.
  if (pathname.includes("://")) {
    const url = new URL(pathname);
    pathname = url.pathname;
    search = url.search;
  } else {
    const qIndex = pathname.indexOf("?");
    if (qIndex !== -1) {
      search = pathname.slice(qIndex);
      pathname = pathname.slice(0, qIndex);
    }
  }

  const query = new URLSearchParams(search.replace(/^\?/, ""));

  // /shifts/:id -> shift detail modal. Exclude the web's non-id sub-routes
  // (/shifts/mine, /shifts/details) so they don't get treated as a shift id.
  const shiftDetail = pathname.match(/^\/shifts\/([^/]+)$/);
  if (shiftDetail && !["mine", "details"].includes(shiftDetail[1])) {
    return `/shift/${shiftDetail[1]}`;
  }

  // /shifts, /shifts/mine, /shifts/details -> shifts tab
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

  // Unrecognised — leave untouched (e.g. OAuth redirects).
  return rawPath;
}
