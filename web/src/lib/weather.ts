/**
 * Weather lookup for restaurant service nights, backed by Open-Meteo
 * (free, no API key, supports both recent-past forecast and historical archive).
 */

// Known Everybody Eats locations → coordinates. Unknown locations fall back to
// Open-Meteo's geocoding API (constrained to New Zealand).
const LOCATION_COORDS: Record<string, { lat: number; lon: number }> = {
  Wellington: { lat: -41.2866, lon: 174.7756 },
  "Glen Innes": { lat: -36.8785, lon: 174.856 },
  Onehunga: { lat: -36.9239, lon: 174.7847 },
};

// WMO weather interpretation codes → short, human-friendly conditions.
const WEATHER_CODE_LABELS: Record<number, string> = {
  0: "Clear",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  56: "Freezing drizzle",
  57: "Freezing drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Freezing rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Rain showers",
  81: "Rain showers",
  82: "Heavy rain showers",
  85: "Snow showers",
  86: "Snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm",
  99: "Thunderstorm",
};

export function describeWeatherCode(code: number): string {
  return WEATHER_CODE_LABELS[code] ?? "Unknown";
}

export interface WeatherResult {
  label: string; // e.g. "Overcast, 15°C"
  code: number;
  tempMax: number | null;
}

const TIMEOUT_MS = 6000;

async function fetchJson(url: string): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function resolveCoords(
  location: string
): Promise<{ lat: number; lon: number } | null> {
  const known = LOCATION_COORDS[location];
  if (known) return known;

  // Geocoding fallback for admin-added locations (New Zealand only).
  const url =
    "https://geocoding-api.open-meteo.com/v1/search?" +
    `name=${encodeURIComponent(location)}&count=1&country=NZ&language=en&format=json`;
  const data = (await fetchJson(url)) as
    | { results?: Array<{ latitude: number; longitude: number }> }
    | null;
  const hit = data?.results?.[0];
  return hit ? { lat: hit.latitude, lon: hit.longitude } : null;
}

/**
 * Fetch the day's weather for a location. `date` is a NZ calendar date
 * (YYYY-MM-DD). Returns null if coordinates or data can't be resolved.
 */
export async function fetchWeatherForLocation(
  location: string,
  date: string
): Promise<WeatherResult | null> {
  const coords = await resolveCoords(location);
  if (!coords) return null;

  // The forecast endpoint covers ~92 days past to 16 days ahead; older dates
  // need the historical archive endpoint.
  const target = new Date(`${date}T00:00:00Z`).getTime();
  const daysAgo = (Date.now() - target) / 86_400_000;
  const base =
    daysAgo > 90
      ? "https://archive-api.open-meteo.com/v1/archive"
      : "https://api.open-meteo.com/v1/forecast";

  const url =
    `${base}?latitude=${coords.lat}&longitude=${coords.lon}` +
    "&daily=weather_code,temperature_2m_max&timezone=Pacific%2FAuckland" +
    `&start_date=${date}&end_date=${date}`;

  const data = (await fetchJson(url)) as
    | {
        daily?: {
          weather_code?: Array<number | null>;
          temperature_2m_max?: Array<number | null>;
        };
      }
    | null;

  const code = data?.daily?.weather_code?.[0];
  if (code === undefined || code === null) return null;

  const tempMaxRaw = data?.daily?.temperature_2m_max?.[0];
  const tempMax = typeof tempMaxRaw === "number" ? tempMaxRaw : null;

  const condition = describeWeatherCode(code);
  const label =
    tempMax !== null ? `${condition}, ${Math.round(tempMax)}°C` : condition;

  return { label, code, tempMax };
}
