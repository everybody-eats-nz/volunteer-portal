import { afterEach, describe, expect, it, vi } from "vitest";

import { goBackOrHome } from "@/lib/navigation";

// `vi.mock` is hoisted above the import, so the module under test resolves
// this stub instead of the real expo-router.
const backMock = vi.fn();
const replaceMock = vi.fn();
const canGoBackMock = vi.fn();

vi.mock("expo-router", () => ({
  router: {
    back: (...args: unknown[]) => backMock(...args),
    replace: (...args: unknown[]) => replaceMock(...args),
    canGoBack: () => canGoBackMock(),
  },
}));

describe("goBackOrHome", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("goes back when there is a screen to go back to", () => {
    canGoBackMock.mockReturnValue(true);

    goBackOrHome();

    expect(backMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("falls back to the tabs when the screen is the whole history", () => {
    // What a cold start from a shift-shortage email deep link looks like:
    // /shift/:id is the only route, so back() would silently do nothing.
    canGoBackMock.mockReturnValue(false);

    goBackOrHome();

    expect(replaceMock).toHaveBeenCalledWith("/(tabs)");
    expect(backMock).not.toHaveBeenCalled();
  });
});
