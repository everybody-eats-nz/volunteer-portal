import { PostHog } from 'posthog-react-native';

const apiKey = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const host =
  process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

/**
 * Shared PostHog client for the mobile app.
 * `null` when the API key is missing — e.g. local dev without a
 * `.env.local` entry — so consumers can no-op gracefully.
 */
export const posthog = apiKey
  ? new PostHog(apiKey, {
      host,
      // Autocapture app open/close/background transitions so we get
      // basic engagement without per-screen instrumentation.
      captureAppLifecycleEvents: true,
      // Capture unhandled JS errors and promise rejections so we can
      // monitor them in PostHog's error tracking. `console` is left off
      // to avoid duplicates from React's automatic error logging.
      errorTracking: {
        autocapture: {
          uncaughtExceptions: true,
          unhandledRejections: true,
          console: [],
        },
      },
    })
  : null;
