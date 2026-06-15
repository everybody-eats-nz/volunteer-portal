import posthog from "posthog-js";
import { installDomTranslationGuard } from "@/lib/dom-translation-guard";
import { isNoiseException } from "@/lib/posthog-noise-filter";

// Protect React from in-browser translation extensions that mutate the DOM
// (Google Translate etc.) and otherwise crash the page. Runs before hydration.
installDomTranslationGuard();

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
  api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  defaults: "2025-05-24",
  // Drop extension / cross-origin exception noise before it reaches PostHog.
  before_send: (event) => {
    if (event && isNoiseException(event)) return null;
    return event;
  },
});
