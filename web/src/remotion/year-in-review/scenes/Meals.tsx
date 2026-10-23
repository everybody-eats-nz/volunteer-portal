import { Img, staticFile } from "remotion";
import { CountUp, Drift, Rise, Scene } from "../components/motion";
import { body, display, lead } from "../components/type";
import type { YearInReviewProps } from "../schema";
import { colors, fitFontSize, formatNumber, layout } from "../theme";

// The kawakawa illustration is 1316 x 484; shown a little wider than the
// frame so it can drift without revealing an edge. WebP rather than the
// site's AVIF, which the iOS WebView the app plays the video in fails to
// decode.
const BAND_WIDTH = 1500;
const BAND_HEIGHT = Math.round((BAND_WIDTH / 1316) * 484);

export const Meals = ({ impact }: YearInReviewProps) => (
  <Scene background={colors.cream} color={colors.forest700}>
    <Rise delay={0.1}>
      <div style={lead}>On your nights, the whānau served</div>
    </Rise>
    <Rise delay={0.3} distance={140}>
      <div
        style={{
          ...display(
            fitFontSize(formatNumber(impact.mealsServed), 400, undefined, 0.52)
          ),
          color: colors.forest500,
          marginTop: 24,
          marginBottom: 40,
        }}
      >
        <CountUp value={impact.mealsServed} delay={0.3} duration={1.8} />
      </div>
    </Rise>
    <Rise delay={0.6}>
      <div style={display(150)}>meals</div>
    </Rise>
    <Rise delay={2.2} style={{ marginTop: 72 }}>
      <div style={body}>
        That&apos;s about {formatNumber(impact.foodSavedKg)} kg of rescued food
        cooked up instead of thrown out.
      </div>
    </Rise>
    <Rise
      delay={0.9}
      distance={120}
      style={{
        position: "absolute",
        left: -layout.gutter / 2,
        bottom: 40,
      }}
    >
      <Drift pixels={BAND_WIDTH - layout.width}>
        <Img
          src={staticFile("patterns/kawakawa.webp")}
          style={{ width: BAND_WIDTH, height: BAND_HEIGHT }}
        />
      </Drift>
    </Rise>
  </Scene>
);
