import type { CSSProperties } from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { formatNumber } from "../theme";
import { clamp, useSquash } from "./motion";
import { Sound } from "./sound";

/** Races off the mark, then brakes hard into the landed figure. */
const roll = Easing.bezier(0.12, 0.7, 0.16, 1);

/**
 * One reel of an odometer, showing the digit at `position` (fractional:
 * 3.4 is "3" rolling four tenths of the way up to "4"). Drawn as the strip
 * of digits either side of the position inside a window one em tall.
 */
const Reel = ({
  position,
  width,
}: {
  readonly position: number;
  /** The digit whose width the reel holds, so nothing reflows. */
  readonly width: number;
}) => {
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
      }}
    >
      <span style={{ visibility: "hidden" }}>{width}</span>
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
 * Where each reel of a mechanical odometer sits when the counter reads
 * `value`: the ones reel turns continuously, and each reel above it only
 * rolls on the carry, in the last tenth of the reel below it.
 */
const reelPosition = (value: number, place: number): number => {
  const x = value / 10 ** place;
  if (place === 0) return x;
  const digit = Math.floor(x);
  const below = x - digit;
  return digit + Math.max(0, (below - 0.9) * 10);
};

/**
 * A number climbing from zero on odometer reels, fast then easing in to
 * land. Reels and separators appear as the count reaches them, so the
 * figure widens as it grows, and it squashes into place with a click.
 */
export const Odometer = ({
  value,
  start = 0,
  land = 1.6,
  style,
}: {
  readonly value: number;
  /** Seconds into the scene the count starts. */
  readonly start?: number;
  /** Seconds into the scene it lands on `value`. */
  readonly land?: number;
  readonly style?: CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const current = interpolate(
    frame,
    [start * fps, land * fps],
    [0, value],
    { ...clamp, easing: roll }
  );
  const squash = useSquash(land, 0.16);
  // The landed figure is the template: its digits set the reels' places
  // and widths, its separators sit between them.
  const characters = [...formatNumber(value)];
  const digits = characters.filter((c) => /\d/.test(c)).length;
  let seen = 0;

  return (
    <span
      style={{
        display: "inline-block",
        ...style,
        // After `style`: display styles balance lines, and a number must
        // never break.
        textWrap: "nowrap",
        fontVariantNumeric: "lining-nums",
        opacity: frame < start * fps ? 0 : 1,
        scale: `1 ${squash}`,
        transformOrigin: "left bottom",
      }}
    >
      <Sound name="mouse-click" at={land} volume={0.3} />
      {characters.map((c, i) => {
        // A reel shows once the count has reached its place (the ones reel
        // always); a separator once the reel to its left has.
        const place = digits - 1 - seen;
        const reached = (p: number) => p === 0 || current >= 10 ** p;
        if (!/\d/.test(c)) {
          return reached(place + 1) ? <span key={i}>{c}</span> : null;
        }
        seen++;
        if (!reached(place)) return null;
        return (
          <Reel key={i} position={reelPosition(current, place)} width={Number(c)} />
        );
      })}
    </span>
  );
};

/**
 * A figure that isn't a count, like a year, arriving on spinning reels:
 * every reel turns at once and they land left to right, each squashing
 * into place with a click.
 */
export const Reels = ({
  value,
  start = 0,
  land = 1.6,
  style,
}: {
  readonly value: number;
  readonly start?: number;
  readonly land?: number;
  readonly style?: CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const digits = [...String(value)].map(Number);

  return (
    <span
      style={{
        display: "inline-block",
        ...style,
        textWrap: "nowrap",
        fontVariantNumeric: "lining-nums",
        // The reels are already turning as they come into view.
        opacity: interpolate(
          frame,
          [start * fps, (start + 0.12) * fps],
          [0, 1],
          clamp
        ),
      }}
    >
      {digits.map((digit, i) => (
        <SpinningReel
          key={i}
          digit={digit}
          start={start}
          landAt={start + (land - start) * (0.6 + 0.4 * (i / (digits.length - 1)))}
          turns={2 + i}
        />
      ))}
    </span>
  );
};

const SpinningReel = ({
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

  return (
    <span
      style={{
        display: "inline-block",
        scale: `1 ${squash}`,
        transformOrigin: "50% 100%",
      }}
    >
      <Sound name="mouse-click" at={landAt} volume={0.26} />
      <Reel position={position} width={digit} />
    </span>
  );
};
