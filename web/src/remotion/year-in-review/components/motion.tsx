import type { CSSProperties, ReactNode } from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { formatNumber, layout } from "../theme";

const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

const easeOut = Easing.bezier(0.16, 1, 0.3, 1);

/** A full-bleed colour field with the shared safe-area padding. */
export const Scene = ({
  background,
  color,
  children,
  style,
}: {
  readonly background: string;
  readonly color: string;
  readonly children: ReactNode;
  readonly style?: CSSProperties;
}) => (
  <AbsoluteFill
    style={{
      backgroundColor: background,
      color,
      padding: `${layout.marginTop}px ${layout.gutter}px ${layout.marginBottom}px`,
      flexDirection: "column",
      ...style,
    }}
  >
    {children}
  </AbsoluteFill>
);

/** Rises into place and fades in, `delay` seconds into the scene. */
export const Rise = ({
  delay = 0,
  distance = 80,
  children,
  style,
}: {
  readonly delay?: number;
  readonly distance?: number;
  readonly children: ReactNode;
  readonly style?: CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = delay * fps;

  return (
    <div
      style={{
        opacity: interpolate(frame, [start, start + 0.5 * fps], [0, 1], clamp),
        translate: interpolate(
          frame,
          [start, start + 0.9 * fps],
          [`0px ${distance}px`, "0px 0px"],
          { ...clamp, easing: easeOut }
        ),
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** Springs up from nothing, for badges and avatars. */
export const Pop = ({
  delay = 0,
  children,
  style,
}: {
  readonly delay?: number;
  readonly children: ReactNode;
  readonly style?: CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({
    frame,
    fps,
    delay: delay * fps,
    config: { damping: 12, stiffness: 140 },
  });

  return (
    <div
      style={{
        opacity: interpolate(progress, [0, 0.4], [0, 1], clamp),
        scale: interpolate(progress, [0, 1], [0.4, 1]),
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** Counts up to `value`, settling with an ease-out so the end lands. */
export const CountUp = ({
  value,
  delay = 0,
  duration = 1.4,
  suffix = "",
  style,
}: {
  readonly value: number;
  readonly delay?: number;
  readonly duration?: number;
  readonly suffix?: string;
  readonly style?: CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const current = Math.round(
    interpolate(
      frame,
      [delay * fps, (delay + duration) * fps],
      [0, value],
      { ...clamp, easing: Easing.bezier(0.22, 1, 0.36, 1) }
    )
  );

  return (
    <span style={{ fontVariantNumeric: "tabular-nums", ...style }}>
      {formatNumber(current)}
      {suffix}
    </span>
  );
};

/** Grows from zero along one axis, for chart bars. */
export const Grow = ({
  delay = 0,
  axis = "y",
  style,
}: {
  readonly delay?: number;
  readonly axis?: "x" | "y";
  readonly style: CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = interpolate(
    frame,
    [delay * fps, (delay + 0.8) * fps],
    [0, 1],
    { ...clamp, easing: easeOut }
  );

  return (
    <div
      style={{
        transformOrigin: axis === "y" ? "bottom" : "left",
        scale: axis === "y" ? `1 ${progress}` : `${progress} 1`,
        ...style,
      }}
    />
  );
};

/** Slow horizontal drift, for the illustration band. */
export const Drift = ({
  pixels,
  children,
  style,
}: {
  readonly pixels: number;
  readonly children: ReactNode;
  readonly style?: CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  return (
    <div
      style={{
        translate: interpolate(
          frame,
          [0, durationInFrames],
          ["0px 0px", `${-pixels}px 0px`]
        ),
        ...style,
      }}
    >
      {children}
    </div>
  );
};
