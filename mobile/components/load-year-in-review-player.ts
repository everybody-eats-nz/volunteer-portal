import { Platform, TurboModuleRegistry } from "react-native";

import type * as PlayerModule from "./year-in-review-player";

/**
 * Calls `load` only when this binary has react-native-webview's native
 * module, else returns null without calling it.
 */
export function chooseYearInReviewPlayer<T>(load: () => T): T | null {
  return Platform.OS !== "web" && TurboModuleRegistry.get("RNCWebViewModule")
    ? load()
    : null;
}

/**
 * The Year in mahi player, or null when this binary cannot show one.
 *
 * It needs react-native-webview, a native module. Installs built before that
 * was added still take over-the-air updates, and importing it there throws at
 * load ("'RNCWebViewModule' could not be found"), which closes the app. So
 * the player file is only required once the module is known to be in the
 * binary. Without it the screen asks them to update the app, and the
 * server-rendered MP4 (save or share) still works.
 */
export const YearInReviewPlayer = chooseYearInReviewPlayer(
  () =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require("./year-in-review-player") as typeof PlayerModule).YearInReviewPlayer
);
