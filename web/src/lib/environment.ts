/**
 * Environment detection utilities
 */
const vercelEnv = process.env.VERCEL_ENV || process.env.NEXT_PUBLIC_VERCEL_ENV;

export function showEnvironmentLabel(): boolean {
  return vercelEnv !== "production";
}

export function getEnvironmentLabel(): string {
  if (!vercelEnv) {
    return "DEV";
  }

  switch (vercelEnv) {
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
