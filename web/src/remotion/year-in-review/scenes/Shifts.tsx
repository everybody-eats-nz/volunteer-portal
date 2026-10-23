import { CountUp, Rise, Scene } from "../components/motion";
import { body, display, lead } from "../components/type";
import type { YearInReviewProps } from "../schema";
import { colors, formatNumber } from "../theme";

const firstShiftDate = new Intl.DateTimeFormat("en-NZ", {
  day: "numeric",
  month: "long",
  timeZone: "Pacific/Auckland",
});

export const Shifts = ({ shifts }: YearInReviewProps) => {
  const { first } = shifts;
  const where = first.location ? ` in ${first.location}` : "";

  return (
    <Scene
      background={colors.sun}
      color={colors.forest700}
      style={{ justifyContent: "center" }}
    >
      <Rise delay={0.1}>
        <div style={lead}>You turned up for</div>
      </Rise>
      <Rise delay={0.3} distance={140}>
        <div style={display(shifts.completed >= 100 ? 470 : 600)}>
          <CountUp value={shifts.completed} delay={0.3} />
        </div>
      </Rise>
      <Rise delay={0.6}>
        <div style={display(150)}>
          {shifts.completed === 1 ? "shift" : "shifts"}
        </div>
      </Rise>
      <Rise delay={1.8} style={{ marginTop: 96 }}>
        <div style={{ ...body, fontWeight: 700 }}>
          That&apos;s {formatNumber(shifts.hours)} hours of mahi.
        </div>
      </Rise>
      <Rise delay={2.2} style={{ marginTop: 24 }}>
        <div style={body}>
          It all started on {firstShiftDate.format(new Date(first.date))} with
          a {first.role} shift{where}.
        </div>
      </Rise>
    </Scene>
  );
};
