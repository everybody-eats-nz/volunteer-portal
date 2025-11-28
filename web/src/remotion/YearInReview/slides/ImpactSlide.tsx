import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { BRAND_COLORS, BRAND_FONTS, SPRING_CONFIG, type YearStats } from "../types";

export const ImpactSlide: React.FC<YearStats> = ({
  foodWasteKg,
  locationsVisited,
  favoriteShiftType,
  busiestMonth,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = spring({
    frame,
    fps,
    config: SPRING_CONFIG,
  });

  const card1 = spring({
    frame: frame - 10,
    fps,
    config: SPRING_CONFIG,
  });

  const card2 = spring({
    frame: frame - 20,
    fps,
    config: SPRING_CONFIG,
  });

  const card3 = spring({
    frame: frame - 30,
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
          fontFamily: BRAND_FONTS.accent,
          fontSize: 64,
          fontWeight: "bold",
          color: BRAND_COLORS.text,
          marginBottom: 80,
          opacity: titleOpacity,
          letterSpacing: "-0.02em",
        }}
      >
        Community Impact
      </h2>

      {/* Impact Grid */}
      <div style={{ display: "flex", flexDirection: "column", gap: 40, width: "100%", maxWidth: 900 }}>
        {/* Food Waste Prevented */}
        <div
          style={{
            backgroundColor: BRAND_COLORS.cardBg,
            border: `2px solid ${BRAND_COLORS.cardBorder}`,
            borderRadius: 24,
            padding: "50px 60px",
            textAlign: "center",
            opacity: card1,
            transform: `scale(${card1})`,
          }}
        >
          <div style={{ fontSize: 72, marginBottom: 20 }}>🌱</div>
          <div
            style={{
              fontFamily: BRAND_FONTS.accent,
              fontSize: 96,
              fontWeight: "bold",
              color: BRAND_COLORS.accent,
              marginBottom: 12,
            }}
          >
            {foodWasteKg.toLocaleString()} kg
          </div>
          <div style={{ fontFamily: BRAND_FONTS.sans, fontSize: 36, color: BRAND_COLORS.textMuted }}>
            Food Waste Prevented
          </div>
        </div>

        {/* Grid Row */}
        <div style={{ display: "flex", gap: 40 }}>
          {/* Locations */}
          <div
            style={{
              flex: 1,
              backgroundColor: BRAND_COLORS.cardBg,
              border: `2px solid ${BRAND_COLORS.cardBorder}`,
              borderRadius: 24,
              padding: "40px",
              textAlign: "center",
              opacity: card2,
              transform: `scale(${card2})`,
            }}
          >
            <div style={{ fontSize: 64, marginBottom: 20 }}>📍</div>
            <div
              style={{
                fontFamily: BRAND_FONTS.accent,
                fontSize: 72,
                fontWeight: "bold",
                color: BRAND_COLORS.accent,
                marginBottom: 12,
              }}
            >
              {locationsVisited.length}
            </div>
            <div style={{ fontFamily: BRAND_FONTS.sans, fontSize: 32, color: BRAND_COLORS.textMuted }}>
              Locations
            </div>
            <div style={{ fontFamily: BRAND_FONTS.sans, fontSize: 24, color: BRAND_COLORS.textMuted, marginTop: 12 }}>
              {locationsVisited.join(", ")}
            </div>
          </div>

          {/* Favorite Shift */}
          <div
            style={{
              flex: 1,
              backgroundColor: BRAND_COLORS.cardBg,
              border: `2px solid ${BRAND_COLORS.cardBorder}`,
              borderRadius: 24,
              padding: "40px",
              textAlign: "center",
              opacity: card3,
              transform: `scale(${card3})`,
            }}
          >
            <div style={{ fontSize: 64, marginBottom: 20 }}>⭐</div>
            <div
              style={{
                fontFamily: BRAND_FONTS.accent,
                fontSize: 40,
                fontWeight: "bold",
                color: BRAND_COLORS.accent,
                marginBottom: 12,
                lineHeight: 1.2,
              }}
            >
              {favoriteShiftType?.name || "Kitchen Helper"}
            </div>
            <div style={{ fontFamily: BRAND_FONTS.sans, fontSize: 32, color: BRAND_COLORS.textMuted }}>
              Favorite Role
            </div>
            {busiestMonth && (
              <div style={{ fontFamily: BRAND_FONTS.sans, fontSize: 24, color: BRAND_COLORS.textMuted, marginTop: 12 }}>
                Busiest: {busiestMonth.month}
              </div>
            )}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
