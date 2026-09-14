import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

import type * as ViewfinderModule from "./odometer-viewfinder";

/**
 * The live odometer viewfinder, or null when this binary cannot show one.
 *
 * It needs expo-camera, a native module. Installs built before that was added
 * still take over-the-air updates, and importing expo-camera there throws at
 * load, so the viewfinder file is only required once the module is known to
 * be in the binary. Without it the odometer screen opens the system camera.
 */
export const OdometerViewfinder: typeof ViewfinderModule.OdometerViewfinder | null =
  Platform.OS !== "web" && requireOptionalNativeModule("ExpoCamera")
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require("./odometer-viewfinder") as typeof ViewfinderModule).OdometerViewfinder
    : null;
