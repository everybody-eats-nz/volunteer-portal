import { afterEach, describe, expect, it, vi } from "vitest";
import type { LayoutChangeEvent } from "react-native";
import { act } from "react-test-renderer";

import { useFloatingHeader, type FloatingHeaderState } from "@/components/ui/floating-header";
import { render } from "@/test-utils/render";

// `vi.mock` is hoisted above the imports above (see test-utils/react-native).
vi.mock("react-native", () => import("@/test-utils/react-native"));

// The native edge effect view, or null as on Android, older iOS and store
// builds without the module.
const native = vi.hoisted(() => ({ view: null as null | (() => null) }));
vi.mock("@/modules/scroll-edge-effect", () => ({
  get NativeScrollEdgeEffectView() {
    return native.view;
  },
}));

const layout = (height: number) =>
  ({ nativeEvent: { layout: { x: 0, y: 0, width: 402, height } } }) as LayoutChangeEvent;

/** Renders the hook and returns a getter for its latest state. */
function renderHeader(options?: { estimatedHeight?: number }) {
  let state!: FloatingHeaderState;
  function Probe() {
    state = useFloatingHeader(options);
    return null;
  }
  render(<Probe />);
  return () => state;
}

describe("useFloatingHeader", () => {
  afterEach(() => {
    native.view = null;
  });

  describe("without the native edge effect", () => {
    it("keeps the header in flow: ready at once, no inset, no scroll props", () => {
      const header = renderHeader();

      expect(header()).toMatchObject({ floats: false, ready: true, inset: 0, scrollProps: {} });
    });

    it("ignores layout, so the screen looks exactly as before", () => {
      const header = renderHeader({ estimatedHeight: 120 });
      act(() => header().onLayout(layout(140)));

      expect(header()).toMatchObject({ floats: false, inset: 0, scrollProps: {} });
    });
  });

  describe("with the native edge effect", () => {
    it("holds the scroll view back until the header is measured", () => {
      native.view = () => null;
      const header = renderHeader();

      expect(header()).toMatchObject({ floats: true, ready: false, inset: 0 });

      act(() => header().onLayout(layout(118.4)));

      expect(header().ready).toBe(true);
      expect(header().inset).toBe(118);
      expect(header().scrollProps).toEqual({
        contentInset: { top: 118 },
        contentOffset: { x: 0, y: -118 },
        scrollIndicatorInsets: { top: 118 },
      });
    });

    it("is ready at once with an estimate, then takes the measurement", () => {
      native.view = () => null;
      const header = renderHeader({ estimatedHeight: 136 });

      expect(header()).toMatchObject({ ready: true, inset: 136 });

      act(() => header().onLayout(layout(140)));

      expect(header().inset).toBe(140);
      expect(header().scrollProps.contentInset).toEqual({ top: 140 });
    });

    // contentOffset is controlled: changing it would scroll the reader back to
    // the top whenever the header grows (Dynamic Type, a subtitle loading).
    it("keeps the mount offset when the header grows later", () => {
      native.view = () => null;
      const header = renderHeader();
      act(() => header().onLayout(layout(100)));
      act(() => header().onLayout(layout(124)));

      expect(header().inset).toBe(124);
      expect(header().scrollProps.contentInset).toEqual({ top: 124 });
      expect(header().scrollProps.contentOffset).toEqual({ x: 0, y: -100 });
    });
  });
});
