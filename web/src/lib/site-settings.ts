import { prisma } from "@/lib/prisma";

/**
 * Server-side utility for fetching a specific site setting by key
 */
export async function getSiteSetting(key: string): Promise<string | null> {
  const setting = await prisma.siteSetting.findUnique({
    where: { key },
  });
  return setting?.value ?? null;
}

/**
 * Get all site settings (for admin use)
 */
export async function getAllSiteSettings() {
  return await prisma.siteSetting.findMany({
    orderBy: { category: "asc" },
  });
}

/**
 * Type-safe getter for parental consent form URL
 * Returns the configured URL or a fallback default
 */
export async function getParentalConsentFormUrl(): Promise<string> {
  return (
    (await getSiteSetting("PARENTAL_CONSENT_FORM_URL")) ||
    "/parental-consent-form.pdf"
  );
}
