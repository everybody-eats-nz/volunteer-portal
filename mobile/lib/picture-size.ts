/**
 * The capture size for an odometer photo.
 *
 * A dial filling the frame is perfectly legible at a couple of megapixels, and
 * the server refuses anything over 4 MB. A modern Android sensor shoots 50 MP by
 * default, which lands well over that even compressed, so the camera is asked
 * for the largest size whose long edge stays within the cap below.
 *
 * Sizes come from `getAvailablePictureSizesAsync`: plain "WIDTHxHEIGHT" strings
 * on Android, and on iOS a mix of those and named presets ("Photo", "High"),
 * which say nothing about their dimensions and are skipped. `undefined` leaves
 * the camera on its default.
 */
export const MAX_PICTURE_EDGE = 2560;

export function pickPictureSize(sizes: readonly string[]): string | undefined {
  let best: { size: string; area: number } | undefined;

  for (const size of sizes) {
    const match = /^(\d+)x(\d+)$/.exec(size);
    if (!match) continue;
    const width = Number(match[1]);
    const height = Number(match[2]);
    if (Math.max(width, height) > MAX_PICTURE_EDGE) continue;
    const area = width * height;
    if (!best || area > best.area) best = { size, area };
  }

  return best?.size;
}
