import { describe, it, expect } from "vitest";
import {
  getExceptionMessages,
  isBrowserInjectedException,
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

  describe("isBrowserInjectedException", () => {
    const PAGE = "https://volunteers.everybodyeats.nz/volunteer/wellington";

    function framedEvent(
      frames: Array<Record<string, unknown>>,
      value = "Maximum call stack size exceeded."
    ): InspectableEvent {
      return {
        event: "$exception",
        properties: {
          $exception_list: [
            { type: "RangeError", value, stacktrace: { type: "raw", frames } },
          ],
        },
      };
    }

    it("drops the Chrome iOS injected-script recursion from issue #1397", () => {
      // Frames as captured on /volunteer/wellington: Gk/Ek mutual recursion on
      // lines 194-230 of a page whose HTML is a single line.
      const event = framedEvent([
        { filename: PAGE, lineno: 194, colno: 70 },
        { filename: PAGE, lineno: 201, colno: 363 },
        { filename: PAGE, lineno: 194, colno: 41 },
        { filename: PAGE, lineno: 202, colno: 201 },
        { filename: PAGE, lineno: 230, colno: 383, function: "Gk" },
        { filename: PAGE, lineno: 230, colno: 63, function: "Ek" },
        { filename: PAGE, lineno: 230, colno: 409, function: "Gk" },
      ]);
      expect(isBrowserInjectedException(event)).toBe(true);
      expect(isNoiseException(event)).toBe(true);
    });

    it("drops injected frames that name another page (issue #1195)", () => {
      const event = framedEvent([
        { filename: "https://volunteers.everybodyeats.nz/shifts", lineno: 194 },
        { filename: "https://volunteers.everybodyeats.nz/me", lineno: 224 },
      ]);
      expect(isBrowserInjectedException(event)).toBe(true);
    });

    it("drops minified injected-script messages like 'Ma' (issue #1398)", () => {
      const event = framedEvent([{ filename: PAGE, lineno: 520 }], "Ma");
      expect(isNoiseException(event)).toBe(true);
    });

    it("accepts bare page paths as PostHog sometimes stores them", () => {
      const event = framedEvent([
        { filename: "/volunteer/wellington?ref=x", lineno: 194 },
      ]);
      expect(isBrowserInjectedException(event)).toBe(true);
    });

    it("keeps errors from our own Next.js chunks", () => {
      const event = framedEvent([
        {
          filename:
            "https://volunteers.everybodyeats.nz/_next/static/chunks/app/page-abc123.js",
          lineno: 1,
        },
      ]);
      expect(isNoiseException(event)).toBe(false);
    });

    it("keeps a stack that mixes injected frames with one of ours", () => {
      const event = framedEvent([
        { filename: PAGE, lineno: 194 },
        {
          filename:
            "https://volunteers.everybodyeats.nz/_next/static/chunks/4821-abc.js",
          lineno: 1,
        },
      ]);
      expect(isBrowserInjectedException(event)).toBe(false);
    });

    it("keeps frames on line 1 of the page, where our inline scripts live", () => {
      const event = framedEvent([{ filename: PAGE, lineno: 1 }]);
      expect(isBrowserInjectedException(event)).toBe(false);
    });

    it("keeps third-party script files, even on later lines", () => {
      const event = framedEvent([
        {
          filename: "https://challenges.cloudflare.com/turnstile/v0/api.js",
          lineno: 300,
        },
      ]);
      expect(isBrowserInjectedException(event)).toBe(false);
    });

    it("keeps frames with non-http or missing sources", () => {
      for (const filename of ["webpack-internal:///./src/x.ts", "<anonymous>", undefined]) {
        expect(
          isBrowserInjectedException(framedEvent([{ filename, lineno: 50 }]))
        ).toBe(false);
      }
    });

    it("keeps frames without a line number", () => {
      expect(
        isBrowserInjectedException(framedEvent([{ filename: PAGE }]))
      ).toBe(false);
    });

    it("keeps exceptions with no stack frames", () => {
      expect(isBrowserInjectedException(framedEvent([]))).toBe(false);
      expect(
        isBrowserInjectedException(exceptionEvent(["RangeError: boom"]))
      ).toBe(false);
    });

    it("keeps the event when a chained cause has frames of ours", () => {
      const event: InspectableEvent = {
        event: "$exception",
        properties: {
          $exception_list: [
            {
              type: "Error",
              value: "outer",
              stacktrace: { frames: [{ filename: PAGE, lineno: 194 }] },
            },
            {
              type: "Error",
              value: "cause",
              stacktrace: {
                frames: [
                  {
                    filename:
                      "https://volunteers.everybodyeats.nz/_next/static/chunks/1-a.js",
                    lineno: 1,
                  },
                ],
              },
            },
          ],
        },
      };
      expect(isBrowserInjectedException(event)).toBe(false);
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
