import { Fragment, type CSSProperties, type ReactNode } from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { formatNumber, layout, sceneColors } from "../theme";
import { italic } from "./type";
import type { SceneId } from "../timeline";

export const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

/** A strong ease-out for entrances: fast off the mark, long settle. */
export const easeOut = Easing.bezier(0.22, 1, 0.36, 1);

/**
 * Seconds into a scene before its content starts moving. The scene pushes
 * up over the last ({@link push}), so entrances wait until it has mostly
 * arrived rather than playing while it's still moving.
 */
export const REVEAL_SECONDS = 0.2;

/**
 * A full-bleed colour field with the shared safe-area padding. `backdrop`
 * sits behind the content, full frame and unpadded, for scene artwork.
 */
export const Scene = ({
  id,
  backdrop,
  reveal = REVEAL_SECONDS,
  children,
  style,
}: {
  readonly id: SceneId;
  readonly backdrop?: ReactNode;
  readonly reveal?: number;
  readonly children: ReactNode;
  readonly style?: CSSProperties;
}) => {
  const { fps } = useVideoConfig();
  const { background, color } = sceneColors[id];

  return (
    <AbsoluteFill style={{ backgroundColor: background, color }}>
      <Sequence from={Math.round(reveal * fps)} layout="none">
        {backdrop && (
          <AbsoluteFill style={{ overflow: "hidden" }}>{backdrop}</AbsoluteFill>
        )}
        <AbsoluteFill
          style={{
            padding: `${layout.marginTop}px ${layout.gutter}px ${layout.marginBottom}px`,
            flexDirection: "column",
            ...style,
          }}
        >
          {children}
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};

/**
 * How far Fraunces italic ink leans past its advance. It varies by glyph (a
 * "d" leans further than an "a"); this middle value centres the names tried
 * to within a few pixels, where they sat up to 15px right before.
 */
const ITALIC_NUDGE = "0.1em";

/** A run of display text; `{ italic }` runs are set in Fraunces italic. */
export type Segment = string | { readonly italic: string };

/**
 * Display type that rises word by word out of a mask, so a short line lands
 * with weight. Words keep their own kerning; the mask leaves room for
 * Fraunces' descenders and macrons. Pass segments to set a phrase in
 * italic, the way the marketing site's headlines do:
 * `["Kia ora,", { italic: "Aroha" }]`.
 */
export const Words = ({
  text,
  delay = 0,
  stagger = 0.075,
  style,
}: {
  readonly text: string | readonly Segment[];
  readonly delay?: number;
  readonly stagger?: number;
  readonly style?: CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = (typeof text === "string" ? [text] : text).flatMap((segment) =>
    typeof segment === "string"
      ? segment.split(" ").map((word) => ({ word, slanted: false }))
      : segment.italic.split(" ").map((word) => ({ word, slanted: true }))
  );

  return (
    <div style={style}>
      {words.map(({ word, slanted }, i) => {
        const start = (delay + i * stagger) * fps;
        const progress = interpolate(
          frame,
          [start, start + 0.55 * fps],
          [0, 1],
          { ...clamp, easing: easeOut }
        );
        return (
          <Fragment key={`${word}-${i}`}>
            {i > 0 && " "}
            <span
              style={{
                display: "inline-block",
                // A polygon clip, not overflow: it reaches past the line box
                // for descenders without moving the baseline.
                clipPath: "polygon(-20% -30%, 120% -30%, 120% 125%, -20% 125%)",
                // Italic ink leans past its advance on the right, so a
                // centred line ending in italics sits right of centre. Each
                // italic word reserves the overhang on its right; one that
                // follows another italic word pulls back into the first's
                // reservation, keeping the gap between them as set.
                ...(slanted && {
                  marginLeft: words[i - 1]?.slanted ? `-${ITALIC_NUDGE}` : 0,
                  marginRight: ITALIC_NUDGE,
                }),
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  translate: `0px ${(1 - progress) * 110}%`,
                  opacity: interpolate(progress, [0, 0.5], [0, 1], clamp),
                  ...(slanted ? italic : null),
                }}
              >
                {word}
              </span>
            </span>
          </Fragment>
        );
      })}
    </div>
  );
};

/** Rises into place and fades in, `delay` seconds into the scene. */
export const Rise = ({
  delay = 0,
  distance = 48,
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
        opacity: interpolate(frame, [start, start + 0.4 * fps], [0, 1], clamp),
        translate: interpolate(
          frame,
          [start, start + 0.7 * fps],
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

/** Springs up into place, for badges and avatars. Never from nothing. */
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
    config: { damping: 12, stiffness: 150 },
  });

  return (
    <div
      style={{
        opacity: interpolate(progress, [0, 0.3], [0, 1], clamp),
        scale: interpolate(progress, [0, 1], [0.6, 1]),
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
  duration = 1.2,
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
    interpolate(frame, [delay * fps, (delay + duration) * fps], [0, value], {
      ...clamp,
      easing: easeOut,
    })
  );

  return (
    <span style={{ fontVariantNumeric: "tabular-nums", ...style }}>
      {formatNumber(current)}
      {suffix}
    </span>
  );
};

/**
 * Squashes and releases as something lands, like type set under pressure:
 * `scaleY` dips then overshoots on a lively spring. 1 before `at`.
 */
export const useSquash = (at: number, depth = 0.22): number => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({
    frame,
    fps,
    delay: at * fps,
    config: { damping: 9, stiffness: 220, mass: 0.6 },
  });
  return frame < at * fps ? 1 : 1 - depth + depth * s;
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
    [delay * fps, (delay + 0.7) * fps],
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
