import { Img, staticFile } from "remotion";
import { Rise, Scene } from "../components/motion";
import { display, lead } from "../components/type";
import type { YearInReviewProps } from "../schema";
import { colors, fitFontSize } from "../theme";

export const Intro = ({ firstName, year }: YearInReviewProps) => {
  const greeting = `Kia ora, ${firstName}`;

  return (
    <Scene background={colors.forest700} color={colors.cream}>
      <Rise delay={0.1} distance={30}>
        <Img src={staticFile("logo.svg")} style={{ width: 300 }} />
      </Rise>
      <div style={{ flex: 1 }} />
      <Rise delay={0.3}>
        <div
          style={{
            ...display(fitFontSize(greeting, 120, undefined, 0.5, 96)),
            fontWeight: 600,
          }}
        >
          {greeting}
        </div>
      </Rise>
      <Rise delay={0.8} style={{ marginTop: 48 }}>
        <div style={{ ...lead, color: colors.forest200 }}>
          Here&apos;s your year in mahi
        </div>
      </Rise>
      <Rise delay={1.1} distance={160}>
        <div
          style={{
            ...display(fitFontSize(String(year), 430, undefined, 0.6)),
            color: colors.sun,
            marginTop: 24,
          }}
        >
          {year}
        </div>
      </Rise>
    </Scene>
  );
};
