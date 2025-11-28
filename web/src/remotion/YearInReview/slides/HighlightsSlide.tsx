import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { BRAND_COLORS, BRAND_FONTS, SPRING_CONFIG, type YearStats } from "../types";

export const HighlightsSlide: React.FC<YearStats> = ({ firstShift, lastShift, longestShift, volunteerDays }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = spring({
    frame,
    fps,
    config: SPRING_CONFIG,
  });

  const card1 = spring({
    frame: frame - 15,
    fps,
    config: SPRING_CONFIG,
  });

  const card2 = spring({
    frame: frame - 25,
    fps,
    config: SPRING_CONFIG,
  });

  const card3 = spring({
    frame: frame - 35,
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
        Year Highlights
      </h2>

      {/* Highlights Grid */}
      <div style={{ display: "flex", flexDirection: "column", gap: 40, width: "100%", maxWidth: 900 }}>
        {/* First Shift */}
        {firstShift && (
          <div
            style={{
              backgroundColor: BRAND_COLORS.cardBg,
              border: `2px solid ${BRAND_COLORS.cardBorder}`,
              borderRadius: 24,
              padding: "40px 50px",
              display: "flex",
              alignItems: "center",
              gap: 40,
              opacity: card1,
              transform: `translateX(${(1 - card1) * -50}px)`,
            }}
          >
            <div style={{ fontSize: 80, lineHeight: 1 }}>🌟</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: BRAND_FONTS.sans, fontSize: 32, color: BRAND_COLORS.textMuted, marginBottom: 8 }}>
                First Shift
              </div>
              <div
                style={{
                  fontFamily: BRAND_FONTS.accent,
                  fontSize: 48,
                  fontWeight: "bold",
                  color: BRAND_COLORS.accent,
                  marginBottom: 8,
                }}
              >
                {firstShift.date}
              </div>
              <div style={{ fontFamily: BRAND_FONTS.sans, fontSize: 32, color: BRAND_COLORS.text }}>
                {firstShift.type} • {firstShift.location}
              </div>
            </div>
          </div>
        )}

        {/* Row of Two Cards */}
        <div style={{ display: "flex", gap: 40 }}>
          {/* Longest Shift */}
          {longestShift && (
            <div
              style={{
                flex: 1,
                backgroundColor: BRAND_COLORS.cardBg,
                border: `2px solid ${BRAND_COLORS.cardBorder}`,
                borderRadius: 24,
                padding: "40px",
                textAlign: "center",
                opacity: card2,
                transform: `translateY(${(1 - card2) * 30}px)`,
              }}
            >
              <div style={{ fontSize: 64, marginBottom: 20 }}>⏱️</div>
              <div style={{ fontFamily: BRAND_FONTS.sans, fontSize: 32, color: BRAND_COLORS.textMuted, marginBottom: 12 }}>
                Longest Shift
              </div>
              <div
                style={{
                  fontFamily: BRAND_FONTS.accent,
                  fontSize: 72,
                  fontWeight: "bold",
                  color: BRAND_COLORS.accent,
                  lineHeight: 1,
                  marginBottom: 12,
                }}
              >
                {longestShift.duration}h
              </div>
              <div style={{ fontFamily: BRAND_FONTS.sans, fontSize: 28, color: BRAND_COLORS.text }}>
                {longestShift.date}
              </div>
            </div>
          )}

          {/* Volunteer Days */}
          <div
            style={{
              flex: 1,
              backgroundColor: BRAND_COLORS.cardBg,
              border: `2px solid ${BRAND_COLORS.cardBorder}`,
              borderRadius: 24,
              padding: "40px",
              textAlign: "center",
              opacity: card2,
              transform: `translateY(${(1 - card2) * 30}px)`,
            }}
          >
            <div style={{ fontSize: 64, marginBottom: 20 }}>📅</div>
            <div style={{ fontFamily: BRAND_FONTS.sans, fontSize: 32, color: BRAND_COLORS.textMuted, marginBottom: 12 }}>
              Days Volunteered
            </div>
            <div
              style={{
                fontFamily: BRAND_FONTS.accent,
                fontSize: 72,
                fontWeight: "bold",
                color: BRAND_COLORS.accent,
                lineHeight: 1,
                marginBottom: 12,
              }}
            >
              {volunteerDays}
            </div>
            <div style={{ fontFamily: BRAND_FONTS.sans, fontSize: 28, color: BRAND_COLORS.text }}>
              Unique days
            </div>
          </div>
        </div>

        {/* Last Shift */}
        {lastShift && (
          <div
            style={{
              backgroundColor: BRAND_COLORS.cardBg,
              border: `2px solid ${BRAND_COLORS.cardBorder}`,
              borderRadius: 24,
              padding: "40px 50px",
              display: "flex",
              alignItems: "center",
              gap: 40,
              opacity: card3,
              transform: `translateX(${(1 - card3) * 50}px)`,
            }}
          >
            <div style={{ fontSize: 80, lineHeight: 1 }}>🎉</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: BRAND_FONTS.sans, fontSize: 32, color: BRAND_COLORS.textMuted, marginBottom: 8 }}>
                Most Recent Shift
              </div>
              <div
                style={{
                  fontFamily: BRAND_FONTS.accent,
                  fontSize: 48,
                  fontWeight: "bold",
                  color: BRAND_COLORS.accent,
                  marginBottom: 8,
                }}
              >
                {lastShift.date}
              </div>
              <div style={{ fontFamily: BRAND_FONTS.sans, fontSize: 32, color: BRAND_COLORS.text }}>
                {lastShift.type} • {lastShift.location}
              </div>
            </div>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
