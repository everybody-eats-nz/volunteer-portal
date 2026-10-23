import type { ReactNode } from "react";
import {
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { clamp, Rise, Scene } from "../components/motion";
import { Sound } from "../components/sound";
import { lead } from "../components/type";
import type { YearInReviewProps } from "../schema";
import { colors, fonts, formatNumber, layout } from "../theme";

const PAPER_WIDTH = 780;
const TEAR = 22;
/** Seconds into the scene: the printer feeds the docket, then it's stamped. */
const PRINT_FROM = 0.2;
const PRINT_TO = 2.6;
const STAMP_AT = 3;
/** Lines of paper the printer feeds per jerk. */
const FEED_STEPS = 16;

/** Saw-tooth bottom edge, like paper torn off a docket printer. */
const tornEdgePoints = (() => {
  const teeth = Math.ceil(PAPER_WIDTH / TEAR);
  const points = ["0,0"];
  for (let i = 0; i <= teeth; i++) {
    points.push(`${Math.min(i * TEAR, PAPER_WIDTH)},${i % 2 === 0 ? 0 : TEAR}`);
  }
  points.push(`${PAPER_WIDTH},0`);
  return points.join(" ");
})();

const TornEdge = () => (
  <svg
    width={PAPER_WIDTH}
    height={TEAR}
    viewBox={`0 0 ${PAPER_WIDTH} ${TEAR}`}
    style={{ display: "block" }}
  >
    <polygon points={tornEdgePoints} fill={colors.paper} />
  </svg>
);

/**
 * Feeds the docket down out of the printer slot in short jerks, the way a
 * thermal printer advances, then jolts when the stamp comes down.
 */
/** How many steps of paper have fed out by `frame`, fractional. */
const fedAt = (frame: number, fps: number) =>
  interpolate(frame, [PRINT_FROM * fps, PRINT_TO * fps], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.33, 1, 0.68, 1),
  }) * FEED_STEPS;

/** The printer's motor buzzing once per feed step, in time with the paper. */
const PrinterSounds = () => {
  const { fps } = useVideoConfig();
  // A step starts moving as the feed crosses each whole step; the last
  // crossing is the paper coming to rest, not another step.
  const starts = [PRINT_FROM * fps];
  for (let frame = PRINT_FROM * fps + 1; frame <= PRINT_TO * fps; frame++) {
    if (Math.floor(fedAt(frame, fps)) > Math.floor(fedAt(frame - 1, fps))) {
      starts.push(frame);
    }
  }
  return (
    <>
      {starts.slice(0, FEED_STEPS).map((frame) => (
        <Sound key={frame} name="printer-step" at={frame / fps} volume={0.3} />
      ))}
    </>
  );
};

const PrintOut = ({ children }: { readonly children: ReactNode }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fed = fedAt(frame, fps);
  // Each step moves in its first 40%, then the paper rests.
  const step = Math.floor(fed);
  const stepped =
    fed >= FEED_STEPS
      ? 1
      : (step + Math.min(1, (fed - step) / 0.4)) / FEED_STEPS;
  const jolt = interpolate(
    frame,
    [STAMP_AT * fps, STAMP_AT * fps + 2, STAMP_AT * fps + 6],
    [0, 14, 0],
    clamp
  );

  return (
    <div
      style={{
        translate: `0px calc(${(stepped - 1) * 100}% + ${jolt}px)`,
      }}
    >
      {children}
    </div>
  );
};

/** A rubber stamp slammed onto the docket once it has printed. */
const Stamp = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const hit = interpolate(frame, [STAMP_AT * fps - 5, STAMP_AT * fps], [0, 1], {
    ...clamp,
    easing: Easing.in(Easing.cubic),
  });
  if (hit === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        // In the blank tail of the docket, clear of every figure.
        right: 90,
        bottom: TEAR + 44,
        rotate: "-9deg",
        scale: interpolate(hit, [0, 1], [2.6, 1]),
        opacity: interpolate(hit, [0, 1], [0, 0.88]),
        mixBlendMode: "multiply",
        color: colors.forest500,
        border: `9px double ${colors.forest500}`,
        borderRadius: 22,
        padding: "14px 30px 18px",
        textAlign: "center",
        fontFamily: fonts.body,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        lineHeight: 1,
      }}
    >
      <div style={{ fontSize: 30 }}>Paid in</div>
      <div style={{ fontSize: 88, marginTop: 6 }}>Aroha</div>
    </div>
  );
};

/** The printer's status light: blinks while printing, then holds. */
const StatusLight = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const printing = frame < PRINT_TO * fps;
  return (
    <div
      style={{
        position: "absolute",
        right: 44,
        top: 22,
        width: 18,
        height: 18,
        borderRadius: "50%",
        backgroundColor: colors.sun,
        opacity: printing && Math.floor(frame / 6) % 2 === 0 ? 0.35 : 1,
        boxShadow: `0 0 18px ${colors.sun}`,
      }}
    />
  );
};

const Line = ({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) => (
  <div style={{ display: "flex", gap: 24, justifyContent: "space-between" }}>
    <span style={{ flexShrink: 0 }}>{label}</span>
    <span style={{ textAlign: "right", fontWeight: 500 }}>{value}</span>
  </div>
);

const Rule = () => (
  <div
    style={{
      borderTop: `3px dashed ${colors.ink}`,
      opacity: 0.35,
      margin: "28px 0",
    }}
  />
);

export const Docket = (props: YearInReviewProps) => {
  const { year, firstName, shifts, impact, roles, locations, achievements } =
    props;

  return (
    <Scene
      id="docket"
      style={{ alignItems: "center", paddingTop: layout.marginTop - 40 }}
    >
      <PrinterSounds />
      <Sound name="stamp" at={STAMP_AT} volume={0.55} />
      {/* The docket printer, its slot along the bottom edge */}
      <div
        style={{
          width: PAPER_WIDTH + 100,
          height: 64,
          borderRadius: "22px 22px 30px 30px",
          backgroundColor: colors.forest700,
          position: "relative",
          zIndex: 1,
          boxShadow: "0 10px 0 rgba(14, 42, 28, 0.25)",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 50,
            right: 50,
            bottom: 14,
            height: 8,
            borderRadius: 4,
            backgroundColor: colors.ink,
          }}
        />
        <StatusLight />
      </div>
      <div
        style={{
          overflow: "hidden",
          // A long docket overflows rather than being squeezed and clipped.
          flexShrink: 0,
          marginTop: -18,
          padding: "0 40px 48px",
          // A drop-shadow filter follows the torn edge; box-shadow can't.
          filter: "drop-shadow(0 16px 24px rgba(14, 42, 28, 0.16))",
        }}
      >
        <PrintOut>
          <div
            style={{
              width: PAPER_WIDTH,
              backgroundColor: colors.paper,
              color: colors.ink,
              // A long tail of blank paper below the total, for the stamp.
              padding: "64px 56px 210px",
              fontFamily: fonts.mono,
              fontSize: 35,
              lineHeight: 1.5,
            }}
          >
            <div style={{ textAlign: "center" }}>
              <Img
                src={staticFile("everybody-eats-logo.svg")}
                style={{ width: 300 }}
              />
              <div style={{ marginTop: 24 }}>Year in mahi {year}</div>
              <div>Table for {firstName}</div>
            </div>
            <Rule />
            <Line label="Shifts" value={formatNumber(shifts.completed)} />
            <Line label="Hours" value={formatNumber(shifts.hours)} />
            {impact.mealsServed > 0 && (
              <Line
                label="Meals on your nights"
                value={formatNumber(impact.mealsServed)}
              />
            )}
            {roles[0] && <Line label="Go-to role" value={roles[0].name} />}
            {locations[0] && (
              <Line label="Home kitchen" value={locations[0].name} />
            )}
            {achievements.length > 0 && (
              <Line label="Badges" value={formatNumber(achievements.length)} />
            )}
            <Rule />
            <div style={{ textAlign: "center" }}>Ngā mihi for your mahi.</div>
          </div>
          <TornEdge />
          <Stamp />
        </PrintOut>
      </div>
      <Rise delay={STAMP_AT + 0.5} style={{ marginTop: 32 }}>
        <div style={{ ...lead, textAlign: "center" }}>
          Share your year, and bring a mate next time.
        </div>
      </Rise>
    </Scene>
  );
};
