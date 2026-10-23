/**
 * Pages under /embed are shown inside the mobile app's WebView. The app draws
 * its own header, so the site header, footer and page container stay off.
 */
export function isEmbedPath(pathname: string): boolean {
  return pathname.startsWith("/embed/");
}
