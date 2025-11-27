import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { BRAND_COLORS, SPRING_CONFIG, type YearStats } from "../types";

export const OutroSlide: React.FC<YearStats> = ({ userName, year }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = spring({
    frame,
    fps,
    config: SPRING_CONFIG,
  });

  const heartScale = spring({
    frame: frame - 15,
    fps,
    config: { damping: 10, stiffness: 400 },
  });

  const textSlide = interpolate(fadeIn, [0, 1], [30, 0]);

  // Floating hearts animation
  const floatingHearts = [...Array(12)].map((_, i) => {
    const delay = i * 4;
    const heartAnimation = spring({
      frame: frame - delay,
      fps,
      config: { damping: 15, stiffness: 200 },
    });

    const angle = (i * 30 * Math.PI) / 180;
    const distance = 400;

    return {
      opacity: heartAnimation * 0.4,
      x: Math.cos(angle) * distance * heartAnimation,
      y: Math.sin(angle) * distance * heartAnimation,
      scale: 0.6 + heartAnimation * 0.4,
      rotation: heartAnimation * 360,
    };
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
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background gradient effect */}
      <div
        style={{
          position: "absolute",
          width: 800,
          height: 800,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${BRAND_COLORS.primary}20, transparent 70%)`,
          opacity: fadeIn,
        }}
      />

      {/* Floating hearts */}
      {floatingHearts.map((heart, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            fontSize: 60 * heart.scale,
            opacity: heart.opacity,
            transform: `translate(${heart.x}px, ${heart.y}px) rotate(${heart.rotation}deg)`,
          }}
        >
          💚
        </div>
      ))}

      {/* Main content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 60,
          zIndex: 1,
          opacity: fadeIn,
          transform: `translateY(${textSlide}px)`,
        }}
      >
        {/* Heart icon */}
        <div
          style={{
            fontSize: 180,
            lineHeight: 1,
            transform: `scale(${heartScale})`,
          }}
        >
          💚
        </div>

        {/* Thank you message */}
        <h1
          style={{
            fontSize: 80,
            fontWeight: "bold",
            color: BRAND_COLORS.text,
            textAlign: "center",
            lineHeight: 1.2,
            margin: 0,
          }}
        >
          Thank You, {userName}!
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontSize: 44,
            color: BRAND_COLORS.textMuted,
            textAlign: "center",
            maxWidth: 800,
            lineHeight: 1.4,
            margin: 0,
          }}
        >
          Your dedication made {year} extraordinary for our community
        </p>

        {/* Call to action */}
        <div
          style={{
            marginTop: 60,
            padding: "35px 70px",
            borderRadius: 50,
            background: `linear-gradient(135deg, ${BRAND_COLORS.primary}, ${BRAND_COLORS.primaryLight})`,
            boxShadow: `0 10px 40px ${BRAND_COLORS.primary}40`,
          }}
        >
          <p
            style={{
              fontSize: 40,
              fontWeight: "bold",
              color: "#ffffff",
              margin: 0,
              textAlign: "center",
            }}
          >
            Let's make next year even better! 🌟
          </p>
        </div>
      </div>

      {/* Footer branding */}
      <div
        style={{
          position: "absolute",
          bottom: 80,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
          opacity: fadeIn * 0.7,
          zIndex: 1,
        }}
      >
        <div
          style={{
            fontSize: 42,
            fontWeight: "bold",
            color: BRAND_COLORS.primary,
          }}
        >
          Everybody Eats
        </div>
        <div
          style={{
            fontSize: 28,
            color: BRAND_COLORS.textMuted,
          }}
        >
          Nourishing communities, one meal at a time
        </div>
      </div>
    </AbsoluteFill>
  );
};
