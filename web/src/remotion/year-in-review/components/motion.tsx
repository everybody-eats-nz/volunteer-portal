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
import { Sound } from "./sound";
import { italic } from "./type";
import type { SceneId } from "../timeline";

export const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);

/**
 * Seconds into a scene before its content starts moving. The scene arrives
 * under a wipe ({@link bandWipe}), so its entrances wait until it's mostly
 * uncovered rather than playing out of sight.
 */
export const REVEAL_SECONDS = 0.4;

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

/** A run of display text; `{ italic }` runs are set in Fraunces italic. */
export type Segment = string | { readonly italic: string };

/**
 * Display type that rises word by word out of a mask, like lines of a menu
 * being slotted in. Words keep their own kerning; the mask leaves room for
 * Fraunces' descenders and macrons. Pass segments to set a phrase in
 * italic, the way the marketing site's headlines do:
 * `["Kia ora,", { italic: "Aroha" }]`.
 */
export const Words = ({
  text,
  delay = 0,
  stagger = 0.08,
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
          [start, start + 0.8 * fps],
          [0, 1],
          {
            ...clamp,
            easing: easeOut,
          }
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
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  translate: `0px ${(1 - progress) * 130}%`,
                  rotate: `${(1 - progress) * 8}deg`,
                  transformOrigin: "left bottom",
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

/** How far (in ems) a digit travels as it rolls off the drum. */
const DRUM_TRAVEL = 0.62;

/**
 * One digit's reel, spinning `spins` times before landing at `landAt`. Drawn
 * as a drum rather than a strip behind a window: the digits either side of
 * the current one tilt away (squashed and faded), so there's no clipped
 * edge to see, and nothing spills onto the lines around the number.
 */
const Reel = ({
  digit,
  start,
  landAt,
  spins,
}: {
  readonly digit: number;
  readonly start: number;
  readonly landAt: number;
  readonly spins: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const target = spins * 10 + digit;
  const at = (f: number) => {
    const spin = interpolate(f, [start * fps, landAt * fps], [0, target], {
      ...clamp,
      // Races, then brakes hard.
      easing: Easing.bezier(0.2, 0.6, 0.2, 1),
    });
    // Then rocks a fifth of a digit past and back, like a reel catching,
    // however many times it spun.
    const t = Math.max(0, f / fps - landAt);
    return spin + 0.2 * Math.exp(-7 * t) * Math.sin(t * 16);
  };
  const position = at(frame);
  const speed = Math.abs(position - at(frame - 1));
  const nearest = Math.floor(position);

  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      {/* A click as the reel catches. */}
      <Sound name="mouse-click" at={landAt} volume={0.3} />
      {/* Holds the landed digit's width, so the number never reflows. */}
      <span style={{ visibility: "hidden" }}>{digit}</span>
      {[nearest - 1, nearest, nearest + 1, nearest + 2].map((n) => {
        // Cells from the front of the drum: negative is above, rolling away.
        const offset = n - position;
        if (Math.abs(offset) >= 1) return null;
        return (
          <span
            key={n}
            style={{
              position: "absolute",
              left: "50%",
              top: 0,
              translate: `-50% ${offset * DRUM_TRAVEL}em`,
              scale: `1 ${Math.cos((offset * Math.PI) / 2)}`,
              opacity: 1 - Math.abs(offset),
              filter:
                speed > 0.05
                  ? `blur(${Math.min(speed, 1.5) * 0.025}em)`
                  : undefined,
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
 * A number on slot-machine reels: every digit spins at once and they land
 * left to right, so the final figure clicks into place.
 */
export const SlotNumber = ({
  value,
  grouping = true,
  delay = 0,
  duration = 1.8,
  style,
}: {
  readonly value: number;
  /** Thousands separators; off for years. */
  readonly grouping?: boolean;
  readonly delay?: number;
  readonly duration?: number;
  readonly style?: CSSProperties;
}) => {
  const characters = [...(grouping ? formatNumber(value) : String(value))];
  const digits = characters.filter((c) => /\d/.test(c)).length;
  let place = 0;

  return (
    <span
      style={{
        display: "inline-block",
        ...style,
        // After `style`: display styles balance lines, and a number must
        // never break.
        textWrap: "nowrap",
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
            start={delay}
            landAt={delay + duration * (0.55 + 0.45 * share)}
            spins={1 + order}
          />
        );
      })}
    </span>
  );
};

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
    interpolate(frame, [delay * fps, (delay + duration) * fps], [0, value], {
      ...clamp,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    })
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
