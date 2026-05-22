import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { formatInNZT } from "@/lib/timezone";
import { getShiftTheme } from "@/lib/shift-themes";

export const alt = "Volunteer shift at Everybody Eats";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const THEME_PRESETS: Record<string, { from: string; to: string; accent: string }> = {
  "from-blue-500 to-cyan-500": { from: "#3b82f6", to: "#06b6d4", accent: "#22d3ee" },
  "from-purple-500 to-pink-500": { from: "#a855f7", to: "#ec4899", accent: "#f472b6" },
  "from-green-500 to-emerald-500": { from: "#22c55e", to: "#10b981", accent: "#34d399" },
  "from-orange-500 to-amber-500": { from: "#f97316", to: "#f59e0b", accent: "#fbbf24" },
  "from-red-500 to-pink-500": { from: "#ef4444", to: "#ec4899", accent: "#f472b6" },
  "from-indigo-500 to-purple-500": { from: "#6366f1", to: "#a855f7", accent: "#c084fc" },
  "from-pink-500 to-rose-500": { from: "#ec4899", to: "#f43f5e", accent: "#fb7185" },
  "from-gray-500 to-slate-500": { from: "#6b7280", to: "#64748b", accent: "#94a3b8" },
};

function resolveThemeColors(fullGradient: string) {
  return THEME_PRESETS[fullGradient] ?? THEME_PRESETS["from-gray-500 to-slate-500"];
}

async function loadGoogleFont(family: string, weight: number): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`,
      {
        headers: {
          // Pre-woff2 UA so Google returns TTF, which is what satori (next/og) supports.
          "User-Agent":
            "Mozilla/5.0 (Windows NT 6.1; Trident/7.0; rv:11.0) like Gecko",
        },
      }
    ).then((r) => r.text());
    const url = css.match(/src:\s*url\((.+?)\)\s*format/)?.[1];
    if (!url) return null;
    return await fetch(url).then((r) => r.arrayBuffer());
  } catch {
    return null;
  }
}

export default async function ShiftOgImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const shift = await prisma.shift.findUnique({
    where: { id },
    include: {
      shiftType: true,
      _count: {
        select: {
          signups: {
            where: { status: { in: ["CONFIRMED", "PENDING", "REGULAR_PENDING"] } },
          },
          placeholders: true,
        },
      },
    },
  });

  const [fraunces, libreFranklin, libreFranklinBold] = await Promise.all([
    loadGoogleFont("Fraunces", 600),
    loadGoogleFont("Libre Franklin", 400),
    loadGoogleFont("Libre Franklin", 600),
  ]);

  const fonts = [
    fraunces && { name: "Fraunces", data: fraunces, weight: 600 as const, style: "normal" as const },
    libreFranklin && {
      name: "Libre Franklin",
      data: libreFranklin,
      weight: 400 as const,
      style: "normal" as const,
    },
    libreFranklinBold && {
      name: "Libre Franklin",
      data: libreFranklinBold,
      weight: 600 as const,
      style: "normal" as const,
    },
  ].filter(Boolean) as {
    name: string;
    data: ArrayBuffer;
    weight: 400 | 600;
    style: "normal";
  }[];

  if (!shift) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#0e3a23",
            color: "#fff",
            fontSize: 64,
            fontFamily: "Fraunces, serif",
          }}
        >
          Everybody Eats — Volunteer Portal
        </div>
      ),
      { ...size, fonts }
    );
  }

  const theme = getShiftTheme(shift.shiftType.name);
  const colors = resolveThemeColors(theme.fullGradient);
  const confirmedCount = shift._count.signups + shift._count.placeholders;
  const spotsRemaining = Math.max(0, shift.capacity - confirmedCount);
  const isPast = new Date(shift.end) < new Date();
  const isFull = spotsRemaining === 0;

  const dayLabel = formatInNZT(new Date(shift.start), "EEEE");
  const dateLabel = formatInNZT(new Date(shift.start), "d MMM yyyy");
  const timeLabel = `${formatInNZT(new Date(shift.start), "h:mma")} – ${formatInNZT(
    new Date(shift.end),
    "h:mma"
  )}`.toLowerCase();

  const statusLabel = isPast
    ? "Shift complete"
    : isFull
      ? "Waitlist open"
      : `${spotsRemaining} ${spotsRemaining === 1 ? "spot" : "spots"} left`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#fdf8f1",
          fontFamily: "Libre Franklin, sans-serif",
          color: "#1c1917",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -120,
            width: 520,
            height: 520,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${colors.from}, ${colors.to})`,
            opacity: 0.18,
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -180,
            left: -120,
            width: 460,
            height: 460,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${colors.accent}, ${colors.from})`,
            opacity: 0.12,
            display: "flex",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "56px 72px 0",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 14,
                background: "#0e3a23",
                color: "#fdf8f1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "Fraunces, serif",
                fontSize: 30,
                fontWeight: 600,
              }}
            >
              EE
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  fontFamily: "Fraunces, serif",
                  fontSize: 24,
                  fontWeight: 600,
                  color: "#0e3a23",
                  lineHeight: 1,
                }}
              >
                Everybody Eats
              </div>
              <div
                style={{
                  fontSize: 16,
                  color: "#57534e",
                  letterSpacing: 0.4,
                  marginTop: 6,
                  textTransform: "uppercase",
                }}
              >
                Volunteer Portal
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "12px 22px",
              borderRadius: 999,
              background: isPast
                ? "rgba(120, 113, 108, 0.15)"
                : isFull
                  ? "rgba(217, 119, 6, 0.18)"
                  : "rgba(22, 101, 52, 0.15)",
              color: isPast ? "#57534e" : isFull ? "#92400e" : "#166534",
              fontSize: 22,
              fontWeight: 600,
            }}
          >
            {statusLabel}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "48px 72px 0",
            flex: 1,
          }}
        >
          <div
            style={{
              fontSize: 22,
              color: "#78716c",
              letterSpacing: 2,
              textTransform: "uppercase",
              fontWeight: 600,
              display: "flex",
            }}
          >
            Volunteer mahi · Aotearoa
          </div>

          <div
            style={{
              fontFamily: "Fraunces, serif",
              fontWeight: 600,
              fontSize: 96,
              lineHeight: 1.02,
              letterSpacing: -1.5,
              color: "#0e3a23",
              marginTop: 18,
              display: "flex",
              flexWrap: "wrap",
              maxWidth: 980,
            }}
          >
            {shift.shiftType.name}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              marginTop: 36,
              fontSize: 34,
              fontFamily: "Fraunces, serif",
              fontWeight: 600,
              color: "#1c1917",
            }}
          >
            <span>{dayLabel}</span>
            <span style={{ color: colors.from }}>·</span>
            <span>{dateLabel}</span>
            <span style={{ color: colors.from }}>·</span>
            <span>{timeLabel}</span>
          </div>

          {shift.location && (
            <div
              style={{
                marginTop: 22,
                fontSize: 30,
                color: "#44403c",
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: `linear-gradient(135deg, ${colors.from}, ${colors.to})`,
                  display: "flex",
                }}
              />
              {shift.location}
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "32px 72px 56px",
          }}
        >
          <div
            style={{
              fontFamily: "Fraunces, serif",
              fontWeight: 600,
              fontStyle: "italic",
              fontSize: 28,
              color: "#0e3a23",
            }}
          >
            Kia ora — join the whānau.
          </div>
          <div
            style={{
              fontSize: 22,
              color: "#57534e",
              fontWeight: 600,
              letterSpacing: 0.4,
            }}
          >
            volunteers.everybodyeats.nz
          </div>
        </div>

        <div
          style={{
            height: 12,
            background: `linear-gradient(90deg, ${colors.from}, ${colors.accent}, ${colors.to})`,
            display: "flex",
          }}
        />
      </div>
    ),
    { ...size, fonts }
  );
}
