import { ImageResponse } from "next/og";
import { startOfDay, endOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { formatInNZT, parseISOInNZT, toUTC } from "@/lib/timezone";
import { loadBrandFonts } from "@/lib/og-fonts";

const SIZE = { width: 1200, height: 630 } as const;

interface SessionStats {
  count: number;
  spots: number;
}

type BrandFonts = Awaited<ReturnType<typeof loadBrandFonts>>;

function fallbackImage(message: string, fonts: BrandFonts) {
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
          color: "#fdf8f1",
          fontFamily: "Fraunces, serif",
          fontSize: 56,
          padding: 64,
          textAlign: "center",
        }}
      >
        {message}
      </div>
    ),
    { ...SIZE, fonts }
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");
  const location = searchParams.get("location") ?? undefined;
  const rawSession = searchParams.get("session");
  const session: "day" | "evening" | undefined =
    rawSession === "day" || rawSession === "evening" ? rawSession : undefined;

  const fonts = await loadBrandFonts();

  if (!dateParam) {
    return fallbackImage("Everybody Eats — Volunteer Portal", fonts);
  }

  let selectedDate: Date;
  try {
    selectedDate = parseISOInNZT(dateParam);
  } catch {
    return fallbackImage("Everybody Eats — Volunteer Portal", fonts);
  }

  const startUTC = toUTC(startOfDay(selectedDate));
  const endUTC = toUTC(endOfDay(selectedDate));

  const shifts = await prisma.shift.findMany({
    where: {
      start: { gte: startUTC, lte: endUTC },
      ...(location ? { location } : {}),
    },
    select: {
      start: true,
      capacity: true,
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

  const stats: { day: SessionStats; evening: SessionStats } = {
    day: { count: 0, spots: 0 },
    evening: { count: 0, spots: 0 },
  };
  for (const s of shifts) {
    const hour = Number(formatInNZT(s.start, "HH"));
    const key = hour < 16 ? "day" : "evening";
    const filled = s._count.signups + s._count.placeholders;
    const remaining = Math.max(0, s.capacity - filled);
    stats[key].count += 1;
    stats[key].spots += remaining;
  }

  const dayLine = formatInNZT(selectedDate, "EEEE");
  const dateLine = formatInNZT(selectedDate, "d MMMM yyyy");

  const total = stats.day.count + stats.evening.count;
  if (total === 0) {
    return fallbackImage(
      `No shifts on ${formatInNZT(selectedDate, "EEE d MMM")}${location ? ` · ${location}` : ""}`,
      fonts
    );
  }

  const showSingleSession = session !== undefined;

  const singleSession = showSingleSession ? session : null;
  const singleStats = singleSession ? stats[singleSession] : null;

  const dayGradient = "linear-gradient(135deg, #f59e0b, #f97316)";
  const eveningGradient = "linear-gradient(135deg, #6366f1, #8b5cf6)";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: singleSession === "evening" ? "#0b1224" : "#fdf8f1",
          color: singleSession === "evening" ? "#fdf8f1" : "#1c1917",
          fontFamily: "Libre Franklin, sans-serif",
          position: "relative",
        }}
      >
        {/* Decorative blobs */}
        <div
          style={{
            position: "absolute",
            top: -160,
            right: -120,
            width: 560,
            height: 560,
            borderRadius: "50%",
            background: singleSession === "evening" ? eveningGradient : dayGradient,
            opacity: singleSession === "evening" ? 0.32 : 0.2,
            display: "flex",
          }}
        />
        {!singleSession && (
          <div
            style={{
              position: "absolute",
              bottom: -180,
              left: -120,
              width: 460,
              height: 460,
              borderRadius: "50%",
              background: eveningGradient,
              opacity: 0.14,
              display: "flex",
            }}
          />
        )}

        {/* Header */}
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
                background: singleSession === "evening" ? "#fdf8f1" : "#0e3a23",
                color: singleSession === "evening" ? "#0e3a23" : "#fdf8f1",
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
                  color: singleSession === "evening" ? "#fdf8f1" : "#0e3a23",
                  lineHeight: 1,
                }}
              >
                Everybody Eats
              </div>
              <div
                style={{
                  fontSize: 16,
                  color: singleSession === "evening" ? "#cbd5e1" : "#57534e",
                  letterSpacing: 0.4,
                  marginTop: 6,
                  textTransform: "uppercase",
                }}
              >
                Volunteer Portal
              </div>
            </div>
          </div>

          {location && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "12px 22px",
                borderRadius: 999,
                background:
                  singleSession === "evening"
                    ? "rgba(253, 248, 241, 0.15)"
                    : "rgba(14, 58, 35, 0.12)",
                color: singleSession === "evening" ? "#fdf8f1" : "#0e3a23",
                fontSize: 22,
                fontWeight: 600,
              }}
            >
              📍 {location}
            </div>
          )}
        </div>

        {/* Body */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "44px 72px 0",
            flex: 1,
          }}
        >
          <div
            style={{
              fontSize: 22,
              color: singleSession === "evening" ? "#94a3b8" : "#78716c",
              letterSpacing: 2,
              textTransform: "uppercase",
              fontWeight: 600,
              display: "flex",
            }}
          >
            {singleSession === "day"
              ? "Day shifts · before 4pm"
              : singleSession === "evening"
                ? "Evening shifts · 4pm onwards"
                : "Volunteer line-up · Aotearoa"}
          </div>

          <div
            style={{
              fontFamily: "Fraunces, serif",
              fontWeight: 600,
              fontSize: singleSession ? 96 : 88,
              lineHeight: 1.02,
              letterSpacing: -1.5,
              color: singleSession === "evening" ? "#fdf8f1" : "#0e3a23",
              marginTop: 18,
              display: "flex",
              alignItems: "baseline",
              gap: 28,
            }}
          >
            <span>{dayLine}</span>
          </div>
          <div
            style={{
              fontFamily: "Fraunces, serif",
              fontSize: 44,
              fontWeight: 600,
              color: singleSession === "evening" ? "#cbd5e1" : "#44403c",
              marginTop: 6,
              display: "flex",
            }}
          >
            {dateLine}
          </div>

          {singleSession && singleStats ? (
            <div
              style={{
                marginTop: 36,
                display: "flex",
                gap: 22,
                alignItems: "center",
                fontSize: 32,
                color: singleSession === "evening" ? "#fdf8f1" : "#1c1917",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "16px 26px",
                  borderRadius: 999,
                  background: singleSession === "evening" ? eveningGradient : dayGradient,
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: 28,
                }}
              >
                {singleSession === "day" ? "☀️" : "🌙"} {singleStats.count} shift
                {singleStats.count === 1 ? "" : "s"}
              </div>
              <div
                style={{
                  fontWeight: 600,
                  display: "flex",
                }}
              >
                {singleStats.spots > 0
                  ? `${singleStats.spots} spot${singleStats.spots === 1 ? "" : "s"} open`
                  : "Waitlist only"}
              </div>
            </div>
          ) : (
            <div
              style={{
                marginTop: 36,
                display: "flex",
                gap: 20,
              }}
            >
              {stats.day.count > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    padding: "20px 28px",
                    background: "rgba(245, 158, 11, 0.15)",
                    borderRadius: 18,
                    borderLeft: "6px solid #f59e0b",
                    minWidth: 280,
                  }}
                >
                  <div
                    style={{
                      fontSize: 22,
                      color: "#7c2d12",
                      fontWeight: 600,
                      letterSpacing: 0.4,
                      textTransform: "uppercase",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    ☀️ Day · before 4pm
                  </div>
                  <div
                    style={{
                      fontFamily: "Fraunces, serif",
                      fontSize: 44,
                      fontWeight: 600,
                      color: "#7c2d12",
                      marginTop: 8,
                      display: "flex",
                    }}
                  >
                    {stats.day.count} shift{stats.day.count === 1 ? "" : "s"}
                  </div>
                  <div
                    style={{
                      fontSize: 22,
                      color: "#9a3412",
                      marginTop: 4,
                      display: "flex",
                    }}
                  >
                    {stats.day.spots > 0
                      ? `${stats.day.spots} spot${stats.day.spots === 1 ? "" : "s"} open`
                      : "Waitlist only"}
                  </div>
                </div>
              )}
              {stats.evening.count > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    padding: "20px 28px",
                    background: "rgba(99, 102, 241, 0.15)",
                    borderRadius: 18,
                    borderLeft: "6px solid #6366f1",
                    minWidth: 280,
                  }}
                >
                  <div
                    style={{
                      fontSize: 22,
                      color: "#3730a3",
                      fontWeight: 600,
                      letterSpacing: 0.4,
                      textTransform: "uppercase",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    🌙 Evening · from 4pm
                  </div>
                  <div
                    style={{
                      fontFamily: "Fraunces, serif",
                      fontSize: 44,
                      fontWeight: 600,
                      color: "#3730a3",
                      marginTop: 8,
                      display: "flex",
                    }}
                  >
                    {stats.evening.count} shift{stats.evening.count === 1 ? "" : "s"}
                  </div>
                  <div
                    style={{
                      fontSize: 22,
                      color: "#4338ca",
                      marginTop: 4,
                      display: "flex",
                    }}
                  >
                    {stats.evening.spots > 0
                      ? `${stats.evening.spots} spot${stats.evening.spots === 1 ? "" : "s"} open`
                      : "Waitlist only"}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
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
              color: singleSession === "evening" ? "#fdf8f1" : "#0e3a23",
            }}
          >
            Kia ora — bring the whānau.
          </div>
          <div
            style={{
              fontSize: 22,
              color: singleSession === "evening" ? "#cbd5e1" : "#57534e",
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
            background:
              singleSession === "evening"
                ? eveningGradient
                : singleSession === "day"
                  ? dayGradient
                  : "linear-gradient(90deg, #f59e0b, #f97316, #6366f1, #8b5cf6)",
            display: "flex",
          }}
        />
      </div>
    ),
    { ...SIZE, fonts, headers: { "content-type": "image/png" } }
  );
}
