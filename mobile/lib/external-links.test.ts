import { beforeEach, describe, expect, it, vi } from "vitest";

const openBrowserAsync = vi.fn();
const openURL = vi.fn();

vi.mock("expo-web-browser", () => ({
  openBrowserAsync,
  WebBrowserPresentationStyle: { AUTOMATIC: "automatic" },
}));
vi.mock("react-native", () => ({ Linking: { openURL } }));

const { openExternalLink } = await import("@/lib/external-links");

beforeEach(() => {
  openBrowserAsync.mockClear();
  openURL.mockClear();
});

describe("openExternalLink", () => {
  it("opens a web URL in the in-app browser", async () => {
    await openExternalLink("https://everybodyeats.nz/volunteer");
    expect(openBrowserAsync).toHaveBeenCalledWith(
      "https://everybodyeats.nz/volunteer",
      expect.anything()
    );
  });

  it("adds https:// to a bare domain", async () => {
    await openExternalLink("everybodyeats.nz");
    expect(openBrowserAsync).toHaveBeenCalledWith(
      "https://everybodyeats.nz",
      expect.anything()
    );
  });

  it("trims surrounding whitespace", async () => {
    await openExternalLink("  https://everybodyeats.nz  ");
    expect(openBrowserAsync).toHaveBeenCalledWith(
      "https://everybodyeats.nz",
      expect.anything()
    );
  });

  it.each([
    ["a plain email address", "jack@everybodyeats.nz", "mailto:jack@everybodyeats.nz"],
    ["a mailto: link", "mailto:jack@everybodyeats.nz", "mailto:jack@everybodyeats.nz"],
    ["a tel: link", "tel:0800123456", "tel:0800123456"],
  ])("hands %s to the system", async (_label, input, expected) => {
    await openExternalLink(input);
    expect(openURL).toHaveBeenCalledWith(expected);
    expect(openBrowserAsync).not.toHaveBeenCalled();
  });

  it.each(["javascript:alert(1)", "everybodyeats://shift/1", "file:///etc/passwd"])(
    "ignores %s",
    async (input) => {
      await openExternalLink(input);
      expect(openBrowserAsync).not.toHaveBeenCalled();
      expect(openURL).not.toHaveBeenCalled();
    }
  );

  it("ignores an empty string", async () => {
    await openExternalLink("   ");
    expect(openBrowserAsync).not.toHaveBeenCalled();
    expect(openURL).not.toHaveBeenCalled();
  });
});
