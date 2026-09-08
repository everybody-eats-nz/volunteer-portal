import type { PrismaClient } from "../src/generated/client";
import { seedVanFleet } from "./seed-van-fleet";

/**
 * Demo trips for the van mileage log.
 *
 * Six records are broken on purpose. The exceptions view is half the product —
 * aggregating the paper book was painful, but the real damage was that nobody
 * could tell when it was wrong — so a demo where everything reconciles shows
 * the least interesting half of the app. These are the five failure modes it
 * detects, plus a handover close:
 *
 *   - 37 km of driving between two logged trips on the Kai Van
 *   - a 512 km mistyped reading, and the backwards reading it causes next
 *   - two trips recorded without an odometer photo
 *   - the Tāmaki Van left signed out for days
 *   - a trip closed by the next driver rather than its own
 *
 * Everything is generated relative to the moment the seed runs, so the demo
 * never ages into a screen full of stale dates.
 */

const DAY_MS = 86_400_000;

/** Deterministic PRNG, so two runs on the same day produce the same data. */
function makeRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

export async function seedVanDemoData(prisma: PrismaClient): Promise<void> {
  await seedVanFleet(prisma);

  console.log("🚐 Seeding van mileage demo trips...");

  const [vehicles, organisations, purposes] = await Promise.all([
    prisma.vehicle.findMany({ orderBy: { name: "asc" } }),
    prisma.organisation.findMany(),
    prisma.tripPurpose.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const everybodyEats = organisations.find((o) => o.name === "Everybody Eats")!;
  const hopper = organisations.find((o) => o.name === "Hopper Cafe")!;
  const sustainability = organisations.find(
    (o) => o.name === "Sustainability Trust"
  )!;
  const catchAll = organisations.find((o) => o.isCatchAll)!;

  const kaiVan = vehicles.find((v) => v.homeCity === "Wellington");
  const tamakiVan = vehicles.find((v) => v.homeCity === "Auckland");
  if (!kaiVan || !tamakiVan) {
    console.warn("⚠️  Van fleet missing, skipping van demo trips");
    return;
  }

  // ---- Drivers -----------------------------------------------------------
  // Driving is a capability, not a role: every one of these keeps whatever
  // User.role they already had.
  const driverSpecs = [
    { email: "volunteer@example.com", status: "APPROVED", org: everybodyEats },
    { email: "vol1@example.com", status: "PENDING", org: everybodyEats },
    { email: "vol2@example.com", status: "APPROVED", org: sustainability },
    { email: "vol3@example.com", status: "APPROVED", org: hopper },
    { email: "vol4@example.com", status: "APPROVED", org: everybodyEats },
    { email: "vol5@example.com", status: "SUSPENDED", org: everybodyEats },
  ] as const;

  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  const drivers: Array<{ id: string; email: string }> = [];

  for (const spec of driverSpecs) {
    const user = await prisma.user.findUnique({
      where: { email: spec.email },
      select: { id: true, email: true },
    });
    if (!user) continue;

    await prisma.driverProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        status: spec.status,
        organisationId: spec.org.id,
        licenceClass: "1",
        licenceExpiry: new Date(Date.now() + 400 * DAY_MS),
        approvedById: spec.status === "APPROVED" ? admin?.id ?? null : null,
        approvedAt: spec.status === "APPROVED" ? new Date() : null,
        statusNote:
          spec.status === "SUSPENDED"
            ? "Licence expired — send a photo of the renewal and we will switch this back on."
            : null,
      },
    });

    if (spec.status === "APPROVED") drivers.push(user);
  }

  if (drivers.length === 0) {
    console.warn("⚠️  No demo users to attach drivers to, skipping van trips");
    return;
  }

  const existingTrips = await prisma.trip.count();
  if (existingTrips > 0) {
    console.log(`✅ Van trips already seeded (${existingTrips}), skipping`);
    return;
  }

  // ---- Trips -------------------------------------------------------------
  const now = new Date();
  const random = makeRandom(20_260_907);
  const pick = <T>(items: readonly T[]): T =>
    items[Math.floor(random() * items.length)]!;

  interface PlannedTrip {
    vehicleId: string;
    driverId: string;
    organisationId: string;
    externalOrgName: string | null;
    purposeId: string | null;
    purposeOther: string | null;
    startedAt: Date;
    endedAt: Date;
    startOdo: number;
    endOdo: number;
    startPhoto: boolean;
    endPhoto: boolean;
    status: "CLOSED" | "FLAGGED";
    endedByOther: boolean;
  }

  const planned: PlannedTrip[] = [];
  const odo: Record<string, number> = {
    [kaiVan.id]: 148_320,
    [tamakiVan.id]: 211_540,
  };

  // Food rescue dominates, which is what makes the 512 km typo below able to
  // push Catering Delivery above it on the dashboard.
  const purposeWeights = [
    ...Array(6).fill(purposes[0]),
    ...Array(2).fill(purposes[1] ?? purposes[0]),
    purposes[2] ?? purposes[0],
  ].filter(Boolean);

  // The Tāmaki Van is left signed out below, and that stranded trip has to be
  // the newest one on its van: a later trip would start below where the open
  // one began and manufacture exceptions nobody intended.
  const TAMAKI_QUIET_DAYS = 5;

  for (let daysAgo = 90; daysAgo >= 1; daysAgo--) {
    for (const vehicle of [kaiVan, tamakiVan]) {
      if (vehicle.id === tamakiVan.id && daysAgo < TAMAKI_QUIET_DAYS) continue;
      const tripsToday = random() < 0.55 ? (random() < 0.3 ? 2 : 1) : 0;
      for (let n = 0; n < tripsToday; n++) {
        const startHour = 8 + n * 5 + Math.floor(random() * 3);
        const startedAt = new Date(now.getTime() - daysAgo * DAY_MS);
        startedAt.setHours(startHour, Math.floor(random() * 60), 0, 0);
        const durationMins = 45 + Math.floor(random() * 150);
        const endedAt = new Date(startedAt.getTime() + durationMins * 60_000);
        const distance = 8 + Math.floor(random() * 46);

        // Most trips are Everybody Eats' own work; the van is lent out on
        // roughly one run in six, which is the ratio the funding report cares
        // about.
        const roll = random();
        const org =
          roll < 0.75
            ? everybodyEats
            : roll < 0.87
              ? hopper
              : roll < 0.95
                ? sustainability
                : catchAll;
        const isBorrowed = !org.isInternal;

        const startOdo = odo[vehicle.id]!;
        const endOdo = startOdo + distance;
        odo[vehicle.id] = endOdo;

        planned.push({
          vehicleId: vehicle.id,
          driverId: pick(drivers).id,
          organisationId: org.id,
          externalOrgName: org.isCatchAll ? "Wellington City Mission" : null,
          purposeId: isBorrowed ? null : pick(purposeWeights).id,
          purposeOther: isBorrowed ? "Moving donated furniture" : null,
          startedAt,
          endedAt,
          startOdo,
          endOdo,
          startPhoto: true,
          endPhoto: true,
          status: "CLOSED",
          endedByOther: false,
        });
      }
    }
  }

  const kaiTrips = planned.filter((t) => t.vehicleId === kaiVan.id);
  const tamakiTrips = planned.filter((t) => t.vehicleId === tamakiVan.id);

  // --- Deliberate breakage 1: 37 km driven without a trip being opened. ---
  // Shifting one trip's start forward leaves a gap the chain cannot explain.
  const gapIndex = Math.floor(kaiTrips.length * 0.4);
  const gapTrip = kaiTrips[gapIndex];
  if (gapTrip) {
    gapTrip.startOdo += 37;
    gapTrip.endOdo += 37;
    for (const later of kaiTrips.slice(gapIndex + 1)) {
      later.startOdo += 37;
      later.endOdo += 37;
    }
  }

  // --- Breakage 2: a mistyped end reading, and the backwards reading next. ---
  // 512 km on a catering run is enough to overtake food rescue on the
  // dashboard, which is the point: the dashboard says so rather than quietly
  // reporting a total nobody should quote.
  const typoIndex = Math.floor(kaiTrips.length * 0.65);
  const typoTrip = kaiTrips[typoIndex];
  if (typoTrip) {
    typoTrip.endOdo = typoTrip.startOdo + 512;
    typoTrip.purposeId = purposes[1]?.id ?? typoTrip.purposeId;
    typoTrip.status = "FLAGGED";
    // The next trip reads the real dial, so it starts below where this one
    // claims to have ended.
  }

  // --- Breakage 3: two trips recorded without a photo. ---
  const noPhotoA = kaiTrips[Math.floor(kaiTrips.length * 0.2)];
  if (noPhotoA) noPhotoA.endPhoto = false;
  const noPhotoB = tamakiTrips[Math.floor(tamakiTrips.length * 0.5)];
  if (noPhotoB) noPhotoB.startPhoto = false;

  // --- Breakage 4: a trip the driver never ended. ---
  const handoverIndex = Math.floor(tamakiTrips.length * 0.3);
  const handover = tamakiTrips[handoverIndex];
  const nextAfterHandover = tamakiTrips[handoverIndex + 1];
  if (handover && nextAfterHandover) {
    handover.endedByOther = true;
    handover.status = "FLAGGED";
    handover.endedAt = nextAfterHandover.startedAt;
    handover.endOdo = nextAfterHandover.startOdo;
    handover.endPhoto = true;
  }

  // A sentinel, not a URL. `OdoPhoto` recognises it and draws a dial showing
  // the reading actually recorded against the trip, so the office can hold the
  // number against the picture the way they will with real photos. Nothing is
  // uploaded to storage for demo data.
  const SEED_PHOTO = "seed:odo";
  const photoUrl = () => SEED_PHOTO;

  for (const trip of planned) {
    await prisma.trip.create({
      data: {
        vehicleId: trip.vehicleId,
        driverId: trip.driverId,
        organisationId: trip.organisationId,
        externalOrgName: trip.externalOrgName,
        purposeId: trip.purposeId,
        purposeOther: trip.purposeOther,
        startedAt: trip.startedAt,
        endedAt: trip.endedAt,
        startOdo: trip.startOdo,
        endOdo: trip.endOdo,
        startOdoPhotoUrl: trip.startPhoto ? photoUrl() : null,
        endOdoPhotoUrl: trip.endPhoto ? photoUrl() : null,
        distanceKm: trip.endOdo - trip.startOdo,
        status: trip.status,
        endedByUserId: trip.endedByOther
          ? drivers.find((d) => d.id !== trip.driverId)?.id ?? null
          : trip.driverId,
      },
    });
  }

  // --- Breakage 5: the Tāmaki Van left signed out for days. ---
  // Opened last, so the one-open-trip-per-van index has nothing to argue with.
  const strandedStart = new Date(now.getTime() - 3.4 * DAY_MS);
  await prisma.trip.create({
    data: {
      vehicleId: tamakiVan.id,
      driverId: pick(drivers).id,
      organisationId: everybodyEats.id,
      purposeId: purposes[0]?.id ?? null,
      startedAt: strandedStart,
      startOdo: odo[tamakiVan.id]!,
      startOdoPhotoUrl: photoUrl(),
      status: "OPEN",
    },
  });

  await prisma.vehicle.update({
    where: { id: kaiVan.id },
    data: { currentOdo: odo[kaiVan.id]! },
  });
  await prisma.vehicle.update({
    where: { id: tamakiVan.id },
    data: { currentOdo: odo[tamakiVan.id]! },
  });

  console.log(
    `✅ Seeded ${planned.length + 1} van trips, including six deliberately broken records`
  );
}
