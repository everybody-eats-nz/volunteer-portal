import { requireNativeView, requireOptionalNativeModule } from "expo";
import type { ComponentType } from "react";
import type { ViewProps } from "react-native";

export type ScrollEdgeEffectViewProps = ViewProps & {
  /**
   * The edge of the scroll view this view floats over. `top` unless the list
   * is inverted (a chat thread), where the visual top is the scroll view's
   * bottom edge.
   */
  edge?: "top" | "bottom";
};

type ScrollEdgeEffectModule = { isSupported: boolean };

/**
 * Picks the native view only when the binary has the module and the OS can
 * draw the effect. Exported for tests.
 */
export function chooseScrollEdgeEffectView<T>(
  module: ScrollEdgeEffectModule | null,
  load: () => T
): T | null {
  return module?.isSupported ? load() : null;
}

/**
 * The native iOS 26 scroll edge effect, or null where it cannot be drawn:
 * Android, iOS 18 and earlier, and store builds from before this module was
 * added (they still take over-the-air updates, and requiring a missing native
 * view throws). Callers fall back to a painted fade.
 */
export const NativeScrollEdgeEffectView: ComponentType<ScrollEdgeEffectViewProps> | null =
  chooseScrollEdgeEffectView(
    requireOptionalNativeModule<ScrollEdgeEffectModule>("ScrollEdgeEffect"),
    () => requireNativeView<ScrollEdgeEffectViewProps>("ScrollEdgeEffect")
  );
