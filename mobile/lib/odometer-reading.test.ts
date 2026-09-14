import { describe, expect, it } from "vitest";

import {
  digitsOf,
  guideInImage,
  readOdometer,
  settledReading,
  type Box,
  type OcrResult,
} from "@/lib/odometer-reading";

const box = (x: number, y: number, width = 400, height = 90): Box => ({ x, y, width, height });

/** One line per entry, each with a single element, placed where given. */
function seen(...lines: { text: string; at?: Box; groups?: string[] }[]): OcrResult {
  return {
    text: lines.map((line) => line.text).join("\n"),
    blocks: [
      {
        text: "",
        boundingBox: box(0, 0, 2000, 1500),
        lines: lines.map(({ text, at = box(800, 700), groups }) => ({
          text,
          boundingBox: at,
          elements: (groups ?? [text]).map((group) => ({ text: group, boundingBox: at })),
        })),
      },
    ],
  };
}

describe("digitsOf", () => {
  it("keeps a number the dial could show and drops the unit and the tenths", () => {
    expect(digitsOf("123456")).toBe("123456");
    expect(digitsOf("123456 km")).toBe("123456");
    expect(digitsOf("123456.7")).toBe("123456");
    expect(digitsOf("123456,7km")).toBe("123456");
  });

  it("reads the letters a drum dial gets mistaken for as digits", () => {
    expect(digitsOf("O12345")).toBe("012345");
    expect(digitsOf("12B4S6")).toBe("128456");
    expect(digitsOf("l2345")).toBe("12345");
  });

  it("leaves words, times and the trip meter alone", () => {
    expect(digitsOf("ODO")).toBeNull();
    expect(digitsOf("TRIP")).toBeNull();
    expect(digitsOf("12:45")).toBeNull();
    expect(digitsOf("234.5")).toBeNull();
    expect(digitsOf("123")).toBeNull();
    expect(digitsOf("12345678")).toBeNull();
  });
});

describe("readOdometer", () => {
  it("finds the one number in a frame", () => {
    expect(readOdometer(seen({ text: "123456" }))).toEqual({ value: 123456, source: "123456" });
  });

  it("returns nothing when there is no number to find", () => {
    expect(readOdometer(seen({ text: "ODO" }, { text: "TRIP A" }))).toBeNull();
    expect(readOdometer({ text: "", blocks: [] })).toBeNull();
    expect(readOdometer(null)).toBeNull();
  });

  it("prefers the number inside the guide over one outside it", () => {
    const guide = box(600, 600, 800, 330);
    const result = seen(
      { text: "456789", at: box(100, 1300) },
      { text: "123456", at: box(800, 700) }
    );
    expect(readOdometer(result, { guide })?.value).toBe(123456);
    expect(readOdometer(result, { guide: box(0, 1200, 800, 330) })?.value).toBe(456789);
  });

  it("prefers the number just past the last reading over the trip meter", () => {
    const result = seen({ text: "1284" }, { text: "45210" });
    expect(readOdometer(result, { expected: 45102 })?.value).toBe(45210);
  });

  it("never offers a number at or below the floor", () => {
    const result = seen({ text: "45102" }, { text: "45210" });
    expect(readOdometer(result, { minimum: 45210 })).toBeNull();
    expect(readOdometer(result, { minimum: 45102 })?.value).toBe(45210);
  });

  it("drops a drum dial's tenths digit when that is what puts it near the last reading", () => {
    expect(readOdometer(seen({ text: "1234567" }), { expected: 123400 })?.value).toBe(123456);
    // Six digits that are already plausible stay as they are.
    expect(readOdometer(seen({ text: "123456" }), { expected: 123400 })?.value).toBe(123456);
  });

  it("joins the digit groups of a drum dial into one number", () => {
    const result = seen({ text: "12 34 56", groups: ["12", "34", "56"] });
    expect(readOdometer(result)?.value).toBe(123456);
  });

  it("reads a line with no elements from its text", () => {
    const result: OcrResult = {
      text: "98765",
      blocks: [{ text: "98765", lines: [{ text: "98765", boundingBox: box(0, 0) }] }],
    };
    expect(readOdometer(result)?.value).toBe(98765);
  });
});

describe("guideInImage", () => {
  it("scales the guide straight down when the preview and photo share a shape", () => {
    expect(
      guideInImage(box(40, 100, 280, 116), { width: 360, height: 480 }, { width: 1440, height: 1920 })
    ).toEqual({ x: 160, y: 400, width: 1120, height: 464 });
  });

  it("accounts for the sides of the photo the preview crops away", () => {
    const guide = guideInImage(
      box(40, 100, 280, 116),
      { width: 360, height: 640 },
      { width: 1440, height: 1920 }
    );
    expect(guide?.x).toBeCloseTo(300);
    expect(guide?.y).toBeCloseTo(300);
    expect(guide?.width).toBeCloseTo(840);
    expect(guide?.height).toBeCloseTo(348);
  });

  it("gives up on an unmeasured frame", () => {
    expect(guideInImage(box(0, 0), { width: 0, height: 0 }, { width: 10, height: 10 })).toBeNull();
  });
});

describe("settledReading", () => {
  it("waits for two glances in a row to agree", () => {
    expect(settledReading([])).toBeNull();
    expect(settledReading([123456])).toBeNull();
    expect(settledReading([123456, 123457])).toBeNull();
    expect(settledReading([123456, null])).toBeNull();
    expect(settledReading([null, null])).toBeNull();
    expect(settledReading([123456, 123457, 123457])).toBe(123457);
  });
});
