import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import {
  clamp,
  easeOut,
  Rise,
  Scene,
  useBeatPulse,
  useSquash,
  Words,
} from "../components/motion";
import { Sound } from "../components/sound";
import { body, display } from "../components/type";
import type { YearInReviewProps } from "../schema";
import { colors, fitFontSize, layout } from "../theme";
import { beats } from "../timeline";

const COUNT_FROM = 0.25;
/** The rank lands on beat two. */
const LANDED = beats(2);

const MAX_SIZE = 560;
/** Where the number sits; the rims ripple out from behind it. */
const NUMBER_CENTRE_Y = 960;
const RINGS = 3;

/**
 * Counts down from 100%, slowing as it closes in on their rank. Each value
 * is set as large as fits, so the number swells as it shrinks, then
 * squashes as it lands and breathes with the beat.
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
  const squash = useSquash(LANDED, 0.24);
  const pulse = useBeatPulse(LANDED + 0.3, 0.04);
  return (
    <span
      style={{
        ...display(fitFontSize(`${value}%`, MAX_SIZE, undefined, 0.5)),
        fontVariantNumeric: "tabular-nums",
        display: "inline-block",
        scale: `${pulse} ${squash * pulse}`,
        transformOrigin: "50% 100%",
      }}
    >
      {value}
      {/* Fraunces' light % is as tall as the figures; set it smaller. */}
      <span style={{ fontSize: "0.5em", marginLeft: "0.04em" }}>%</span>
    </span>
  );
};

/** Plate rims rippling out from the number as it lands. */
const Ripples = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <>
      {Array.from({ length: RINGS }, (_, i) => {
        const start = (LANDED + i * 0.14) * fps;
        const progress = interpolate(frame, [start, start + 1.3 * fps], [0, 1], {
          ...clamp,
          easing: easeOut,
        });
        if (progress === 0) return null;
        const radius = 120 + progress * 900;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: layout.width / 2 - radius,
              top: NUMBER_CENTRE_Y - radius,
              width: radius * 2,
              height: radius * 2,
              borderRadius: "50%",
              border: `${14 - i * 3}px solid ${colors.paper}`,
              opacity: (1 - progress) * 0.9,
            }}
          />
        );
      })}
    </>
  );
};

export const TopPercent = ({ topPercent }: YearInReviewProps) => {
  const rank = topPercent ?? 0;

  return (
    <Scene
      id="topPercent"
      backdrop={<Ripples />}
      style={{
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
      }}
    >
      <Words
        text={["You're in the", { italic: "top" }]}
        delay={0.05}
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
