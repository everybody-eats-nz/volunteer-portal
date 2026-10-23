import { Img, staticFile } from "remotion";
import { Rise, Scene } from "../components/motion";
import { display, lead } from "../components/type";
import type { YearInReviewProps } from "../schema";
import { colors, fitFontSize } from "../theme";

export const Outro = ({ firstName, year }: YearInReviewProps) => {
  const thanks = `Ngā mihi, ${firstName}`;

  return (
    <Scene
      background={colors.forest700}
      color={colors.cream}
      style={{ justifyContent: "center" }}
    >
      <Rise delay={0.1} distance={120}>
        <div style={display(fitFontSize(thanks, 140, undefined, 0.5, 104))}>
          {thanks}
        </div>
      </Rise>
      <Rise delay={0.6} style={{ marginTop: 40 }}>
        <div style={{ ...lead, color: colors.forest200 }}>
          See you in the kitchen in {year + 1}.
        </div>
      </Rise>
      <Rise delay={1.2} distance={40} style={{ marginTop: 160 }}>
        <Img src={staticFile("logo.svg")} style={{ width: 360 }} />
        <div style={{ ...lead, color: colors.sun, marginTop: 28 }}>
          everybodyeats.nz
        </div>
      </Rise>
    </Scene>
  );
};
