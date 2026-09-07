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
| `/admin/van/trips` | Every trip, filterable, CSV export, odometer photos. |
| `/admin/van/exceptions` | Where the record does not add up. |
| `/admin/van/drivers` | Approve who can take a van out. |
| `/admin/van/vehicles` | The fleet, and each van's printable QR sticker. |
| `/admin/van/purposes` | What drivers pick from, and in what order. |

Library code is under `src/lib/van/`:

| File | Responsibility |
|------|----------------|
| `plausibility.ts` | The one rule shared by the driver's warning and the admin exception. |
| `exceptions.ts` | The six rules, derived at read time. Never stored. |
| `trips.ts` | Every write to a trip. Start, end, handover, notes. |
| `drivers.ts` | Driver profiles and the approval gate. |
| `queries.ts` | Reads shared by the driver and admin screens. |
| `format.ts` | NZ formatting, built on the app's `formatInNZT`. |

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

### Warn, never block

A driver stopped by a validation error in a loading bay is a driver who goes
back to the paper book. The single hard stop is an end reading at or below the
start reading — which cannot be what the dial says, and which the driver can see
and correct on the same screen. Everything else records the trip and tells the
office.

That extends to infrastructure: if the odometer photo will not upload, the
reading is still recorded and the trip lands on the missing-photo exception. A
misconfigured storage bucket never strands a driver.

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

### Seed

`prisma/seed-van-fleet.ts` holds the organisations, purposes and fleet, and is
shared by the production and demo seeds. Like the restaurant locations, the vans
and organisations are only *created* on first boot: names and regos are
admin-editable, and re-running a name-keyed upsert against a live database
resurrects anything renamed away.

**The seeded van names and registrations are placeholders** carried over from
the design prototype. An admin corrects them on `/admin/van/vehicles` before the
stickers are printed, which is part of why that screen exists.

`prisma/seed-van-demo.ts` adds ~140 trips over 90 days for development, with six
records broken on purpose so the exceptions view has something to show. Those
six produce seven exceptions — the mistyped 512 km reading causes both an
implausible distance and the backwards reading on the trip after it.

## Not built yet, but designed for

These are deliberately out of scope and deliberately not designed out:

- **Push reminder to end a forgotten trip.** The `left-open` exception already
  identifies exactly who to notify.
- **A "Drive" tab in the Expo app**, gated on an approved `DriverProfile`. The
  API routes under `/api/van/*` are the same ones it would use.
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

The reserved columns are there so that adding those later is a migration nobody
has to think hard about.
