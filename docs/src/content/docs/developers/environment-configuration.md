---
title: Environment Configuration
description: Environment setup, variables, and deployment configuration
---

The Volunteer Portal uses environment variables to configure different aspects of the application across development, preview, and production environments.

## Environment Types

The application runs in three main environments:

### Production

- **URL**: `https://volunteers.everybodyeats.nz`
- **Vercel Environment**: `production`
- **Database**: Production Supabase instance
- **Purpose**: Live production environment for actual volunteers
- **Environment Indicator**: Hidden (no environment label shown)

### Preview/Demo

- **URL**: `https://demo.everybody-eats.vercel.app`
- **Vercel Environment**: `preview`
- **Database**: Demo Supabase instance
- **Purpose**: Staging environment for testing features before production
- **Environment Indicator**: "DEMO" label shown in header

### Development

- **URL**: `http://localhost:3000`
- **Vercel Environment**: None (local)
- **Database**: Local PostgreSQL or demo Supabase
- **Purpose**: Local development and testing
- **Environment Indicator**: "DEV" label shown in header

## Environment Variables

All environment variables are configured in `.env.local` for local development and in Vercel's environment settings for deployed environments.

### Core Application

#### Database Configuration

```bash
# PostgreSQL connection string
DATABASE_URL="postgresql://postgres:password@localhost:5432/volunteer-portal"

# Direct database connection (used by Prisma migrations)
DIRECT_URL="postgresql://postgres:password@localhost:5432/volunteer-portal"
```

**Production**: Both point to Supabase PostgreSQL with connection pooling
**Development**: Can point to local PostgreSQL or demo Supabase instance

#### Authentication

```bash
# NextAuth configuration
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"
```

**Required**: Both variables are required for authentication to work

- `NEXTAUTH_SECRET`: Random string for encrypting session tokens (generate with `openssl rand -base64 32`)
- `NEXTAUTH_URL`: Base URL of the application (auto-detected in Vercel)

#### Timezone

```bash
# Ensures all operations default to New Zealand timezone
TZ="Pacific/Auckland"
```

**Important**: This sets the server timezone to New Zealand time, ensuring shift times and dates are handled correctly.

### OAuth Providers (Optional)

```bash
# Google OAuth
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Facebook OAuth
FACEBOOK_CLIENT_ID=""
FACEBOOK_CLIENT_SECRET=""

# Apple OAuth
APPLE_CLIENT_ID=""
APPLE_CLIENT_SECRET=""
```

**Optional**: Only required if enabling OAuth login

See [OAuth Setup](/developers/oauth-authentication) for detailed configuration instructions.

### Email Services

```bash
# Campaign Monitor API
CAMPAIGN_MONITOR_API_KEY=""

# Email Template IDs
CAMPAIGN_MONITOR_MIGRATION_EMAIL_ID=""
CAMPAIGN_MONITOR_SHIFT_ADMIN_CANCELLATION_EMAIL_ID=""
CAMPAIGN_MONITOR_SHIFT_SHORTAGE_EMAIL_ID=""
CAMPAIGN_MONITOR_SHIFT_CONFIRMATION_EMAIL_ID=""
CAMPAIGN_MONITOR_VOLUNTEER_CANCELLATION_EMAIL_ID=""
CAMPAIGN_MONITOR_EMAIL_VERIFICATION_ID=""
CAMPAIGN_MONITOR_PARENTAL_CONSENT_APPROVAL_EMAIL_ID=""
CAMPAIGN_MONITOR_USER_INVITATION_EMAIL_ID=""
```

**Required for Production**: Email functionality requires Campaign Monitor configuration

See [Email Systems](/developers/email-systems) for detailed setup instructions.

### File Storage (Supabase)

```bash
# Supabase configuration for profile images and documents
NEXT_PUBLIC_SUPABASE_URL=""
NEXT_PUBLIC_SUPABASE_ANON_KEY=""
SUPABASE_SERVICE_ROLE_KEY=""
```

**Required for file uploads**: Profile photos and resource documents

- `NEXT_PUBLIC_*`: Available on client-side
- `SUPABASE_SERVICE_ROLE_KEY`: Server-side only (admin operations)

### Analytics

```bash
# PostHog analytics
NEXT_PUBLIC_POSTHOG_KEY=phc_your_key_here
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

**Optional**: Analytics and feature flags

See [Analytics Integration](/developers/analytics-integration) for setup details.

### Vercel-Specific Variables

These are automatically set by Vercel:

```bash
# Vercel environment identifier
VERCEL_ENV="production" | "preview" | "development"

# Vercel deployment URL (auto-generated)
VERCEL_URL="your-deployment.vercel.app"
```

**Do not set manually**: Vercel manages these automatically.

## Environment Detection

The application uses `VERCEL_ENV` to detect the current environment:

```typescript
// web/src/lib/environment.ts
export function getEnvironmentLabel(): string {
  const vercelEnv = process.env.VERCEL_ENV;

  switch (vercelEnv) {
    case "production":
      return ""; // No label in production
    case "preview":
    case "demo":
      return "DEMO";
    default:
      return "DEV";
  }
}
```

### Environment Indicator

Non-production environments show an environment label in the application header:

```typescript
import { getEnvironmentLabel, showEnvironmentLabel } from "@/lib/environment";

// In header component
{
  showEnvironmentLabel() && (
    <div className="bg-yellow-500 px-2 py-1 text-xs">
      {getEnvironmentLabel()}
    </div>
  );
}
```

This helps users and developers identify which environment they're using.

## Base URL Configuration

The application determines its base URL based on environment:

```typescript
// web/src/lib/utils.ts
export function getBaseUrl(): string {
  // Preview/Demo environment
  if (process.env.VERCEL_ENV === "preview") {
    return "https://demo.everybody-eats.vercel.app";
  }

  // Production environment
  if (process.env.VERCEL_ENV === "production") {
    return "https://volunteers.everybodyeats.nz";
  }

  // Development or other Vercel deployments
  const vercelUrl = process.env.VERCEL_URL;
  return vercelUrl ? `https://${vercelUrl}` : "http://localhost:3000";
}
```

This is used for:

- Email links (password reset, shift confirmations)
- OAuth redirect URIs
- API callbacks
- Absolute URL generation

## Production Configuration

### Vercel Environment Variables

Set these in Vercel dashboard (Settings → Environment Variables):

#### Production Environment

```bash
# Database (Supabase Production)
DATABASE_URL=postgresql://...production...
DIRECT_URL=postgresql://...production...

# Auth
NEXTAUTH_SECRET=<production-secret>
NEXTAUTH_URL=https://volunteers.everybodyeats.nz

# Timezone
TZ=Pacific/Auckland

# Email (Production Campaign Monitor)
CAMPAIGN_MONITOR_API_KEY=<prod-api-key>
CAMPAIGN_MONITOR_MIGRATION_EMAIL_ID=<prod-template-id>
# ... all other template IDs

# File Storage (Production Supabase)
NEXT_PUBLIC_SUPABASE_URL=<prod-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<prod-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<prod-service-key>

# Analytics
NEXT_PUBLIC_POSTHOG_KEY=<prod-key>
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

# OAuth (Production credentials)
GOOGLE_CLIENT_ID=<prod-google-id>
GOOGLE_CLIENT_SECRET=<prod-google-secret>
FACEBOOK_CLIENT_ID=<prod-facebook-id>
FACEBOOK_CLIENT_SECRET=<prod-facebook-secret>
APPLE_CLIENT_ID=<prod-apple-id>
APPLE_CLIENT_SECRET=<prod-apple-secret>
```

#### Preview/Demo Environment

Use the same configuration as production but with demo/staging credentials:

```bash
# Database (Supabase Demo)
DATABASE_URL=postgresql://...demo...
DIRECT_URL=postgresql://...demo...

# Auth (different secret, demo URL)
NEXTAUTH_SECRET=<demo-secret>
NEXTAUTH_URL=https://demo.everybody-eats.vercel.app

# Use demo/test credentials for all services
```

### Environment Variable Scoping

Vercel allows scoping variables to specific environments:

- **Production**: Only available in production deployments
- **Preview**: Only available in preview deployments
- **Development**: Only available in local development (via `.env.local`)

Scope sensitive credentials (like production database URLs) to **Production only**.

## Configuration Files

### `.env.example`

Template file checked into git - contains all variable names with placeholder values.

**Do not put real credentials here!**

### `.env.local`

Local development configuration - **never committed to git** (in `.gitignore`).

Contains actual credentials for local development.

### `.env`

Sometimes used for shared development defaults - **should not contain secrets**.

## Security Best Practices

### 1. Never Commit Secrets

```bash
# .gitignore includes:
.env.local
.env*.local
.env.production
```

### 2. Use Different Secrets Per Environment

- Production database ≠ Demo database
- Production API keys ≠ Demo API keys
- Different `NEXTAUTH_SECRET` for each environment

### 3. Rotate Secrets Regularly

- Change `NEXTAUTH_SECRET` periodically
- Rotate API keys annually
- Update OAuth secrets when providers require

### 4. Scope Variables Appropriately

In Vercel:

- Sensitive production variables → Production environment only
- Demo/test credentials → Preview environment only
- Development → `.env.local` only

### 5. Use Service Role Keys Carefully

`SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security - only use server-side:

```typescript
// ✅ Good: Server-side only
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const data = await supabaseAdmin.from("users").select();
  return Response.json(data);
}

// ❌ Bad: Never expose in client components
// Don't use service role key in client-side code
```

## Troubleshooting

### Environment Variable Not Found

**Symptoms**: `process.env.VARIABLE_NAME` is `undefined`

**Causes**:

1. Variable not set in `.env.local`
2. Server needs restart after adding variable
3. Variable name typo

**Solution**:

```bash
# Add to .env.local
VARIABLE_NAME="value"

# Restart dev server
npm run dev
```

### Client-Side Variables Undefined

**Symptoms**: `process.env.NEXT_PUBLIC_*` is `undefined` in browser

**Causes**:

1. Missing `NEXT_PUBLIC_` prefix
2. Not restarted dev server after adding

**Solution**:

```bash
# Client variables must start with NEXT_PUBLIC_
NEXT_PUBLIC_POSTHOG_KEY="value"  # ✅ Works in browser
POSTHOG_KEY="value"              # ❌ Only works server-side
```

Restart dev server after adding.

### Wrong Environment Detected

**Symptoms**: Shows "DEV" label in production

**Cause**: `VERCEL_ENV` not set or incorrect

**Solution**:

- In Vercel: Should be automatically set
- Locally: Will default to development (expected)
- Check Vercel deployment logs for environment detection

### Database Connection Fails

**Symptoms**: `Error: Can't reach database server`

**Causes**:

1. Wrong `DATABASE_URL`
2. Database not running (local)
3. IP not allowlisted (Supabase)

**Solution**:

```bash
# Verify DATABASE_URL format
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"

# Test connection
npm run prisma:studio
```

### OAuth Redirect URI Mismatch

**Symptoms**: OAuth login fails with redirect URI error

**Cause**: `NEXTAUTH_URL` doesn't match OAuth provider configuration

**Solution**:

```bash
# Ensure NEXTAUTH_URL matches deployed URL
# Production
NEXTAUTH_URL=https://volunteers.everybodyeats.nz

# Demo
NEXTAUTH_URL=https://demo.everybody-eats.vercel.app

# Update OAuth provider redirect URIs to match
```

## Environment-Specific Behavior

### Email Sending

- **Production**: Sends real emails via Campaign Monitor
- **Demo**: Sends to test email addresses
- **Development**: Logs emails to console if API key not configured

### Database Seeding

- **Production**: Only seeds admin user and shift types
- **Demo**: Seeds demo users and shifts
- Development\*\*: Seeds full test data including volunteers and signups

```bash
# Production seed (minimal)
USE_PRODUCTION_SEED=true npm run prisma:seed

# Development seed (full test data)
npm run prisma:seed
```

### Analytics

- **Production**: Tracks real user events
- **Demo**: Tracks with test project
- **Development**: Disabled or uses development project

### Feature Flags

PostHog feature flags can be environment-specific:

- Enable new features in demo/preview first
- Test thoroughly before production rollout
- Use percentage rollouts for gradual production deployment

## Related Documentation

- [Hosting & Infrastructure](/developers/hosting-infrastructure) - Deployment setup
- [Email Systems](/developers/email-systems) - Email configuration
- [Analytics Integration](/developers/analytics-integration) - PostHog setup
- [OAuth Authentication](/developers/oauth-authentication) - OAuth provider setup
