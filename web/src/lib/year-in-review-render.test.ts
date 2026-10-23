import { describe, expect, it } from "vitest";
import { canReuse, hashProps } from "@/lib/year-in-review-render.server";
import type { YearInReviewProps } from "@/remotion/year-in-review/schema";

const now = new Date("2026-10-23T03:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);

describe("canReuse", () => {
  it("reuses a job built from the same numbers, whatever its state", () => {
    for (const status of ["QUEUED", "RENDERING", "READY"] as const) {
      expect(
        canReuse({ status, propsHash: "a", renderedAt: null }, "a", now)
      ).toBe(true);
    }
  });

  it("re-renders when the numbers changed", () => {
    expect(
      canReuse({ status: "QUEUED", propsHash: "a", renderedAt: null }, "b", now)
    ).toBe(false);
    expect(
      canReuse(
        { status: "READY", propsHash: "a", renderedAt: hoursAgo(30) },
        "b",
        now
      )
    ).toBe(false);
  });

  it("keeps a video under a day old even if the numbers moved", () => {
    expect(
      canReuse(
        { status: "READY", propsHash: "a", renderedAt: hoursAgo(5) },
        "b",
        now
      )
    ).toBe(true);
  });

  it("always retries a failed render", () => {
    expect(
      canReuse({ status: "FAILED", propsHash: "a", renderedAt: null }, "a", now)
    ).toBe(false);
  });
});

describe("hashProps", () => {
  it("is stable for the same props and changes with them", () => {
    const props = { year: 2026, firstName: "Aroha" } as YearInReviewProps;
    expect(hashProps(props)).toBe(hashProps({ ...props }));
    expect(hashProps(props)).not.toBe(
      hashProps({ ...props, firstName: "Mere" })
    );
  });
});
