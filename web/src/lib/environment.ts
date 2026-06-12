/**
 * Environment detection utilities.
 *
 * Driven by NEXT_PUBLIC_APP_ENV, inlined at build time (these helpers run in
 * client components). Set it per deployment:
 *   "production"                   -> no badge
 *   "staging" / "demo" / "preview" -> that badge
 *   unset (local dev)              -> "DEV"
 * Falls back to Vercel's env var so existing Vercel deploys keep working.
 */
const appEnv =
  process.env.NEXT_PUBLIC_APP_ENV ||
  process.env.NEXT_PUBLIC_VERCEL_ENV ||
  process.env.VERCEL_ENV;

export function showEnvironmentLabel(): boolean {
  return appEnv !== "production";
}

/** True only in a production deployment. Use to gate dev-only UI/helpers. */
export function isProductionEnv(): boolean {
  return appEnv === "production";
}

export function getEnvironmentLabel(): string {
  switch (appEnv) {
    case "demo":
      return "DEMO";
    case "preview":
      return "PREVIEW";
    case "staging":
      return "STAGING";
    default:
      return "DEV";
  }
}
