const FONT_TIMEOUT_MS = 4000;
const ALLOWED_FAMILIES = ["Fraunces", "Libre Franklin"] as const;
type AllowedFamily = (typeof ALLOWED_FAMILIES)[number];

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FONT_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function loadGoogleFont(
  family: AllowedFamily,
  weight: number
): Promise<ArrayBuffer | null> {
  if (!ALLOWED_FAMILIES.includes(family)) return null;

  try {
    const css = await fetchWithTimeout(
      `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`,
      {
        headers: {
          // Pre-woff2 UA so Google returns TTF, which satori (next/og) supports.
          "User-Agent":
            "Mozilla/5.0 (Windows NT 6.1; Trident/7.0; rv:11.0) like Gecko",
        },
      }
    ).then((r) => r.text());

    // Restrict to https URLs from a known font CDN to defuse any chance of
    // the regex pulling in something other than a font file.
    const match = css.match(/src:\s*url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)\s*format/);
    if (!match) return null;

    const response = await fetchWithTimeout(match[1]);
    if (!response.ok) return null;
    return await response.arrayBuffer();
  } catch {
    return null;
  }
}

type SatoriFont = {
  name: AllowedFamily;
  data: ArrayBuffer;
  weight: 400 | 600;
  style: "normal";
};

export async function loadBrandFonts(): Promise<SatoriFont[]> {
  const [fraunces, libreFranklin, libreFranklinBold] = await Promise.all([
    loadGoogleFont("Fraunces", 600),
    loadGoogleFont("Libre Franklin", 400),
    loadGoogleFont("Libre Franklin", 600),
  ]);

  return [
    fraunces && { name: "Fraunces" as const, data: fraunces, weight: 600 as const, style: "normal" as const },
    libreFranklin && {
      name: "Libre Franklin" as const,
      data: libreFranklin,
      weight: 400 as const,
      style: "normal" as const,
    },
    libreFranklinBold && {
      name: "Libre Franklin" as const,
      data: libreFranklinBold,
      weight: 600 as const,
      style: "normal" as const,
    },
  ].filter(Boolean) as SatoriFont[];
}
