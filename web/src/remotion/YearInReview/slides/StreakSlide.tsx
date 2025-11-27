import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { BRAND_COLORS, SPRING_CONFIG, type YearStats } from "../types";

export const StreakSlide: React.FC<YearStats> = ({ currentStreak }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = spring({
    frame,
    fps,
    config: SPRING_CONFIG,
  });

  const flameScale = spring({
    frame: frame - 15,
    fps,
    config: { damping: 8, stiffness: 400 },
  });

  // Count-up animation for streak number
  const count = interpolate(
    spring({
      frame: frame - 20,
      fps,
      config: { damping: 20, stiffness: 100 },
    }),
    [0, 1],
    [0, currentStreak]
  );

  const messageOpacity = spring({
    frame: frame - 35,
    fps,
    config: SPRING_CONFIG,
  });

  // Streak encouragement message
  const getStreakMessage = (streak: number) => {
    if (streak === 0) return "Start your streak in the new year!";
    if (streak < 3) return "Keep going!";
    if (streak < 6) return "You're on fire!";
    if (streak < 12) return "Incredible consistency!";
    return "Unstoppable dedication!";
  };

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
      {/* Flame effects */}
      {[...Array(5)].map((_, i) => {
        const flameOpacity = spring({
          frame: (frame - 10 - i * 5) % 30,
          fps,
          config: { damping: 10, stiffness: 200 },
        });

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${45 + i * 2.5}%`,
              bottom: "35%",
              fontSize: 80 - i * 10,
              opacity: flameOpacity * 0.4,
              transform: `translateY(${-flameOpacity * 30}px)`,
            }}
          >
            🔥
          </div>
        );
      })}

      {/* Title */}
      <h2
        style={{
          fontSize: 64,
          fontWeight: "bold",
          color: BRAND_COLORS.text,
          marginBottom: 100,
          opacity: titleOpacity,
        }}
      >
        Streak Status
      </h2>

      {/* Main Streak Display */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 40,
          transform: `scale(${flameScale})`,
        }}
      >
        <div style={{ fontSize: 200, lineHeight: 1 }}>🔥</div>

        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 20,
          }}
        >
          <div
            style={{
              fontSize: 200,
              fontWeight: "bold",
              color: BRAND_COLORS.accent,
              lineHeight: 1,
            }}
          >
            {Math.round(count)}
          </div>
          <div
            style={{
              fontSize: 56,
              color: BRAND_COLORS.textMuted,
              lineHeight: 1,
            }}
          >
            {currentStreak === 1 ? "month" : "months"}
          </div>
        </div>

        <div
          style={{
            fontSize: 40,
            color: BRAND_COLORS.text,
            textAlign: "center",
            maxWidth: 800,
          }}
        >
          Consecutive months volunteering
        </div>
      </div>

      {/* Encouragement Message */}
      <div
        style={{
          marginTop: 80,
          padding: "30px 60px",
          borderRadius: 50,
          backgroundColor: BRAND_COLORS.cardBg,
          border: `2px solid ${BRAND_COLORS.accent}`,
          opacity: messageOpacity,
          transform: `translateY(${(1 - messageOpacity) * 20}px)`,
        }}
      >
        <p
          style={{
            fontSize: 44,
            fontWeight: "bold",
            color: BRAND_COLORS.accent,
            margin: 0,
            textAlign: "center",
          }}
        >
          {getStreakMessage(currentStreak)}
        </p>
      </div>
    </AbsoluteFill>
  );
};
