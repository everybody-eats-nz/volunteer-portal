import { useCallback, useState, type ReactNode } from "react";
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { NativeScrollEdgeEffectView } from "@/modules/scroll-edge-effect";

/**
 * Where the native scroll edge effect exists (iOS 26), a hand-built header
 * floats over the screen's scroll view the way a navigation bar does: the
 * list runs underneath it, and content blurs and fades as it slides under the
 * header's controls. Elsewhere the header stays a solid band in the layout,
 * above the list, as it always has.
 */
export const HEADER_FLOATS = NativeScrollEdgeEffectView != null;

export type FloatingHeaderState = {
  /** The header sits over the scroll view instead of above it. */
  floats: boolean;
  /**
   * False only while a floating header has not been measured (or estimated)
   * yet. Hold a scroll view that takes `scrollProps` back until then, so it
   * mounts already inset and scrolled to its top rather than jumping once the
   * header lays out.
   */
  ready: boolean;
  /** Height the header covers at the top of the scroll view. 0 in flow. */
  inset: number;
  /** For `FloatingHeader`. */
  onLayout: (event: LayoutChangeEvent) => void;
  /**
   * For the scroll view under the header. Insetting (rather than padding the
   * content) keeps pull to refresh and the scroll indicator below the header,
   * as UIKit does under a navigation bar. A scroll view whose offset must
   * start at 0 (a keyboard-aware form) pads its content by `inset` instead.
   */
  scrollProps: Pick<ScrollViewProps, "contentInset" | "contentOffset" | "scrollIndicatorInsets">;
};

const NO_SCROLL_PROPS: FloatingHeaderState["scrollProps"] = {};

/**
 * Pass `estimatedHeight` when the header's height is known up front: the
 * screen can then lay out (and mount its scroll view) at once, and only
 * adjusts if the measurement disagrees.
 */
export function useFloatingHeader({
  estimatedHeight,
}: { estimatedHeight?: number } = {}): FloatingHeaderState {
  const [height, setHeight] = useState<number | null>(null);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setHeight(Math.round(event.nativeEvent.layout.height));
  }, []);

  if (!HEADER_FLOATS) {
    return { floats: false, ready: true, inset: 0, onLayout, scrollProps: NO_SCROLL_PROPS };
  }

  const inset = height ?? estimatedHeight ?? 0;
  return {
    floats: true,
    ready: height != null || estimatedHeight != null,
    inset,
    onLayout,
    scrollProps: {
      contentInset: { top: inset },
      contentOffset: { x: 0, y: -inset },
      scrollIndicatorInsets: { top: inset },
    },
  };
}

/**
 * The fixed chrome at the top of a screen: its `ScreenHeader` plus any
 * controls that stay put above the list, such as a search field or a day
 * stepper.
 *
 * Render it before the scroll view and spread `useFloatingHeader().scrollProps`
 * onto that scroll view. Floating, it is transparent and the system edge
 * effect takes the place of the header's hairline, so pass the header
 * `bordered={!header.floats}`. In flow it is a plain wrapper and the screen
 * looks exactly as it did before.
 */
export function FloatingHeader({
  header,
  style,
  children,
}: {
  header: FloatingHeaderState;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  if (NativeScrollEdgeEffectView && header.floats) {
    return (
      <NativeScrollEdgeEffectView
        onLayout={header.onLayout}
        style={[styles.floating, style]}
      >
        {children}
      </NativeScrollEdgeEffectView>
    );
  }

  return <View style={[styles.inFlow, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  floating: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
  },
  inFlow: {
    zIndex: 2,
  },
});
