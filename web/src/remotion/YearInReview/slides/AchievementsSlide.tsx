import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { BRAND_COLORS, BRAND_FONTS, SPRING_CONFIG, type YearStats } from "../types";

export const AchievementsSlide: React.FC<YearStats> = ({ achievementsUnlocked, volunteerGrade }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = spring({
    frame,
    fps,
    config: SPRING_CONFIG,
  });

  // Main badge animation
  const badgeScale = spring({
    frame: frame - 15,
    fps,
    config: { damping: 10, stiffness: 400, mass: 1 },
  });

  // Number count-up animation
  const count = interpolate(
    spring({
      frame: frame - 20,
      fps,
      config: { damping: 20, stiffness: 100 },
    }),
    [0, 1],
    [0, achievementsUnlocked]
  );

  // Grade badge animation
  const gradeOpacity = spring({
    frame: frame - 40,
    fps,
    config: SPRING_CONFIG,
  });

  // Get grade details
  const getGradeInfo = (grade: string) => {
    switch (grade) {
      case "PINK":
        return { emoji: "🌸", name: "Pink", color: "#ec4899" };
      case "YELLOW":
        return { emoji: "⭐", name: "Yellow", color: "#f59e0b" };
      case "GREEN":
      default:
        return { emoji: "🌿", name: "Green", color: "#10b981" };
    }
  };

  const gradeInfo = getGradeInfo(volunteerGrade);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BRAND_COLORS.background,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "120px 80px",
      }}
    >
      {/* Sparkle effects */}
      {[...Array(8)].map((_, i) => {
        const angle = (i * 45 * Math.PI) / 180;
        const distance = 300;
        const sparkleOpacity = spring({
          frame: frame - 25 - i * 3,
          fps,
          config: { damping: 15, stiffness: 300 },
        });

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              fontSize: 48,
              opacity: sparkleOpacity * 0.6,
              transform: `translate(${Math.cos(angle) * distance * sparkleOpacity}px, ${Math.sin(angle) * distance * sparkleOpacity}px)`,
            }}
          >
            ✨
          </div>
        );
      })}

      {/* Title */}
      <h2
        style={{
          fontFamily: BRAND_FONTS.accent,
          fontSize: 64,
          fontWeight: "bold",
          color: BRAND_COLORS.text,
          marginBottom: 100,
          opacity: titleOpacity,
          letterSpacing: "-0.02em",
        }}
      >
        Achievements Unlocked
      </h2>

      {/* Main Achievement Badge */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 30,
          marginBottom: 80,
          transform: `scale(${badgeScale})`,
        }}
      >
        <div
          style={{
            fontSize: 200,
            lineHeight: 1,
          }}
        >
          🏆
        </div>
        <div
          style={{
            fontFamily: BRAND_FONTS.accent,
            fontSize: 180,
            fontWeight: "bold",
            color: BRAND_COLORS.accent,
            lineHeight: 1,
          }}
        >
          {Math.round(count)}
        </div>
        <div
          style={{
            fontFamily: BRAND_FONTS.sans,
            fontSize: 48,
            color: BRAND_COLORS.textMuted,
            textAlign: "center",
          }}
        >
          New achievements in {new Date().getFullYear()}
        </div>
      </div>

      {/* Volunteer Grade Badge */}
      <div
        style={{
          backgroundColor: BRAND_COLORS.cardBg,
          border: `3px solid ${gradeInfo.color}`,
          borderRadius: 24,
          padding: "30px 60px",
          display: "flex",
          alignItems: "center",
          gap: 30,
          opacity: gradeOpacity,
          transform: `translateY(${(1 - gradeOpacity) * 20}px)`,
        }}
      >
        <div style={{ fontSize: 64 }}>{gradeInfo.emoji}</div>
        <div>
          <div style={{ fontFamily: BRAND_FONTS.sans, fontSize: 40, color: BRAND_COLORS.textMuted, marginBottom: 8 }}>
            Volunteer Grade
          </div>
          <div
            style={{
              fontFamily: BRAND_FONTS.accent,
              fontSize: 56,
              fontWeight: "bold",
              color: gradeInfo.color,
              lineHeight: 1,
            }}
          >
            {gradeInfo.name}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
