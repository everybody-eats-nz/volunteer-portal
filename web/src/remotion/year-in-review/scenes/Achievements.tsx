import { CountUp, Pop, Rise, Scene } from "../components/motion";
import { body, display, lead } from "../components/type";
import type { YearInReviewProps } from "../schema";
import { colors, fitFontSize, fonts } from "../theme";

const SHOWN = 6;

export const Achievements = ({ achievements }: YearInReviewProps) => {
  // Badges unlock in order, so the latest are the biggest milestones.
  const shown = achievements.slice(-SHOWN).reverse();
  const more = achievements.length - shown.length;
  const headline = `${achievements.length} ${
    achievements.length === 1 ? "badge" : "badges"
  }`;

  return (
    <Scene background={colors.cream} color={colors.forest700}>
      <Rise delay={0.1}>
        <div style={lead}>Ka pai! This year you unlocked</div>
      </Rise>
      <Rise delay={0.3} distance={120} style={{ marginTop: 16 }}>
        <div
          style={{
            ...display(fitFontSize(headline, 220, undefined, 0.5)),
            color: colors.forest500,
          }}
        >
          <CountUp value={achievements.length} delay={0.3} duration={1} />{" "}
          {achievements.length === 1 ? "badge" : "badges"}
        </div>
      </Rise>
      <div
        style={{
          marginTop: 64,
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 28,
        }}
      >
        {shown.map((badge, i) => (
          <Pop key={badge.name} delay={1 + i * 0.12}>
            <div
              style={{
                backgroundColor: colors.paper,
                border: "3px solid rgba(29, 83, 55, 0.15)",
                borderRadius: 36,
                height: 250,
                padding: "28px 16px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 16,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 96, lineHeight: 1 }}>{badge.icon}</div>
              <div
                style={{
                  fontFamily: fonts.body,
                  fontWeight: 700,
                  fontSize: 30,
                  lineHeight: 1.15,
                }}
              >
                {badge.name}
              </div>
            </div>
          </Pop>
        ))}
      </div>
      {more > 0 && (
        <Rise delay={2} style={{ marginTop: 40 }}>
          <div style={{ ...body, fontWeight: 700 }}>
            Plus {more} more on your profile.
          </div>
        </Rise>
      )}
    </Scene>
  );
};
