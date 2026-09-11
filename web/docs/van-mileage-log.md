# Van Mileage Log

Replaces the paper Collins log book in the Everybody Eats vans.

The vans were sponsored by a decarbonisation fund, and Everybody Eats has to
send Meridian a monthly breakdown of how they are used. **Data entry is the
cost; the report is the product.** Every design decision below follows from
that: the driver flow exists to make the record cheap enough to actually keep,
and the exceptions view exists because a record nobody can audit is worth
nothing to a funder.

## Where things live

| Path | What it is |
|------|-----------|
| `/v/[vanId]` | The QR sticker's page. Public, permanent. |
| `/drive` | Driver's home: open trip, the fleet, their own history. |
| `/drive/vans` | Van picker, for anyone who cannot scan. |
| `/drive/trip/[tripId]` | One trip. Also where the optional note lives. |
| `/drive/trip/[tripId]/end` | End-of-trip flow. |
| `/drive/register` | Driver self-registration. |
| `/admin/van/trips` | The ledger. One month at a time, split by who and what the kilometres were for, CSV export, odometer photos. |
| `/admin/van/exceptions` | Where the record does not add up. |
| `/admin/van/drivers` | Approve who can take a van out, or add somebody directly. |
| `/admin/van/vehicles` | The fleet board: where every van is right now, its photo, and its printable QR sticker. |
| `/admin/van/purposes` | What drivers pick from, and in what order. |
| `/api/mobile/van/*` | The same flows for the Expo app's Drive tab. |

Library code is under `src/lib/van/`:

| File | Responsibility |
|------|----------------|
| `plausibility.ts` | The one rule shared by the driver's warning and the admin exception. |
| `exceptions.ts` | The six rules, derived at read time. Never stored. |
| `trips.ts` | Every write to a trip. Start, end, handover, notes. |
| `drivers.ts` | Driver profiles, the approval gate, and both doors into it. |
| `queries.ts` | Reads shared by the driver and admin screens. |
| `format.ts` | NZ formatting, built on the app's `formatInNZT`. |
| `requests.ts` | What a driver's device sends, validated once for both clients. |
| `photos.ts` | Storing one odometer photo, shared by both clients. |
| `mobile-guard.ts` | The driver gate for the app's JWT-authenticated routes. |
| `mobile-payloads.ts` | The shapes the app renders, labelled in NZ time. |
| `reminders.ts` | The nudge to end a forgotten trip. |

## The decisions worth knowing

### The QR URL is permanent

A laminated sticker goes on each van's dashboard. `/v/[vanId]` must stay stable
forever, so it encodes the vehicle's **row id, not its rego** — renaming a van
or changing its plate never invalidates a sticker already stuck to a dashboard.
`mileage.everybodyeats.nz` is a domain alias onto this project pointing at it.

The page stays dumb: it decides what to show from whether the van is out, never
from how the driver arrived.

### The page is public; the action is not

Auth is required when the driver taps "Start trip", not when they open the page.
A driver scanning the sticker for the first time sees the van, its rego, its
photo and its status — not a login form. Signing in from there adds
`?passkey=1`, which fires the passkey prompt on arrival for a device that has
one, so a returning driver gets a single system prompt.

### Driving is a capability, not a role

There is no `DRIVER` in the `Role` enum, and there must not be. `User.role` is a
single exclusive value checked in ~37 places and treated as binary
(`src/middleware.ts`, `src/app/admin/volunteers/[id]/page.tsx`), so a volunteer
who also drives the van has to stay a volunteer.

Driving is modelled the way `RestaurantManager` is: a separate one-to-one
`DriverProfile` on `userId`. **The gate on starting a trip is "has an APPROVED
DriverProfile", never a role check.**

### There are two doors into the allowed list, and one decision

Drivers normally arrive by scanning the sticker and filling in `/drive/register`,
which lands them PENDING for the office to approve. That leaves the office
unable to help the person standing at the desk or on the phone, so
`/admin/van/drivers` also **adds a driver directly**: pick the person, say who
they drive for, and they can take a van out straight away.

It is deliberately the *same* decision, not a second kind of approval. The
profile lands `APPROVED` with `approvedById` and `approvedAt` stamped exactly as
the queue stamps them, so "who vouched for this driver" is answerable without
caring which door they came through. Nothing else about the account changes —
driving is a capability, so this writes a `DriverProfile` and never a role.

Two rules fall out of that:

- **Already approved is a no-op.** Re-adding somebody by mistake must not
  quietly rewrite who vouched for them or move them to another organisation.
- **A blank licence field means "the office did not retype it"**, not "this
  driver has no licence", so a driver who filled those in on their own form
  keeps what they sent.

The person still needs a portal account first; there is no account creation
here. Somebody with no login is invited from the admin users page and then
added, rather than teaching this dialog a second way to make a `User`.

Which organisations either door offers is `listSelectableOrganisations()` in
`drivers.ts` — one list, so the admin dialog can never offer an option the
driver's own form rejects, and neither can offer the catch-all.

### Warn, never block

A driver stopped by a validation error in a loading bay is a driver who goes
back to the paper book. The single hard stop is an end reading at or below the
start reading — which cannot be what the dial says, and which the driver can see
and correct on the same screen. Everything else records the trip and tells the
office.

That extends to infrastructure: if the odometer photo will not upload, the
reading is still recorded and the trip lands on the missing-photo exception. A
misconfigured storage bucket never strands a driver.

### The trips screen is organised by reporting period

Meridian asks for a month, so a month is the unit: the ledger opens on the
newest month with a trip in it and steps a month at a time, rather than opening
on "the last 1500 trips, newest first". A range and an all-time mode stay for
the questions a month cannot answer, and the export is named for whichever is
showing (`van-log-september-2026.csv`) so the file says which month it is on the
way in.

The split by organisation and by purpose is the same thing Meridian is owed, and
until it lived on this screen the office worked it out in a spreadsheet after
exporting. Hues are assigned to the five largest entities **over the whole
record, not over the current view** — assigning them by rank after filtering
would repaint every organisation that survived the filter, so a colour would
stop meaning one organisation.

The rows are ruled off by day with the day's own subtotal, because a figure the
office has to defend is checked against one day rather than against a running
sum — the same reason the paper book was ruled that way.

### The audit is on the row, not only on the exceptions page

The ledger renders the odometer as a chain: where the previous trip in that van
left the dial, then where this one started and finished. A break in that chain
is the whole audit, so it is annotated on the row itself, and anything
`detectExceptions` says about a trip is written underneath it in words.

Those annotations come from **the same `detectExceptions` the exceptions view
runs**, called once in the page and attached to each row. Recomputing the rules
for the ledger would let the two screens drift, and a ledger that disagrees with
the audit is worse than one that shows nothing.

### Exceptions are derived, never stored

`src/lib/van/exceptions.ts` is a pure function over trips, recomputed on every
load. Fix the underlying trip and the entry disappears on its own, so the list
cannot rot the way a table of resolved flags would.

`TripStatus.FLAGGED` means something narrower and is a fact about what happened,
so it *is* stored: a driver saw a warning and confirmed the reading anyway, or
the next driver closed the trip.

### One plausibility rule, one place

`src/lib/van/plausibility.ts` is shared by the driver's end-of-trip warning and
the admin exception, so a trip can never warn the driver and then look clean to
the office. Under half an hour, an average speed says more about when the driver
opened the trip than about the van, so distance alone decides.

### The app gets its own handlers, not a widened cookie route

`/api/van/*` authenticates with a NextAuth cookie. The Expo app carries a JWT
and calls `/api/mobile/*`, so it cannot reach those routes as they stand.

The fix is **not** to teach `/api/van/*` to also accept a bearer token. A
browser can be made to post to a cookie-authenticated endpoint, and "or a
bearer token" is how the CSRF protection on that path quietly stops applying —
on the very handler that writes the odometer chain. So the app gets its own
thin handlers under `/api/mobile/van/*`, guarded by `mobile-guard.ts`, calling
the same functions in `trips.ts` and `drivers.ts`.

Thin is the whole point. Every write still goes through `trips.ts`, so the
driver's warning and the office's exception list cannot drift apart no matter
which client the trip came from. Where the two clients would otherwise have
retyped the same rule — what makes a startable trip, what an odometer photo may
be — that rule moved into `requests.ts` and `photos.ts` and both call it.

### The app asks the server whether a reading looks wrong

The browser flow runs `plausibility.ts` in the page, because the page can
import it. `mobile/` is a separate package and cannot, and retyping the
thresholds in React Native is exactly the drift that module exists to prevent.

So `POST /api/mobile/van/trips/[tripId]/end` answers the question instead. An
unconfirmed reading that trips the rule comes back as `needsConfirmation` with
the same sentence the office would read, and **nothing is written**. Posting
again confirms it. An ordinary reading closes on the first post, so the common
path is still one round trip.

`FLAGGED` is set from the rule's own answer rather than from what the client
claims, so it keeps meaning what it says: a driver saw a warning and confirmed
the reading anyway.

### The QR sticker opens the app for people who have it

`/v/*` is claimed as a universal link (`apple-app-site-association`, plus the
Android intent filters in `mobile/app.json`), so scanning the sticker takes an
approved driver straight to the odometer step.

The cost is that having the app installed is not the same as being allowed to
drive. An outside borrower or an unapproved driver who happens to have it gets
pulled out of a page that would have worked, so the app's start screen hands
them back: it offers the sticker's own web page in an in-app browser rather
than showing a screen that cannot help them. A signed-out person still meets
the app's login screen first — the one case the bounce-back cannot catch.

### A van that is already out is a handover, not an auto-close

Silently closing the previous trip would write an end reading nobody observed
and corrupt the odometer chain every exception rule depends on. Instead the two
flows merge: the new driver photographs the odometer **once**, and that single
observed reading closes the open trip (recorded against `endedByUserId`, status
`FLAGGED`) and opens theirs.

The closed trip's end *time* is when the van went out again rather than when it
came back, which is why it surfaces as a `closed-by-next-driver` exception.

If the reading sits below the open trip's start — the previous driver mistyped
theirs — it is recorded anyway. The resulting negative distance surfaces as a
high-severity exception the office can fix, which is better than refusing to let
the next driver start over a mistake they cannot see.

### The reminder asks the exception list who to nudge

A van left logged out overnight is already a `left-open` exception, and that
rule already knows whose trip it is. So `reminders.ts` runs `detectExceptions`
rather than asking "has it been fourteen hours" a second time — a driver who
gets a push and an office that sees a row are looking at the same fact, and
changing when a trip counts as forgotten stays one edit.

`Trip.reminderSentAt` is the one piece of this that *is* stored. Exceptions are
derived; what we did about one is not, the way `endedByUserId` is a fact about
what happened. Without it every run would nudge the same driver again.

The cron fires hourly, but the job decides whether the hour is a civilised one
(7am–9pm NZ) rather than the schedule encoding daylight saving. A trip that
starts at 9am crosses the fourteen-hour line at 11pm, and a phone buzzing at
11pm about a van does not get the van logged any sooner — it teaches the driver
to mute us.

### Purposes are data

`/admin/van/purposes` reorders, renames, retires and adds them, and drivers read
that order on the next trip they start. **The order is not cosmetic: whatever
sits first is a one-tap trip.**

Whether a purpose prompts for free text is the `requiresNote` column, not a
match on the label `"other"` — an admin renaming that purpose must not silently
turn the prompt off.

### One open trip per van, enforced by the database

`Trip_one_open_per_vehicle` is a partial unique index
(`... ON "Trip"("vehicleId") WHERE status = 'OPEN'`). Prisma cannot express
partial indexes, so it lives in the migration SQL by hand. Two drivers scanning
the same sticker at once get one trip, not a forked odometer chain.

### External drivers are not volunteers

A Sustainability Trust driver borrowing the van is a `User` row with the default
`role: VOLUNTEER`, because driving is a capability rather than a role. Left
alone they would inflate volunteer analytics, appear on the leaderboard, receive
volunteer bulk email, and be swept up by the inactivity archiver and emailed "we
miss you" for a programme they were never in.

`src/lib/volunteer-programme.ts` is **the only place that rule is written
down**. An external driver is somebody whose `DriverProfile` belongs to a
non-internal `Organisation` — derived, so nothing has to be remembered at write
time. It exports three forms of the same rule:

```ts
import {
  inVolunteerProgramme,      // Prisma UserWhereInput fragment
  inVolunteerProgrammeSql,   // raw-SQL predicate, for the analytics queries
  isExternalDriver,          // in-memory, for a loaded user
} from "@/lib/volunteer-programme";
```

Anything that means "in the volunteer programme" rather than "has a login" takes
one of those instead of hand-rolling the join.

## Setup

### Supabase bucket

Odometer photos need a bucket named **`van-odometer`**, created once in the
Supabase dashboard (Storage → New bucket), set to **Public** for read access.
This mirrors the `resource-hub` setup in [resource-hub.md](./resource-hub.md).

It is deliberately its own bucket rather than sharing `profile-photos`: these
are evidence behind a funding report with a retention life of their own, and
they must never sit alongside the licence images that land later — those go
somewhere private and admin-only.

If the bucket is missing, uploads fail softly and trips record without photos,
landing on the missing-photo exception.

**Van photos** are different and need no new bucket. A photo of the van itself
is a reference image, not evidence, so it goes into the existing public
`resource-hub` bucket under a `van-photos/` folder, alongside the other admin
uploads. The browser crops it to 16:9 and re-encodes it before upload, which is
what keeps a phone photo inside the request limit and what keeps the fleet grid
from choosing the crop itself. A van without a photo is normal — the fleet card
draws the brand van mark in the same frame.

### Cron

`/api/cron/van-open-trip-reminders` is registered hourly in `vercel.json` and
secured with `CRON_SECRET` like the other cron routes. Without that variable
set the route refuses every request, so a misconfigured environment sends no
reminders rather than sending them to everybody.

### Seed

`prisma/seed-van-fleet.ts` holds the organisations, purposes and fleet, and is
shared by the production and demo seeds. Like the restaurant locations, the vans
and organisations are only *created* on first boot: names and regos are
admin-editable, and re-running a name-keyed upsert against a live database
resurrects anything renamed away.

**The seeded van names and registrations are placeholders** carried over from
the design prototype, and the seeded vans have no photo. An admin corrects the
names and uploads the real photos on `/admin/van/vehicles` before the stickers
are printed, which is part of why that screen exists.

`prisma/seed-van-demo.ts` adds ~140 trips over 90 days for development, with six
records broken on purpose so the exceptions view has something to show. Those
six produce seven exceptions — the mistyped 512 km reading causes both an
implausible distance and the backwards reading on the trip after it.

## Not built yet, but designed for

These are deliberately out of scope and deliberately not designed out:

- **The monthly Meridian PDF.** `/admin/van/trips` already produces the CSV the
  numbers come from.
- **Historical backfill** of two years of paper logbook, as period totals rather
  than individual trips.
- **Licence photo upload.** `licenceFrontUrl` / `licenceBackUrl` exist on
  `DriverProfile` and nothing populates them. When that lands the images go in
  **private storage readable only by admins, with a retention rule** — never the
  bucket the odometer photos use.
- **GPS.** `startLat`, `startLng`, `endLat`, `endLng` and `routePolyline` exist
  on `Trip` and are populated by nothing.
- **Per-km recharge** to borrowers or cross-charge to Hopper Cafe. `chargeable`
  and `rateCentsPerKm` exist on `Trip` and are populated by nothing.
- **OCR on the odometer photo.** The design prototype faked this; drivers type
  the reading. The photo is stored either way, which is what makes the number
  auditable.
- **Offline capture.** Neither the web flow nor the app has one: a driver in a
  basement carpark or a loading bay with no signal cannot start or end a trip,
  and the app will simply fail the request. The reading and the photo are both
  small and the trip is already designed to tolerate a missing photo, so a
  queued write is the obvious shape when it lands — but nothing today attempts
  it, and a driver with no signal still falls back to the paper book.

The reserved columns are there so that adding those later is a migration nobody
has to think hard about.
