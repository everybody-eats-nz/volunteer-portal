import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, easeOut, Rise, Scene, Words } from "../components/motion";
import { Sound } from "../components/sound";
import { body, display } from "../components/type";
import type { YearInReviewProps } from "../schema";
import { colors, fitFontSize, fonts, layout, MONTHS, WEEKDAYS } from "../theme";

const CHART_WIDTH = layout.width - layout.gutter * 2;
const CHART_HEIGHT = 620;
const GAP = 16;
const BAR_WIDTH = (CHART_WIDTH - GAP * 11) / 12;
/** Room above the tallest bar for the busiest month's count. */
const LABEL_ROOM = 90;
/** Seconds into the scene that January's bar starts to grow. */
const BARS_FROM = 0.7;
const BAR_STAGGER = 0.06;
const BARS_DONE = BARS_FROM + 11 * BAR_STAGGER + 0.45;

/** One month's column, growing up from the baseline in turn. */
const Bar = ({
  month,
  count,
  busiest,
  height,
}: {
  readonly month: number;
  readonly count: number;
  readonly busiest: boolean;
  readonly height: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = (BARS_FROM + month * BAR_STAGGER) * fps;
  const grow = spring({
    frame,
    fps,
    delay: start,
    config: { damping: 13, stiffness: 120 },
  });
  // The busiest month's count lands once every bar is up.
  const labelAt = BARS_DONE * fps;

  return (
    <div
      style={{
        width: BAR_WIDTH,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-end",
      }}
    >
      {busiest && (
        <div
          style={{
            ...display(64),
            color: colors.sun,
            marginBottom: 18,
            opacity: interpolate(
              frame,
              [labelAt, labelAt + 0.3 * fps],
              [0, 1],
              clamp
            ),
            translate: `0px ${interpolate(
              frame,
              [labelAt, labelAt + 0.5 * fps],
              [20, 0],
              { ...clamp, easing: easeOut }
            )}px`,
          }}
        >
          {count}
        </div>
      )}
      <div
        style={{
          width: "100%",
          height,
          borderRadius: BAR_WIDTH / 2,
          backgroundColor: busiest ? colors.sun : colors.cream,
          opacity: busiest ? 1 : count === 0 ? 0.2 : 0.5,
          transformOrigin: "bottom",
          scale: `1 ${grow}`,
        }}
      />
      <div
        style={{
          fontFamily: fonts.body,
          fontWeight: 700,
          fontSize: 32,
          marginTop: 22,
          color: busiest ? colors.sun : colors.cream,
          opacity: interpolate(frame, [start, start + 0.3 * fps], [0, 1], clamp),
        }}
      >
        {MONTHS[month][0]}
      </div>
    </div>
  );
};

/**
 * Shifts per month as a row of rounded columns, the busiest in the accent
 * with its count above it. An empty month keeps a stub so the year reads
 * whole.
 */
const MonthChart = ({ rhythm }: Pick<YearInReviewProps, "rhythm">) => {
  const most = Math.max(...rhythm.months, 1);
  const tallest = CHART_HEIGHT - LABEL_ROOM - 56;

  return (
    <div
      style={{
        display: "flex",
        gap: GAP,
        width: CHART_WIDTH,
        height: CHART_HEIGHT,
      }}
    >
      {rhythm.months.map((count, month) => (
        <Bar
          key={MONTHS[month]}
          month={month}
          count={count}
          busiest={month === rhythm.busiestMonth}
          height={Math.max(BAR_WIDTH, (count / most) * tallest)}
        />
      ))}
    </div>
  );
};

export const Rhythm = ({ rhythm }: YearInReviewProps) => {
  const weekday = WEEKDAYS[rhythm.favouriteWeekday];
  const busiest = rhythm.months[rhythm.busiestMonth];

  return (
    <Scene id="rhythm">
      <Words
        text={[{ italic: `${weekday}s` }, "were your night"]}
        delay={0.05}
        style={display(fitFontSize(`${weekday}s were`, 140, undefined, 0.46))}
      />
      <Rise delay={0.5} style={{ marginTop: 24 }}>
        <div style={{ ...body, color: colors.forest200 }}>
          {rhythm.favouriteWeekdayCount} of your shifts landed on a {weekday}.
        </div>
      </Rise>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          paddingTop: 48,
          gap: 48,
        }}
      >
        <MonthChart rhythm={rhythm} />
        {/* A note per bar as it grows, then a ting for the busiest. */}
        <Sound name="month-run" at={BARS_FROM} volume={0.35} />
        <Sound name="medal" at={BARS_DONE} volume={0.2} />
        <Rise delay={BARS_DONE + 0.2}>
          <div style={{ ...body, fontWeight: 600 }}>
            {MONTHS[rhythm.busiestMonth]} was your busiest month, with{" "}
            {busiest} {busiest === 1 ? "shift" : "shifts"}.
          </div>
        </Rise>
      </div>
    </Scene>
  );
};
