# Universal Links & Android App Links

Lets links to `https://volunteers.everybodyeats.nz/...` open the Everybody Eats
mobile app directly (when installed) instead of the browser. Covers iOS
Universal Links and Android App Links.

## How it works

1. The web app serves two association files from `/.well-known/`:
   - `apple-app-site-association` (iOS) — `applinks` + existing `webcredentials`.
   - `assetlinks.json` (Android).
   Both are served as `Content-Type: application/json` via a `headers()` rule in
   [`web/next.config.ts`](../next.config.ts) — required because
   `apple-app-site-association` has no file extension.
2. The mobile app declares the domain:
   - iOS: `associatedDomains: ["applinks:volunteers.everybodyeats.nz", ...]`
   - Android: an `autoVerify` HTTPS `intentFilter` scoped to the claimed paths.
   Both in [`mobile/app.json`](../../mobile/app.json).
3. Incoming links are rewritten to in-app routes by
   [`mobile/app/+native-intent.ts`](../../mobile/app/+native-intent.ts), because
   web and mobile URL structures differ (e.g. web `/shifts/:id` → mobile
   `/shift/[id]`, web `/friends/:id` → mobile `/user/[id]`).

## Claimed paths

Only these open the app; everything else (including `/api/*`, `/login`,
`/register`, `/verify-email`, `/reset-password`, `/surveys/*`, OAuth) stays in
the browser by design. **Keep these three places in sync:**

| Path             | Mobile route        |
| ---------------- | ------------------- |
| `/shifts`        | `/(tabs)/shifts`    |
| `/shifts/:id`    | `/shift/[id]`       |
| `/dashboard`     | `/(tabs)` (home)    |
| `/profile[/*]`   | `/(tabs)/profile`   |
| `/friends`       | `/(tabs)/profile`   |
| `/friends/:id`   | `/user/[id]`        |
| `/achievements*` | `/(tabs)/profile`   |

The three places: the AASA `components`, the Android `intentFilters` `data`
list, and the `mapDeepLinkToRoute` matcher in
[`mobile/lib/deep-link-routing.ts`](../../mobile/lib/deep-link-routing.ts)
(covered by `deep-link-routing.test.ts`). Android uses an exact `path` plus a
trailing-slash `pathPrefix` (e.g. `/shifts` and `/shifts/`) so it claims the
same set as the iOS `/shifts` + `/shifts/*` patterns — a bare `pathPrefix`
would also over-match unrelated paths like `/shifts-archive`.

## ⚠️ Required before Android release

`web/public/.well-known/assetlinks.json` ships with a **placeholder**
fingerprint (`REPLACE_WITH_ANDROID_APP_SIGNING_SHA256_FINGERPRINT`). Android
App Links will **not** verify until it holds the real SHA-256 cert
fingerprint(s).

Get it from the **app signing key** (the key Google re-signs with — not the
upload key):

- Google Play Console → your app → **Release → Setup → App signing** → copy the
  **SHA-256 certificate fingerprint** under "App signing key certificate".
- Or via EAS: `cd mobile && eas credentials` (Android → production).

Paste it into the `sha256_cert_fingerprints` array (multiple entries are
allowed if you also want links to verify against the upload key for internal
testing). Then redeploy the web app and reinstall the Android build.

## Verifying after deploy

- iOS AASA reachable & JSON:
  `curl -sI https://volunteers.everybodyeats.nz/.well-known/apple-app-site-association`
  (expect `content-type: application/json`).
- Android: `curl -s https://volunteers.everybodyeats.nz/.well-known/assetlinks.json`
  and Google's tester:
  `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://volunteers.everybodyeats.nz&relation=delegate_permission/common.handle_all_urls`
- Device: tap a claimed link (e.g. a `/shifts/:id` URL) and confirm the app
  opens on the right screen. Note: iOS caches the AASA — test on a fresh
  install or after re-installing the build that contains the new
  `associatedDomains`.

## Troubleshooting

- **iOS link opens Safari, not the app** — iOS fetches the AASA once at install
  via Apple's CDN and caches it. Reinstall the app after the AASA changes, and
  confirm the build contains `applinks:` in `associatedDomains`. Long-press the
  link in Messages/Notes to see an "Open in Everybody Eats" option.
- **Android opens the browser** — auto-verification failed. Check
  `adb shell pm get-app-links com.everybodyeats.app` for the verification
  state; it stays `none`/`legacy_failure` until `assetlinks.json` holds the
  real **app-signing** SHA-256 (not the upload key). Re-trigger with
  `adb shell pm verify-app-links --re-verify com.everybodyeats.app`.
- **App opens but lands on the wrong screen** — the path isn't mapped in
  `mapDeepLinkToRoute`; add a case and a test in `deep-link-routing.test.ts`.
