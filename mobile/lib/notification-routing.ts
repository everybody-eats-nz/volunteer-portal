import { router } from 'expo-router';

/**
 * Translate a web-app URL (from a notification's actionUrl) to a mobile
 * route and navigate there. Silently no-ops for URLs we don't have a
 * screen for — better than crashing the app on an unmapped path.
 */
export function navigateToNotificationTarget(actionUrl: unknown) {
  if (typeof actionUrl !== 'string' || !actionUrl.startsWith('/')) return;

  // Strip query string — we don't currently use it on mobile.
  const pathname = actionUrl.split('?')[0];

  // /shifts/:id -> shift detail modal
  const shiftDetail = pathname.match(/^\/shifts\/([^/]+)$/);
  if (shiftDetail) {
    router.push({ pathname: '/shift/[id]', params: { id: shiftDetail[1] } });
    return;
  }

  // /shifts or /shifts/mine -> shifts tab
  if (pathname === '/shifts' || pathname.startsWith('/shifts/')) {
    router.push('/(tabs)/shifts');
    return;
  }

  // /friends* -> profile tab (friends live under profile on mobile)
  if (pathname === '/friends' || pathname.startsWith('/friends/')) {
    router.push('/(tabs)/profile');
    return;
  }

  // /achievements* -> profile tab
  if (pathname.startsWith('/achievements')) {
    router.push('/(tabs)/profile');
    return;
  }
}
