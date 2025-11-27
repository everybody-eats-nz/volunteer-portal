import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { BRAND_COLORS, SPRING_CONFIG, type YearStats } from "../types";

interface StatCardProps {
  icon: string;
  value: string | number;
  label: string;
  delay: number;
  fps: number;
  frame: number;
}

const StatCard: React.FC<StatCardProps> = ({ icon, value, label, delay, fps, frame }) => {
  const opacity = spring({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIG,
  });

  const scale = spring({
    frame: frame - delay,
    fps,
    config: { ...SPRING_CONFIG, stiffness: 250 },
  });

  return (
    <div
      style={{
        backgroundColor: BRAND_COLORS.cardBg,
        border: `2px solid ${BRAND_COLORS.cardBorder}`,
        borderRadius: 24,
        padding: "40px 50px",
        display: "flex",
        alignItems: "center",
        gap: 40,
        opacity,
        transform: `scale(${scale}) translateY(${(1 - opacity) * 20}px)`,
        minWidth: 800,
      }}
    >
      {/* Icon */}
      <div style={{ fontSize: 80, lineHeight: 1 }}>{icon}</div>

      {/* Stats */}
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 96,
            fontWeight: "bold",
            color: BRAND_COLORS.primary,
            lineHeight: 1,
            marginBottom: 12,
          }}
        >
          {typeof value === "number" ? value.toLocaleString() : value}
        </div>
        <div
          style={{
            fontSize: 36,
            color: BRAND_COLORS.textMuted,
            lineHeight: 1,
          }}
        >
          {label}
        </div>
      </div>
    </div>
  );
};

export const StatsSlide: React.FC<YearStats> = ({ totalShifts, totalHours, mealsServed }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Title animation
  const titleOpacity = spring({
    frame,
    fps,
    config: SPRING_CONFIG,
  });

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
      {/* Title */}
      <h2
        style={{
          fontSize: 64,
          fontWeight: "bold",
          color: BRAND_COLORS.text,
          marginBottom: 80,
          textAlign: "center",
          opacity: titleOpacity,
        }}
      >
        Your Impact
      </h2>

      {/* Stats Grid */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 40,
          width: "100%",
          maxWidth: 900,
        }}
      >
        <StatCard
          icon="✓"
          value={totalShifts}
          label="Shifts Completed"
          delay={10}
          fps={fps}
          frame={frame}
        />
        <StatCard
          icon="⏰"
          value={totalHours}
          label="Hours Volunteered"
          delay={20}
          fps={fps}
          frame={frame}
        />
        <StatCard
          icon="🍽️"
          value={mealsServed.toLocaleString()}
          label="Meals Helped Prepare"
          delay={30}
          fps={fps}
          frame={frame}
        />
      </div>
    </AbsoluteFill>
  );
};
