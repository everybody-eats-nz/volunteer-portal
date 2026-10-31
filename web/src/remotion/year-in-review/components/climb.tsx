import type { CSSProperties } from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { formatNumber } from "../theme";
import { clamp, useSquash } from "./motion";
import { Sound } from "./sound";

/** Races off the mark, then brakes hard into the landed figure. */
const climb = Easing.bezier(0.12, 0.7, 0.16, 1);

/**
 * A count climbing from zero to `value`, fast then easing in to land, the
 * figure widening as it grows. It squashes into place with a click.
 */
export const Climb = ({
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
  const current = Math.round(
    interpolate(frame, [start * fps, land * fps], [0, value], {
      ...clamp,
      easing: climb,
    })
  );
  const squash = useSquash(land, 0.16);

  return (
    <span
      style={{
        display: "inline-block",
        ...style,
        // After `style`: display styles balance lines, and a number must
        // never break.
        textWrap: "nowrap",
        fontVariantNumeric: "lining-nums tabular-nums",
        opacity: frame < start * fps ? 0 : 1,
        scale: `1 ${squash}`,
        transformOrigin: "left bottom",
      }}
    >
      <Sound name="mouse-click" at={land} volume={0.3} />
      {formatNumber(current)}
    </span>
  );
};
