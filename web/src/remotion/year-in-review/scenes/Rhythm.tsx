import { Grow, Rise, Scene } from "../components/motion";
import { body, display } from "../components/type";
import type { YearInReviewProps } from "../schema";
import { colors, fonts, MONTHS, WEEKDAYS } from "../theme";

const CHART_HEIGHT = 380;

export const Rhythm = ({ rhythm }: YearInReviewProps) => {
  const busiest = Math.max(...rhythm.months, 1);
  const busiestCount = rhythm.months[rhythm.busiestMonth];

  return (
    <Scene background={colors.forest500} color={colors.cream}>
      <Rise delay={0.1} distance={120}>
        <div style={display(150)}>
          {WEEKDAYS[rhythm.favouriteWeekday]}s were your night
        </div>
      </Rise>
      <Rise delay={0.6} style={{ marginTop: 36 }}>
        <div style={{ ...body, color: colors.forest200 }}>
          {rhythm.favouriteWeekdayCount} of your shifts landed on a{" "}
          {WEEKDAYS[rhythm.favouriteWeekday]}.
        </div>
      </Rise>
      <div style={{ flex: 1 }} />
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 14,
          height: CHART_HEIGHT,
        }}
      >
        {rhythm.months.map((count, month) => (
          <div
            key={MONTHS[month]}
            style={{
              flex: 1,
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: 16,
            }}
          >
            <Grow
              delay={1 + month * 0.05}
              style={{
                width: "100%",
                // An empty month still shows a sliver so the year reads whole.
                height: Math.max(8, (count / busiest) * (CHART_HEIGHT - 60)),
                borderRadius: 14,
                backgroundColor:
                  month === rhythm.busiestMonth
                    ? colors.sun
                    : "rgba(155, 189, 160, 0.45)",
              }}
            />
            <div
              style={{
                fontFamily: fonts.body,
                fontWeight: 700,
                fontSize: 34,
                color:
                  month === rhythm.busiestMonth ? colors.sun : colors.forest200,
              }}
            >
              {MONTHS[month][0]}
            </div>
          </div>
        ))}
      </div>
      <Rise delay={2.2} style={{ marginTop: 48 }}>
        <div style={{ ...body, fontWeight: 700 }}>
          {MONTHS[rhythm.busiestMonth]} was your busiest month, with{" "}
          {busiestCount} {busiestCount === 1 ? "shift" : "shifts"}.
        </div>
      </Rise>
    </Scene>
  );
};
