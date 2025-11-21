---
title: Analytics Integration
description: PostHog analytics and user tracking implementation
---

The Volunteer Portal uses **[PostHog](https://posthog.com/)** for analytics, user behavior tracking, and feature flag management.

## Overview

PostHog provides:

- **User Behavior Tracking**: Page views, user interactions, and custom events
- **Feature Flags**: Enable/disable features for specific users or groups
- **Session Recording**: Opt-in session replay for debugging (when enabled)
- **Product Analytics**: Funnels, retention, and user journey analysis

## Configuration

### Environment Variables

Add these to your `.env.local` file:

```bash
# PostHog Configuration
NEXT_PUBLIC_POSTHOG_KEY=phc_your_project_key_here
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

**Where to find these values:**

1. Log in to [PostHog](https://app.posthog.com/)
2. Navigate to your project settings
3. Copy the "Project API Key" for `NEXT_PUBLIC_POSTHOG_KEY`
4. The host URL is typically `https://us.i.posthog.com` (US region)

### Getting Access

To get access to the PostHog dashboard, see the [Developer Access Guide](/developers/developer-access-guide#posthog-analytics-platform).

## Implementation

### Client-Side Tracking

PostHog is initialized on the client side via the `PHProvider` component:

**File**: `web/src/app/posthog-provider.tsx`

```typescript
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";

// Initialize PostHog
if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: "/ingest",
    ui_host: "https://us.posthog.com",
    capture_pageview: false,
    capture_pageleave: true,
    person_profiles: "identified_only",
  });
}
```

**Configuration Options:**

- `api_host: "/ingest"` - Routes requests through Next.js to avoid ad blockers
- `capture_pageview: false` - Manual pageview tracking for App Router
- `capture_pageleave: true` - Tracks when users leave pages
- `person_profiles: "identified_only"` - Only create user profiles for logged-in users

### Server-Side Tracking

For server-side events and feature flags, use the server client:

**File**: `web/src/lib/posthog-server.ts`

```typescript
import { PostHog } from "posthog-node";

// Create server-side PostHog client
const posthogClient = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
  host: "https://us.posthog.com",
});
```

## Feature Flags

Feature flags allow you to enable/disable features without deploying code.

### Checking Feature Flags (Server)

```typescript
import { isFeatureEnabled } from "@/lib/posthog-server";

// Check if a feature is enabled for a user
const isEnabled = await isFeatureEnabled("new-feature", userId);

if (isEnabled) {
  // Show new feature
}
```

### Checking Feature Flags (Client)

```typescript
import { useFeatureFlagEnabled } from "posthog-js/react";

function MyComponent() {
  const isEnabled = useFeatureFlagEnabled("new-feature");

  if (isEnabled) {
    return <NewFeature />;
  }

  return <OldFeature />;
}
```

## Custom Events

Track custom user actions for analytics:

```typescript
import { usePostHog } from "posthog-js/react";

function ShiftBooking() {
  const posthog = usePostHog();

  const handleBookShift = () => {
    // Track custom event
    posthog.capture("shift_booked", {
      shift_id: shiftId,
      shift_type: shiftType,
      location: location,
    });

    // ... booking logic
  };
}
```

## User Identification

Identify users when they log in to track their journey:

```typescript
import { usePostHog } from "posthog-js/react";

function identifyUser(user: User) {
  const posthog = usePostHog();

  posthog.identify(user.id, {
    email: user.email,
    name: `${user.firstName} ${user.lastName}`,
    role: user.role,
  });
}
```

## Privacy & GDPR Compliance

PostHog is configured to respect user privacy:

- **No tracking before identification**: Only identified users have profiles
- **Anonymous tracking**: Page views are tracked anonymously until login
- **Session recording**: Disabled by default (can be enabled per-user if needed)
- **Data location**: Hosted in US region
- **Opt-out available**: Users can opt out of tracking

### Disabling Tracking

To disable PostHog tracking entirely (for development or testing):

```bash
# Remove or comment out in .env.local
# NEXT_PUBLIC_POSTHOG_KEY=
```

When the API key is not set, PostHog will not initialize.

## Dashboard & Insights

Access the PostHog dashboard at [app.posthog.com](https://app.posthog.com) to view:

- **Trends**: Track events over time
- **Funnels**: Analyze conversion flows
- **Retention**: See user retention patterns
- **User Paths**: Understand navigation patterns
- **Feature Flags**: Manage feature rollouts

## Troubleshooting

### PostHog not loading

**Check:**
1. `NEXT_PUBLIC_POSTHOG_KEY` is set in environment variables
2. Browser console for errors
3. Ad blockers are not blocking PostHog requests

### Events not appearing

**Possible causes:**
- API key is incorrect
- User is not identified (for person-specific events)
- Network issues or ad blockers
- Check PostHog dashboard's "Live Events" to see incoming events

## Best Practices

1. **Event Naming**: Use lowercase with underscores (e.g., `shift_booked`, `profile_updated`)
2. **Event Properties**: Include relevant context (IDs, types, locations)
3. **Feature Flags**: Test flags in development before rolling out to production
4. **Privacy**: Only track necessary data, avoid sensitive personal information
5. **Performance**: Don't track too many events - focus on key user actions

## Related Documentation

- [Hosting & Infrastructure](/developers/hosting-infrastructure) - PostHog service configuration
- [Developer Access Guide](/developers/developer-access-guide) - How to get PostHog access
