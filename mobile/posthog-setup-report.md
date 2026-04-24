<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the Everybody Eats mobile app (`mobile/`). The SDK (`posthog-react-native`) was already installed and `PostHogProvider` was already wired into `app/_layout.tsx`. The integration built on this foundation by adding targeted event captures across the core volunteer workflows.

**Environment**: `EXPO_PUBLIC_POSTHOG_KEY` and `EXPO_PUBLIC_POSTHOG_HOST` written to `mobile/.env.local`.

**Existing events** (already in place before this session):
- `user_logged_in` — in `lib/auth.ts`, fires on all login methods with `method` property
- `user_logged_out` — in `lib/auth.ts`
- `user_account_deleted` — in `lib/auth.ts`
- User identification (`posthog.identify`) — fires on login and session restore

**New events added in this session**:

| Event | Description | File |
|-------|-------------|------|
| `shift_viewed` | Volunteer opens a shift detail screen. Top of the signup conversion funnel. | `app/shift/[id].tsx` |
| `shift_signup_started` | Volunteer taps 'Join this shift' or 'Join the waitlist' — opens the signup sheet. | `app/shift/[id].tsx` |
| `shift_signup_completed` | Volunteer successfully signs up for a shift (status CONFIRMED or PENDING). | `app/shift/[id].tsx` |
| `shift_waitlist_joined` | Volunteer successfully joins the waitlist for a full shift. | `app/shift/[id].tsx` |
| `shift_signup_cancelled` | Volunteer cancels their existing signup for a shift. | `app/shift/[id].tsx` |
| `shift_shared` | Volunteer shares a shift via the native share sheet. | `app/shift/[id].tsx` |
| `login_failed` | A login attempt failed (email/password, OAuth, or passkey). Signals UX friction. | `app/(auth)/login.tsx` |
| `profile_updated` | Volunteer saves their profile changes successfully. | `app/profile/edit.tsx` |
| `notification_tapped` | Volunteer taps a push notification to open the app. | `app/_layout.tsx` |
| `calendar_sync_toggled` | Volunteer enables or disables calendar sync from the profile screen. | `app/(tabs)/profile.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard — Analytics basics**: https://us.posthog.com/project/211852/dashboard/1505308
- **Shift Signup Funnel** (shift_viewed → signup_started → signup_completed): https://us.posthog.com/project/211852/insights/EimsOrFh
- **Login Failures by Method** (breakdown by auth method): https://us.posthog.com/project/211852/insights/XPsq7iQV
- **Signups vs Cancellations** (retention signal): https://us.posthog.com/project/211852/insights/M53monA5
- **Push Notification Engagement**: https://us.posthog.com/project/211852/insights/ReB7AJNz
- **Shift Shares** (viral loop): https://us.posthog.com/project/211852/insights/fFj8TsE9

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-expo/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
