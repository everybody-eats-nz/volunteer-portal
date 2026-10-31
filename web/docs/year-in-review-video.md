# Year in mahi video

A Spotify Wrapped style video of one volunteer's year, built with
[Remotion](https://www.remotion.dev) and sized for Instagram Stories and Reels.
Everybody Eats is a charity, so it uses Remotion under the free licence for
non-profits.

## Where people see it

| Where | What |
|-------|------|
| `/admin/year-in-review` | Managers switch it on for everyone, pick the year, and watch or download anyone's video |
| `/dashboard` | A banner once it's on, for anyone with a completed shift that year |
| `/year-in-review` | The volunteer's video: player, then "Get the video" renders the MP4 on the server for Download / Share |
| Mobile home tab | A card that opens `app/year-in-review.tsx`, a WebView onto `/embed/year-in-review` |

Admins and volunteers are treated alike: everyone with a completed shift
that year gets a video.

**Managers:** for now only Malin (hardcoded in
`lib/year-in-review-settings.ts`, `canManageYearInReview`) sees the admin
page, its sidebar and command palette entries, can watch anyone's video, and
can open theirs before it's switched on. Other admins are treated like
volunteers. `YEAR_IN_REVIEW_MANAGER_EMAILS` (comma separated) adds more; the
e2e server sets it to the seeded admin.

### Rendering on the server

"Get the video" (web) and "Save or share video" (app) call
`POST /api/year-in-review/video`, which queues a `YearInReviewVideo` job and
answers straight away; the page polls `GET` for progress. A single loop inside
the web container renders queued jobs one at a time with `@remotion/renderer`
and Chrome Headless Shell, using half the CPUs so the site stays responsive.
Requests never wait on a render: Cloudflare cuts requests off at 100 seconds.

- **Caching:** a finished video is reused until the person's stats change. A
  year in progress moves daily (the Everybody Eats totals), so a video under
  a day old is reused regardless. Failed renders are retried on the next ask.
- **Restarts:** a render cut off mid-way (deploy, crash) is picked up again
  once it's 15 minutes stale, the next time anyone asks or polls.
- **Storage:** a private Supabase bucket, `year-in-review` (created on first
  upload). Files are served only through `/api/year-in-review/video/file`, to
  the owner or a manager. Without Supabase (local dev, CI) they go to
  `$YEAR_IN_REVIEW_VIDEO_DIR` or the OS temp dir.
- **Access:** session or the app's bearer token. Managers may pass `?userId=`
  and `?year=` for anyone's video (`lib/year-in-review-access.server.ts`).
- **Image:** CI runs `npm run video:bundle` after `next build`; the Dockerfile
  copies `remotion-bundle/` (source maps included: the renderer reads them),
  installs Chrome's shared libraries and colour emoji, and fetches Chrome
  Headless Shell into `node_modules/.remotion`. `next.config.ts` ships
  `@remotion/renderer` and every package it depends on whole into the
  standalone output, because file tracing misses the native compositor and
  picks ESM builds where the renderer `require()`s CommonJS ones. Locally,
  run `npm run video:bundle` once before asking for a video.
- **Resources:** a render holds Chrome (~0.5-1 GB RAM) for about a minute.
  Videos render on demand, not all at once when the switch is turned on.

### In the app

The app opens `/embed/year-in-review` in a WebView with its bearer token as
an `Authorization` header (`getMobileUserFromHeaders`), so the player updates
without an app release. `/embed/*` pages render without the site header and
footer. The app's own "Save or share video" button asks for the MP4, shows
progress, then downloads it with the token and opens the share sheet. The
home card asks `GET /api/mobile/year-in-review` whether to show.

## Making a video from the command line

```bash
cd web
npm run video:props -- volunteer@example.com 2026   # year defaults to this NZ year
npm run video:studio -- --props=out/year-in-review/<userId>-2026.json
npm run video:render -- --props=out/year-in-review/<userId>-2026.json
```

`video:props` reads the database in `DATABASE_URL` and writes the props JSON
to `out/` (gitignored). Studio runs on http://localhost:3200 and shows a
sample volunteer when no `--props` is passed. Renders land in `out/` as
`year-in-mahi-<year>-<name>.mp4`.

## What it shows

| Scene | Data | Shown when |
|-------|------|-----------|
| Intro | Profile photo (else the logo), first name, year | Always |
| Shifts | Completed shifts, hours, first shift | Always |
| Meals | People served on their nights (all report types) and food saved | They have day reports |
| Rhythm | Shifts per month, favourite weekday | Always |
| Roles | Shift types ranked, home restaurant | Always |
| Crew | Volunteers on the same nights, top 3 friends | Anyone else was on |
| Achievements | Badges unlocked that year | Any unlocked |
| Top percent | Rank by shifts among that year's volunteers | Top 25% |
| Together | Everybody Eats meals, service nights, volunteers, hours, events | Always |
| Docket | Summary as a kitchen docket | Always |
| Outro | Thanks and sign-off | Always |

A shift counts once it's CONFIRMED and has finished, the same basis as hours
and achievements elsewhere. A year in progress covers the year so far.
Friends with `PRIVATE` visibility are never named.

## Look and motion

Type and colour follow everybodyeats.nz: light Fraunces headlines set tight
with an italic phrase ("Kia ora, *Aroha*"), Plus Jakarta Sans for sentences,
JetBrains Mono on the dockets, and the site's cream, forest, soft sun
(`#f8fb69`) and peach. The Fraunces files in `public/fonts` are instanced
and subset from the site's variable fonts (see `theme.ts`).

The whole video is served on one object, a plate, after the site's "one
plate at a time":

- **The intro** sets a plate down on a dark field and rolls the year up on
  it. The first cut opens from that plate's edge, so the plate grows into
  the next scene.
- **Every cut is a plate iris** (`components/plate-iris.tsx`): a circle with
  a white rim opens from the middle of the frame in the next scene's colour
  while the old scene sinks back, smaller and in shadow. Each scene's
  entrances wait until the iris has opened (`REVEAL_SECONDS` in
  `components/motion.tsx`).
- **Photos sit on plates** (`PhotoPlate` in `components/plate.tsx`): a round
  crop in a white rim, set down with a clink and a slow push-in. The app's
  shift cover photos, cropped so nobody's face is in frame except in the
  dining room and catering spread, in `public/year-in-review/`
  (`shift-photos.ts` mirrors the app's `getShiftThemeByName`; keep them in
  step).

Every cut lands on the beat. The music bed runs at 92 BPM (`BEAT` in
`timeline.ts`); scenes are whole beats long, scene starts are rounded from
the running beat count so they never drift, and the hero number in each
scene lands on a beat too, then breathes with the bed (`useBeatPulse`).
Big counts climb from zero (`components/climb.tsx`), fast then easing in,
the figure widening as it grows, then squash into place with a click
(`useSquash`, after the kinetic-type idea of letters set under pressure).
Odometer reels were tried and dropped: Fraunces' light figures look broken
mid-roll. Lines of display type
rise word by word out of a mask (`Words`).

Scene by scene: shifts stack up as plates while the count steps; the role
name runs as two tickers against each other, one filled and one outlined;
the months grow as a plain bar chart; the crowd blooms out in a sunflower
spiral; badges fan open like a hand of
cards from a pin below them; the top-percent number counts down while
plate rims ripple out behind it; events hang on the kitchen ticket rail;
the docket prints and is stamped; the outro lights up the site's
dining-room mural (from marketing-cms, as a WebP mask tinted cream).

Every scene's colours are in `sceneColors` in `theme.ts`. Flat colour on
purpose: a paper grain overlay was tried and made the MP4 3.6 times bigger.

The kawakawa illustration is cropped along its top edge, so it hangs from
the top of the frame (behind Instagram's header), never mid-frame.

## Sound

Mostly sound effects, timed to the motion, over a quiet music bed: a whip
as each plate iris opens, a click as each count lands, the plate set down, plates stacking in the tally, a marimba run round the month
clock, a shimmer as the crowd blooms, a confetti pop and a ting as each
badge card fans out, a bell when the top percent lands, dockets swishing
onto the rail, the docket printer stepping and the stamp coming down.

- `components/sound.tsx` places each effect (`<Sound name at volume>`),
  mounted only while it plays; `MIX` lifts them all together and
  `MUSIC_VOLUME` sets the bed. A full render peaks around -4 dBFS.
- Whoosh, whip, page turn, mouse click and ding come from Remotion's sound
  library, copied into `public/year-in-review/audio/`. Everything else,
  music included, is synthesised by `npm run video:sounds`
  (`scripts/year-in-review-sounds.ts`), so Everybody Eats owns it and
  Instagram's copyright matching has nothing to flag. Volunteers can still
  turn the video's sound down and add a song in Instagram.
- The web player plays audio through a pool of shared `<audio>` tags on
  phones (`numberOfSharedAudioTags`); raise it if a scene ever stacks more
  sounds at once.

## Instagram fit

- 1080 x 1920 (9:16), H.264, yuv420p, 30 fps, AAC audio at 128k.
- Content stays out of the top 250px and bottom 400px, where Instagram draws
  its own UI (`layout` in `src/remotion/year-in-review/theme.ts`).
- With every scene it runs 82 beats, about 53 seconds, under the 60 second
  Story limit. `timeline.test.ts` guards this, and that every scene starts
  on a beat.

## Code

| Path | Role |
|------|------|
| `src/lib/year-in-review.server.ts` | Prisma queries, builds the props |
| `src/lib/year-in-review.ts` | Pure aggregation (unit tested) |
| `src/remotion/year-in-review/schema.ts` | Zod props schema shared by both sides |
| `src/remotion/year-in-review/timeline.ts` | Scene order, optional scenes, beat grid, duration |
| `src/remotion/year-in-review/scenes/` | One component per scene |
| `scripts/year-in-review-props.ts` | CLI behind `video:props` |
| `src/lib/year-in-review-settings.ts` | On/off switch and year (site settings, category `YEAR_IN_REVIEW`) |
| `src/lib/year-in-review-render.server.ts` | Render queue: request, claim, render, store |
| `src/lib/year-in-review-video-storage.server.ts` | Private bucket (or local disk) for the MP4s |
| `src/app/api/year-in-review/video/` | Request / poll, and the file itself |
| `src/components/year-in-review/` | Player, share panel and its polling hook, dashboard banner |
| `src/app/admin/year-in-review/` | Admin page |
| `scripts/year-in-review-sounds.ts` | Synthesises the music bed and sound effects (`npm run video:sounds`) |
| `remotion.config.ts` | Entry point, Studio port, codecs |
