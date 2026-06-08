import { describe, it, expect } from "vitest";
import {
  getExceptionMessages,
  isNoiseException,
  NOISE_EXCEPTION_PATTERNS,
  type InspectableEvent,
} from "./posthog-noise-filter";

function exceptionEvent(
  messages: string[],
  { useList = true }: { useList?: boolean } = {}
): InspectableEvent {
  return {
    event: "$exception",
    properties: useList
      ? { $exception_list: messages.map((value) => ({ type: "Error", value })) }
      : { $exception_values: messages },
  };
}

describe("posthog-noise-filter", () => {
  describe("isNoiseException", () => {
    it("drops the Outlook Safe-Links extension UnhandledRejection", () => {
      const event = exceptionEvent([
        "Non-Error promise rejection captured with value: Object Not Found Matching Id:1, MethodName:update, ParamCount:4",
      ]);
      expect(isNoiseException(event)).toBe(true);
    });

    it("drops the extension error regardless of the numeric Id", () => {
      for (const id of [1, 2, 3, 4, 17]) {
        const event = exceptionEvent([
          `Object Not Found Matching Id:${id}, MethodName:update, ParamCount:4`,
        ]);
        expect(isNoiseException(event)).toBe(true);
      }
    });

    it("drops opaque cross-origin 'Script error.'", () => {
      expect(isNoiseException(exceptionEvent(["Script error."]))).toBe(true);
    });

    it("drops 'Script error.' even with a trailing suffix", () => {
      expect(
        isNoiseException(exceptionEvent(["Script error. (line 0)"]))
      ).toBe(true);
    });

    it("drops benign ResizeObserver loop notifications", () => {
      expect(
        isNoiseException(exceptionEvent(["ResizeObserver loop limit exceeded"]))
      ).toBe(true);
      expect(
        isNoiseException(
          exceptionEvent([
            "ResizeObserver loop completed with undelivered notifications.",
          ])
        )
      ).toBe(true);
    });

    it("reads messages from the flat $exception_values array too", () => {
      const event = exceptionEvent(["Script error."], { useList: false });
      expect(isNoiseException(event)).toBe(true);
    });

    it("matches if any exception in a multi-error list is noise", () => {
      const event = exceptionEvent([
        "TypeError: real app bug",
        "Object Not Found Matching Id:2, MethodName:update, ParamCount:4",
      ]);
      expect(isNoiseException(event)).toBe(true);
    });

    it("keeps genuine application errors", () => {
      const event = exceptionEvent([
        "TypeError: Cannot read properties of undefined (reading 'id')",
      ]);
      expect(isNoiseException(event)).toBe(false);
    });

    it("keeps React hydration errors (those are real and actionable)", () => {
      const event = exceptionEvent([
        "Minified React error #418; visit https://react.dev/errors/418",
      ]);
      expect(isNoiseException(event)).toBe(false);
    });

    it("ignores non-exception events entirely", () => {
      const event: InspectableEvent = {
        event: "$pageview",
        properties: { $exception_values: ["Script error."] },
      };
      expect(isNoiseException(event)).toBe(false);
    });

    it("handles exception events with no properties without throwing", () => {
      expect(isNoiseException({ event: "$exception" })).toBe(false);
    });

    it("does not treat a message merely containing 'script error' mid-string as noise", () => {
      // The pattern is anchored to the start, so this real error is kept.
      const event = exceptionEvent([
        "Failed to run script error handler for module X",
      ]);
      expect(isNoiseException(event)).toBe(false);
    });
  });

  describe("getExceptionMessages", () => {
    it("merges $exception_list values and $exception_values", () => {
      const event: InspectableEvent = {
        event: "$exception",
        properties: {
          $exception_list: [{ type: "Error", value: "from list" }],
          $exception_values: ["from values"],
        },
      };
      expect(getExceptionMessages(event)).toEqual(["from list", "from values"]);
    });

    it("skips non-string and malformed entries", () => {
      const event: InspectableEvent = {
        event: "$exception",
        properties: {
          $exception_list: [{ type: "Error" }, null, { value: 42 }],
          $exception_values: ["ok", 99],
        },
      };
      expect(getExceptionMessages(event)).toEqual(["ok"]);
    });
  });

  describe("NOISE_EXCEPTION_PATTERNS", () => {
    it("is a non-empty list of regexes", () => {
      expect(NOISE_EXCEPTION_PATTERNS.length).toBeGreaterThan(0);
      for (const pattern of NOISE_EXCEPTION_PATTERNS) {
        expect(pattern).toBeInstanceOf(RegExp);
      }
    });
  });
});
