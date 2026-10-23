import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, Rise, Scene, Words } from "../components/motion";
import { Sound } from "../components/sound";
import { body, display } from "../components/type";
import type { YearInReviewProps } from "../schema";
import { fitFontSize, layout } from "../theme";

const COUNT_FROM = 0.3;
const COUNT_SECONDS = 1.3;
const LANDED = COUNT_FROM + COUNT_SECONDS;

const MAX_SIZE = 560;

/**
 * Counts down from 100%, slowing as it closes in on their rank. Each value
 * is set as large as fits, so the number swells as it shrinks.
 */
const Countdown = ({ to }: { readonly to: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const value = Math.round(
    interpolate(frame, [COUNT_FROM * fps, LANDED * fps], [100, to], {
      ...clamp,
      easing: Easing.bezier(0.1, 0.8, 0.2, 1),
    })
  );
  return (
    <span
      style={{
        ...display(fitFontSize(`${value}%`, MAX_SIZE, undefined, 0.5)),
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {value}
      {/* Fraunces' light % is as tall as the figures; set it smaller. */}
      <span style={{ fontSize: "0.5em", marginLeft: "0.04em" }}>%</span>
    </span>
  );
};

export const TopPercent = ({ topPercent }: YearInReviewProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rank = topPercent ?? 0;

  return (
    <Scene
      id="topPercent"
      style={{
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
      }}
    >
      <Words
        text={["You're in the", { italic: "top" }]}
        delay={0.1}
        style={display(140)}
      />
      <div
        style={{
          // Sized for the largest the countdown gets, so nothing around it
          // moves as the number grows.
          height: MAX_SIZE * 0.92,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          marginTop: 24,
          width: layout.width - layout.gutter * 2,
          // A thump as the number lands.
          scale: interpolate(
            frame,
            [LANDED * fps - 4, LANDED * fps, LANDED * fps + 8],
            [1, 1.08, 1],
            clamp
          ),
        }}
      >
        <Countdown to={rank} />
      </div>
      <Sound name="ding" at={LANDED} volume={0.4} />
      <Rise delay={LANDED} style={{ marginTop: 40 }}>
        <div style={{ ...body, fontSize: 50, fontWeight: 500 }}>
          of Everybody Eats volunteers for shifts this year.
        </div>
      </Rise>
    </Scene>
  );
};
