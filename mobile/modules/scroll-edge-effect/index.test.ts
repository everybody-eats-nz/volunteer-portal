import { describe, expect, it, vi } from "vitest";

// Importing the module evaluates the real gate; with no native module it
// returns null without asking for the view, so these stubs are enough.
const requireNativeView = vi.fn(() => "native view");
vi.mock("expo", () => ({
  requireOptionalNativeModule: () => null,
  requireNativeView: () => requireNativeView(),
}));

const { chooseScrollEdgeEffectView, NativeScrollEdgeEffectView } = await import(
  "@/modules/scroll-edge-effect"
);

describe("scroll edge effect gate", () => {
  // Store builds from before the module still take over-the-air updates, and
  // requiring a native view the binary lacks throws at load.
  it("is null without the native module, and never asks for the view", () => {
    expect(NativeScrollEdgeEffectView).toBeNull();
    expect(requireNativeView).not.toHaveBeenCalled();

    const load = vi.fn(() => "view");
    expect(chooseScrollEdgeEffectView(null, load)).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  it("is null where the OS cannot draw the effect (before iOS 26)", () => {
    const load = vi.fn(() => "view");
    expect(chooseScrollEdgeEffectView({ isSupported: false }, load)).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  it("loads the view on iOS 26 with the module present", () => {
    expect(chooseScrollEdgeEffectView({ isSupported: true }, () => "view")).toBe("view");
  });
});
