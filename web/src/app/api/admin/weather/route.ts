import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { fetchWeatherForLocation } from "@/lib/weather";

// GET - Look up the day's weather for a location (Open-Meteo)
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const date = request.nextUrl.searchParams.get("date");
  const location = request.nextUrl.searchParams.get("location");

  if (!date || !location) {
    return NextResponse.json(
      { error: "Date and location are required" },
      { status: 400 }
    );
  }

  try {
    const result = await fetchWeatherForLocation(location, date);

    if (!result) {
      return NextResponse.json(
        { error: "Weather unavailable for this date and location" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      weather: result.label,
      code: result.code,
      tempMax: result.tempMax,
    });
  } catch (error) {
    console.error("Error fetching weather:", error);
    return NextResponse.json(
      { error: "Failed to fetch weather" },
      { status: 500 }
    );
  }
}
