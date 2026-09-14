import { describe, expect, it } from "vitest";

import { pickPictureSize } from "./picture-size";

describe("pickPictureSize", () => {
  it("picks the largest size within the edge cap", () => {
    expect(
      pickPictureSize(["8160x6120", "4000x3000", "2560x1920", "2048x1536", "1280x960"])
    ).toBe("2560x1920");
  });

  it("skips iOS named presets", () => {
    expect(pickPictureSize(["Photo", "High", "3840x2160", "1920x1080", "1280x720"])).toBe(
      "1920x1080"
    );
  });

  it("leaves the camera on its default when nothing fits", () => {
    expect(pickPictureSize(["Photo", "4000x3000"])).toBeUndefined();
    expect(pickPictureSize([])).toBeUndefined();
  });
});
