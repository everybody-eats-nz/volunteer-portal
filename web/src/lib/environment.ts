/**
 * Environment detection utilities
 */

export function isDemoEnvironment(): boolean {
  const vercelEnv = process.env.VERCEL_ENV;

  // Show demo indicator for:
  // 1. Local development (no VERCEL_ENV)
  // 2. Demo environments (VERCEL_ENV=demo)
  // 3. Preview environments (VERCEL_ENV=preview)
  // 4. Staging environments (VERCEL_ENV=staging)
  return !vercelEnv || vercelEnv === 'demo' || vercelEnv === 'preview' || vercelEnv === 'staging';
}

export function getDemoEnvironmentLabel(): string {
  const vercelEnv = process.env.VERCEL_ENV;

  if (!vercelEnv) {
    return 'DEV';
  }

  switch (vercelEnv) {
    case 'demo':
      return 'DEMO';
    case 'preview':
      return 'PREVIEW';
    case 'staging':
      return 'STAGING';
    default:
      return 'DEV';
  }
}