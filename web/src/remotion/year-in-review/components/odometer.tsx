import type { CSSProperties } from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { formatNumber } from "../theme";
import { clamp, useSquash } from "./motion";
import { Sound } from "./sound";

/** How far a digit's reel travels before it lands, in whole turns. */
const TURNS = 2;
/** Races off the mark, then brakes hard into the landed digit. */
const roll = Easing.bezier(0.12, 0.7, 0.16, 1);

/**
 * One digit's reel. Drawn as the strip of digits either side of the
 * current position inside a window one em tall, so the reel rolls up
 * through the window and the digit it lands on squashes into place.
 */
const Reel = ({
  digit,
  start,
  landAt,
  turns,
}: {
  readonly digit: number;
  readonly start: number;
  readonly landAt: number;
  readonly turns: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const position = interpolate(
    frame,
    [start * fps, landAt * fps],
    [digit - turns * 10, digit],
    { ...clamp, easing: roll }
  );
  const squash = useSquash(landAt, 0.18);
  const nearest = Math.round(position);

  return (
    <span
      style={{
        position: "relative",
        display: "inline-block",
        height: "1em",
        lineHeight: 1,
        // Clips the strip to the window without touching the neighbours.
        clipPath: "inset(0 -10%)",
        scale: `1 ${squash}`,
        transformOrigin: "50% 100%",
      }}
    >
      {/* A click as the reel catches. */}
      <Sound name="mouse-click" at={landAt} volume={0.26} />
      {/* Holds the landed digit's width, so the number never reflows. */}
      <span style={{ visibility: "hidden" }}>{digit}</span>
      {[nearest - 1, nearest, nearest + 1].map((n) => {
        const offset = n - position;
        return (
          <span
            key={n}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              textAlign: "center",
              translate: `0px ${-offset * 100}%`,
              opacity: 1 - Math.abs(offset) * 0.85,
            }}
          >
            {((n % 10) + 10) % 10}
          </span>
        );
      })}
    </span>
  );
};

/**
 * A number on rolling reels, like an odometer or a departures board: every
 * digit rolls at once and they land left to right, each squashing into
 * place with a click, so the final figure arrives with a rhythm.
 */
export const Odometer = ({
  value,
  grouping = true,
  start = 0,
  land = 1.6,
  style,
}: {
  readonly value: number;
  /** Thousands separators; off for years. */
  readonly grouping?: boolean;
  /** Seconds into the scene the reels start rolling. */
  readonly start?: number;
  /** Seconds into the scene the last digit lands. */
  readonly land?: number;
  readonly style?: CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const characters = [...(grouping ? formatNumber(value) : String(value))];
  const digits = characters.filter((c) => /\d/.test(c)).length;
  let place = 0;

  return (
    <span
      style={{
        display: "inline-block",
        // The reels are already turning as they come into view.
        opacity: interpolate(
          frame,
          [start * fps, (start + 0.12) * fps],
          [0, 1],
          clamp
        ),
        ...style,
        // After `style`: display styles balance lines, and a number must
        // never break.
        textWrap: "nowrap",
        fontVariantNumeric: "lining-nums",
      }}
    >
      {characters.map((c, i) => {
        if (!/\d/.test(c)) return <span key={i}>{c}</span>;
        const order = place++;
        const share = digits > 1 ? order / (digits - 1) : 1;
        return (
          <Reel
            key={i}
            digit={Number(c)}
            start={start}
            landAt={start + (land - start) * (0.6 + 0.4 * share)}
            turns={TURNS + order}
          />
        );
      })}
    </span>
  );
};
