import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  Img,
  staticFile,
} from "remotion";
import {
  BRAND_COLORS,
  BRAND_FONTS,
  SPRING_CONFIG,
  type YearStats,
} from "../types";

export const IntroSlide: React.FC<YearStats> = ({ userName, year }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Fade in animation
  const fadeIn = spring({
    frame,
    fps,
    config: SPRING_CONFIG,
  });

  // Scale animation for year
  const yearScale = spring({
    frame: frame - 20,
    fps,
    config: { ...SPRING_CONFIG, damping: 10, stiffness: 300 },
  });

  // Slide up animation for text
  const slideUp = interpolate(fadeIn, [0, 1], [40, 0]);

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
      {/* Decorative circle background */}
      <div
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${BRAND_COLORS.primary}15, transparent 70%)`,
          opacity: fadeIn,
        }}
      />

      {/* Main content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 40,
          opacity: fadeIn,
          transform: `translateY(${slideUp}px)`,
        }}
      >
        {/* Year Badge */}
        <div
          style={{
            fontFamily: BRAND_FONTS.accent,
            fontSize: 180,
            fontWeight: "bold",
            color: BRAND_COLORS.accent,
            letterSpacing: "-0.02em",
            lineHeight: 1,
            transform: `scale(${yearScale})`,
          }}
        >
          {year}
        </div>

        {/* Title */}
        <h1
          style={{
            fontFamily: BRAND_FONTS.accent,
            fontSize: 72,
            fontWeight: "bold",
            color: BRAND_COLORS.text,
            textAlign: "center",
            lineHeight: 1.2,
            margin: 0,
            letterSpacing: "-0.02em",
          }}
        >
          Year in Review
        </h1>

        {/* Subtitle with user name */}
        <p
          style={{
            fontFamily: BRAND_FONTS.sans,
            fontSize: 48,
            color: BRAND_COLORS.textMuted,
            textAlign: "center",
            margin: 0,
            maxWidth: 800,
          }}
        >
          {userName}'s volunteering journey
        </p>

        {/* Tagline */}
        <div
          style={{
            marginTop: 40,
            padding: "20px 40px",
            borderRadius: 50,
            backgroundColor: BRAND_COLORS.cardBg,
            border: `2px solid ${BRAND_COLORS.cardBorder}`,
          }}
        >
          <p
            style={{
              fontFamily: BRAND_FONTS.sans,
              fontSize: 32,
              color: BRAND_COLORS.text,
              margin: 0,
              fontWeight: 500,
            }}
          >
            Making a difference, one shift at a time
          </p>
        </div>
      </div>

      {/* Everybody Eats logo in corner */}
      <div
        style={{
          position: "absolute",
          bottom: 80,
          left: 80,
          opacity: fadeIn * 0.7,
        }}
      >
        <Img
          src={staticFile("logo.svg")}
          alt="Everybody Eats"
          style={{
            width: 150,
            height: "auto",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
