import type { ReactNode } from "react";
import {
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Rise, Scene } from "../components/motion";
import { lead } from "../components/type";
import type { YearInReviewProps } from "../schema";
import { colors, fonts, formatNumber, layout } from "../theme";

const PAPER_WIDTH = 780;
const TEAR = 22;

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

/** Feeds the docket down out of the printer slot. */
const PrintOut = ({ children }: { readonly children: ReactNode }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div
      style={{
        translate: interpolate(
          frame,
          [0.4 * fps, 2.6 * fps],
          ["0px -100%", "0px 0%"],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.33, 1, 0.68, 1),
          }
        ),
      }}
    >
      {children}
    </div>
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
      background={colors.cream}
      color={colors.forest700}
      style={{ alignItems: "center", paddingTop: layout.marginTop - 40 }}
    >
      {/* Printer slot */}
      <div
        style={{
          width: PAPER_WIDTH + 80,
          height: 36,
          borderRadius: 18,
          backgroundColor: colors.forest700,
          position: "relative",
          zIndex: 1,
        }}
      />
      <div
        style={{
          overflow: "hidden",
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
              padding: "72px 56px 56px",
              fontFamily: fonts.docket,
              fontSize: 38,
              lineHeight: 1.6,
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
            <div style={{ textAlign: "center" }}>
              Paid in full with aroha.
              <br />
              Ngā mihi for your mahi.
            </div>
          </div>
          <TornEdge />
        </PrintOut>
      </div>
      <Rise delay={3} style={{ marginTop: 32 }}>
        <div style={{ ...lead, textAlign: "center" }}>
          Share your year, and bring a mate next time.
        </div>
      </Rise>
    </Scene>
  );
};
