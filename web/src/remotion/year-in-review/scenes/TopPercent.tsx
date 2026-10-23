import { CountUp, Rise, Scene } from "../components/motion";
import { body, display } from "../components/type";
import type { YearInReviewProps } from "../schema";
import { colors, fitFontSize } from "../theme";

export const TopPercent = ({ topPercent }: YearInReviewProps) => (
  <Scene
    background={colors.sun}
    color={colors.forest700}
    style={{ justifyContent: "center" }}
  >
    <Rise delay={0.1}>
      <div style={display(130)}>You&apos;re in the top</div>
    </Rise>
    <Rise delay={0.35} distance={160}>
      <div
        style={display(fitFontSize(`${topPercent}%`, 560, undefined, 0.58))}
      >
        <CountUp value={topPercent ?? 0} delay={0.35} duration={1} suffix="%" />
      </div>
    </Rise>
    <Rise delay={1.2} style={{ marginTop: 24 }}>
      <div style={{ ...body, fontSize: 54, fontWeight: 700 }}>
        of Everybody Eats volunteers for shifts this year.
      </div>
    </Rise>
  </Scene>
);
