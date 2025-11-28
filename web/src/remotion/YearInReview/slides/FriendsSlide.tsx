import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { BRAND_COLORS, BRAND_FONTS, SPRING_CONFIG, type YearStats } from "../types";

export const FriendsSlide: React.FC<YearStats> = ({ friendsMade }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = spring({
    frame,
    fps,
    config: SPRING_CONFIG,
  });

  const heartScale = spring({
    frame: frame - 15,
    fps,
    config: { damping: 10, stiffness: 400 },
  });

  const cardOpacity = spring({
    frame: frame - 25,
    fps,
    config: SPRING_CONFIG,
  });

  // Floating hearts animation
  const floatingHearts = [...Array(6)].map((_, i) => {
    const heartOpacity = spring({
      frame: (frame - 10 - i * 8) % 60,
      fps,
      config: { damping: 15, stiffness: 200 },
    });

    return {
      opacity: heartOpacity,
      x: 150 + i * 120,
      y: -heartOpacity * 100,
      scale: 1 - i * 0.1,
    };
  });

  const getMessage = (count: number) => {
    if (count === 0) return "Making connections is part of the journey";
    if (count === 1) return "One new friendship formed";
    if (count < 5) return "Building your community";
    return "Growing your volunteer family";
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
      {/* Floating hearts */}
      {floatingHearts.map((heart, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: heart.x,
            bottom: "40%",
            fontSize: 60 * heart.scale,
            opacity: heart.opacity * 0.3,
            transform: `translateY(${heart.y}px) scale(${heart.scale})`,
          }}
        >
          💚
        </div>
      ))}

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
        Community Connections
      </h2>

      {/* Main Display */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 50,
          transform: `scale(${heartScale})`,
        }}
      >
        {/* Icon */}
        <div
          style={{
            fontSize: 180,
            lineHeight: 1,
          }}
        >
          💚
        </div>

        {/* Number */}
        <div
          style={{
            fontFamily: BRAND_FONTS.accent,
            fontSize: 200,
            fontWeight: "bold",
            color: BRAND_COLORS.accent,
            lineHeight: 1,
          }}
        >
          {friendsMade}
        </div>

        {/* Label */}
        <div
          style={{
            fontFamily: BRAND_FONTS.sans,
            fontSize: 48,
            color: BRAND_COLORS.textMuted,
            textAlign: "center",
          }}
        >
          {friendsMade === 1 ? "New Friend Made" : "New Friends Made"}
        </div>
      </div>

      {/* Message Card */}
      <div
        style={{
          marginTop: 80,
          padding: "30px 60px",
          borderRadius: 24,
          backgroundColor: BRAND_COLORS.cardBg,
          border: `2px solid ${BRAND_COLORS.accent}`,
          opacity: cardOpacity,
          transform: `translateY(${(1 - cardOpacity) * 20}px)`,
        }}
      >
        <p
          style={{
            fontFamily: BRAND_FONTS.sans,
            fontSize: 38,
            color: BRAND_COLORS.text,
            margin: 0,
            textAlign: "center",
            maxWidth: 700,
          }}
        >
          {getMessage(friendsMade)}
        </p>
      </div>
    </AbsoluteFill>
  );
};
