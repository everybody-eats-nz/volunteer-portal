# Store screenshots

Marketing screenshots for the App Store and Google Play listings. Each one is
a real screen captured from the iOS simulator, set in a phone frame on a brand
panel under a Fraunces headline.

| # | Screen | Headline |
|---|--------|----------|
| 1 | Home | Your mahi, *all in one place* |
| 2 | Shifts | Find a shift that *fits your week* |
| 3 | Shift detail | See *who's on* before you arrive |
| 4 | Message the team | Bringing a friend? *Just ask the team* |
| 5 | Profile, Whānau | Grow your *whānau* |
| 6 | Achievements sheet | Every milestone, *celebrated* |

## Output

| Folder | Size | For |
|--------|------|-----|
| `ios-6.9/` | 1320 x 2868 | App Store, iPhone 6.9" (required) |
| `ios-6.5/` | 1284 x 2778 | App Store, iPhone 6.5" |
| `android/` | 1080 x 1920 | Google Play, phone (9:16; Play caps the long side at 2x the short) |

PNGs are RGB with no alpha channel, which App Store Connect requires.

## Files

- `source/*.png`: raw simulator captures (iPhone 17 Pro Max, 1320 x 2868).
- `compose.html`: lays out one screenshot. Headlines and panel colours live in
  its `SHOTS` map. Preview a single shot by opening
  `compose.html?shot=home&w=1320&h=2868&frame=ios` in a browser.
- `render.mjs`: renders every shot at every size with the web app's
  Playwright and sharp.
- `demo-data.sql`: tidies a seeded demo database for capturing.
- `fonts/`: Fraunces Light and Light Italic (SIL Open Font License).

## Re-render after changing a headline

```bash
cd web && npm install && npx playwright install chromium
cd .. && node mobile/store-assets/screenshots/render.mjs
```

Pass shot names to render only those, e.g. `render.mjs home shifts`.

## Recapture the screens

The screens need believable data and no real volunteers, so they come from a
throwaway database, never production.

1. Create a scratch database, migrate it and seed it with demo data (from
   `web/`, with `DATABASE_URL` pointing at the scratch database):
   `npx prisma migrate deploy`, then `npx tsx prisma/seed-demo.ts`. The seed
   gives everyone a random name and stock photo.
2. Run `psql "$DATABASE_URL" -f mobile/store-assets/screenshots/demo-data.sql`.
   Optionally give `volunteer@example.com` the name and photo you want as the
   signed-in volunteer.
3. Start the web app against that database on a spare port and point a dev
   build of the mobile app at it (temporarily set `API_URL` in
   `mobile/lib/api.ts`; don't commit it). Sign in as `volunteer@example.com`
   (password `volunteer123`).
4. Use an iPhone 17 Pro Max simulator with a clean status bar:
   `xcrun simctl status_bar <udid> override --time 9:41 --batteryState charged --batteryLevel 100 --cellularMode active --cellularBars 4 --wifiBars 3 --dataNetwork wifi`
5. The achievements sheet appears on the first launch after step 2, because
   achievements unlock again. Capture it, then push the unlocks back in time
   so friends' sign-ups lead the home feed:
   `UPDATE "UserAchievement" SET "unlockedAt" = "unlockedAt" - interval '60 days' WHERE "userId" = (SELECT id FROM "User" WHERE email = 'volunteer@example.com');`
6. Capture each screen with `xcrun simctl io <udid> screenshot source/<name>.png`
   and run `render.mjs`.
