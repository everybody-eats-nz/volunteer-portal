import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, Pop, Rise, Scene, Words } from "../components/motion";
import { Plate } from "../components/plate";
import { Sound } from "../components/sound";
import { body, display } from "../components/type";
import type { YearInReviewProps } from "../schema";
import { colors, fitFontSize, fonts, layout, MONTHS, WEEKDAYS } from "../theme";

const CENTRE = { x: layout.width / 2, y: 1120 };
/** The plate in the middle, and where the bars start outside it. */
const PLATE = 290;
const INNER = 165;
/** The longest bar's length; the busiest month reaches this. */
const REACH = 225;
const BAR_WIDTH = 40;
const STUB = 16;
/** Seconds into the scene that January's bar starts to grow. */
const BARS_FROM = 0.75;
const BAR_STAGGER = 0.06;
const BARS_DONE = BARS_FROM + 11 * BAR_STAGGER + 0.45;

/**
 * One month's bar, radiating out from the plate at its hour on the clock
 * (January at twelve), growing outward in turn with its initial beyond it.
 */
const Bar = ({
  month,
  length,
  busiest,
}: {
  readonly month: number;
  readonly length: number;
  readonly busiest: boolean;
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
  const angle = month * 30;
  const color = busiest ? colors.sun : colors.cream;

  return (
    <div
      style={{
        position: "absolute",
        left: CENTRE.x - BAR_WIDTH / 2,
        top: CENTRE.y,
        width: BAR_WIDTH,
        // Drawn pointing up from the centre, then turned to its month.
        rotate: `${angle}deg`,
        transformOrigin: "50% 0%",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: INNER,
          width: BAR_WIDTH,
          height: length,
          borderRadius: BAR_WIDTH / 2,
          backgroundColor: color,
          opacity: busiest ? 1 : 0.55,
          transformOrigin: "50% 100%",
          scale: `1 ${grow}`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          width: BAR_WIDTH,
          bottom: INNER + REACH + 18,
          textAlign: "center",
          fontFamily: fonts.body,
          fontWeight: 700,
          fontSize: 32,
          lineHeight: 1,
          color,
          opacity: interpolate(frame, [start, start + 0.3 * fps], [0, 1], clamp),
          // Letters stay upright whichever way their bar points.
          rotate: `${-angle}deg`,
        }}
      >
        {MONTHS[month][0]}
      </div>
    </div>
  );
};

/**
 * Shifts per month as a clock of bars around a plate, the busiest in the
 * accent. An empty month keeps a stub so the year reads whole. Once every
 * bar is out, the busiest month's count is served on the plate.
 */
const MonthClock = ({ rhythm }: Pick<YearInReviewProps, "rhythm">) => {
  const most = Math.max(...rhythm.months, 1);
  const count = rhythm.months[rhythm.busiestMonth];

  return (
    <>
      {rhythm.months.map((shifts, month) => (
        <Bar
          key={MONTHS[month]}
          month={month}
          length={Math.max(STUB, (shifts / most) * REACH)}
          busiest={month === rhythm.busiestMonth}
        />
      ))}
      <Pop
        delay={BARS_DONE}
        style={{
          position: "absolute",
          left: CENTRE.x - PLATE / 2,
          top: CENTRE.y - PLATE / 2,
        }}
      >
        <Plate size={PLATE}>
          <div style={{ ...display(124), lineHeight: 1 }}>{count}</div>
          <div
            style={{
              fontFamily: fonts.body,
              fontWeight: 600,
              fontSize: 26,
              marginTop: 6,
              color: colors.forest500,
            }}
          >
            in {MONTHS[rhythm.busiestMonth]}
          </div>
        </Plate>
      </Pop>
    </>
  );
};

export const Rhythm = ({ rhythm }: YearInReviewProps) => {
  const weekday = WEEKDAYS[rhythm.favouriteWeekday];

  return (
    <Scene id="rhythm" backdrop={<MonthClock rhythm={rhythm} />}>
      {/* A note per bar as it grows, then a ting as the count is served. */}
      <Sound name="month-run" at={BARS_FROM} volume={0.35} />
      <Sound name="medal" at={BARS_DONE + 0.1} volume={0.2} />
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
    </Scene>
  );
};
