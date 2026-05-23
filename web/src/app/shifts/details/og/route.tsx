import { ImageResponse } from "next/og";
import { startOfDay, endOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { formatInNZT, parseISOInNZT, toUTC } from "@/lib/timezone";
import { loadBrandFonts } from "@/lib/og-fonts";
import { getLogoDataUrl } from "@/lib/og-logo";
import { getOgBackgroundDataUrl } from "@/lib/og-background";

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
    return fallbackImage("Everybody Eats", fonts);
  }

  let selectedDate: Date;
  try {
    selectedDate = parseISOInNZT(dateParam);
  } catch {
    return fallbackImage("Everybody Eats", fonts);
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

  // Photo background seeded on date+location+session so the same URL
  // always renders the same card.
  const bgSeed = `${dateParam}|${location ?? ""}|${session ?? ""}`;
  const bgImage = getOgBackgroundDataUrl(bgSeed);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#0e3a23",
          color: "#fdf8f1",
          fontFamily: "Libre Franklin, sans-serif",
          position: "relative",
        }}
      >
        {/* Background photo */}
        <img
          src={bgImage}
          alt=""
          width={1200}
          height={630}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "flex",
          }}
        />
        {/* Dark wash + side gradient for text legibility */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.40)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(95deg, rgba(7,30,18,0.85) 0%, rgba(7,30,18,0.65) 60%, rgba(7,30,18,0.25) 100%)",
            display: "flex",
          }}
        />

        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "56px 72px 0",
          }}
        >
          <img
            src={getLogoDataUrl("white")}
            alt=""
            width={220}
            height={80}
            style={{ display: "flex" }}
          />

          {location && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "12px 22px",
                borderRadius: 999,
                background: "#0e3a23",
                color: "#fdf8f1",
                fontSize: 22,
                fontWeight: 600,
                border: "1px solid rgba(253, 248, 241, 0.25)",
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
            padding: "44px 72px 56px",
            flex: 1,
          }}
        >
          {singleSession && (
            <div
              style={{
                fontSize: 22,
                color: "#e7e5e4",
                letterSpacing: 2,
                textTransform: "uppercase",
                fontWeight: 600,
                display: "flex",
                textShadow: "0 2px 10px rgba(0,0,0,0.7)",
              }}
            >
              {singleSession === "day" ? "Day shifts" : "Evening shifts"}
            </div>
          )}

          <div
            style={{
              fontFamily: "Fraunces, serif",
              fontWeight: 600,
              fontSize: singleSession ? 96 : 88,
              lineHeight: 1.02,
              letterSpacing: -1.5,
              color: "#fdf8f1",
              marginTop: singleSession ? 18 : 0,
              display: "flex",
              alignItems: "baseline",
              gap: 28,
              textShadow: "0 2px 16px rgba(0,0,0,0.85), 0 0 32px rgba(0,0,0,0.5)",
            }}
          >
            <span>{dayLine}</span>
          </div>
          <div
            style={{
              fontFamily: "Fraunces, serif",
              fontSize: 44,
              fontWeight: 600,
              color: "#e7e5e4",
              marginTop: 6,
              display: "flex",
              textShadow: "0 2px 12px rgba(0,0,0,0.75)",
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
                color: "#fdf8f1",
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
                    background: "#0e3a23",
                    borderRadius: 18,
                    borderLeft: "6px solid #f59e0b",
                    minWidth: 280,
                  }}
                >
                  <div
                    style={{
                      fontSize: 22,
                      color: "#fed7aa",
                      fontWeight: 600,
                      letterSpacing: 0.4,
                      textTransform: "uppercase",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    ☀️ Day
                  </div>
                  <div
                    style={{
                      fontFamily: "Fraunces, serif",
                      fontSize: 44,
                      fontWeight: 600,
                      color: "#fdf8f1",
                      marginTop: 8,
                      display: "flex",
                    }}
                  >
                    {stats.day.count} shift{stats.day.count === 1 ? "" : "s"}
                  </div>
                  <div
                    style={{
                      fontSize: 22,
                      color: "#fed7aa",
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
                    background: "#0e3a23",
                    borderRadius: 18,
                    borderLeft: "6px solid #818cf8",
                    minWidth: 280,
                  }}
                >
                  <div
                    style={{
                      fontSize: 22,
                      color: "#c7d2fe",
                      fontWeight: 600,
                      letterSpacing: 0.4,
                      textTransform: "uppercase",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    🌙 Evening
                  </div>
                  <div
                    style={{
                      fontFamily: "Fraunces, serif",
                      fontSize: 44,
                      fontWeight: 600,
                      color: "#fdf8f1",
                      marginTop: 8,
                      display: "flex",
                    }}
                  >
                    {stats.evening.count} shift{stats.evening.count === 1 ? "" : "s"}
                  </div>
                  <div
                    style={{
                      fontSize: 22,
                      color: "#c7d2fe",
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
