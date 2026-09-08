-- Van mileage log: replaces the paper Collins log book in the Everybody Eats
-- vans. The vans were sponsored by a decarbonisation fund, so the point of the
-- schema is the monthly breakdown Meridian gets — every column here exists to
-- make that report defensible, not to make data entry pretty.

CREATE TYPE "TripStatus" AS ENUM ('OPEN', 'CLOSED', 'FLAGGED');
CREATE TYPE "DriverStatus" AS ENUM ('PENDING', 'APPROVED', 'SUSPENDED');

-- Who a van was used FOR. Deliberately not "Location": a Location is a
-- restaurant with an address and a meals target, and the vans are lent to
-- organisations that have no restaurant at all.
CREATE TABLE "Organisation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "isCatchAll" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organisation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Organisation_name_key" ON "Organisation"("name");
CREATE INDEX "Organisation_isActive_idx" ON "Organisation"("isActive");

-- Exactly one catch-all row, holding trips whose borrower is a genuine one-off
-- named in Trip."externalOrgName".
CREATE UNIQUE INDEX "Organisation_single_catch_all"
  ON "Organisation" (("isCatchAll")) WHERE "isCatchAll";

CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rego" TEXT NOT NULL,
    "photoUrl" TEXT,
    "ownerOrgId" TEXT NOT NULL,
    "homeCity" TEXT NOT NULL,
    "currentOdo" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Vehicle_rego_key" ON "Vehicle"("rego");
CREATE INDEX "Vehicle_isActive_idx" ON "Vehicle"("isActive");
CREATE INDEX "Vehicle_homeCity_idx" ON "Vehicle"("homeCity");

-- Admin-editable. sortOrder is not cosmetic: whatever sits first is a one-tap
-- trip on the driver's phone.
CREATE TABLE "TripPurpose" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "requiresNote" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripPurpose_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TripPurpose_isActive_sortOrder_idx" ON "TripPurpose"("isActive", "sortOrder");

CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "externalOrgName" TEXT,
    "purposeId" TEXT,
    "purposeOther" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "startOdo" INTEGER NOT NULL,
    "endOdo" INTEGER,
    "startOdoPhotoUrl" TEXT,
    "endOdoPhotoUrl" TEXT,
    "distanceKm" INTEGER,
    "notes" TEXT,
    "status" "TripStatus" NOT NULL DEFAULT 'OPEN',
    "endedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    -- Reserved: populated by nothing today, so adding GPS later is not a
    -- migration anyone has to think about.
    "startLat" DOUBLE PRECISION,
    "startLng" DOUBLE PRECISION,
    "endLat" DOUBLE PRECISION,
    "endLng" DOUBLE PRECISION,
    "routePolyline" TEXT,
    -- Reserved: per-km recharge to borrowers, cross-charge to Hopper Cafe.
    "chargeable" BOOLEAN NOT NULL DEFAULT false,
    "rateCentsPerKm" INTEGER,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Trip_vehicleId_startedAt_idx" ON "Trip"("vehicleId", "startedAt");
CREATE INDEX "Trip_driverId_startedAt_idx" ON "Trip"("driverId", "startedAt");
CREATE INDEX "Trip_organisationId_startedAt_idx" ON "Trip"("organisationId", "startedAt");
CREATE INDEX "Trip_startedAt_idx" ON "Trip"("startedAt");
CREATE INDEX "Trip_status_idx" ON "Trip"("status");

-- A van can only be in one place at a time. Two drivers scanning the same
-- sticker within a second of each other would otherwise both open a trip and
-- fork the odometer chain that every exception rule reads. Prisma cannot
-- express a partial unique index, so it lives here.
CREATE UNIQUE INDEX "Trip_one_open_per_vehicle"
  ON "Trip"("vehicleId") WHERE "status" = 'OPEN';

-- Driving is a capability, not a role: User.role is a single exclusive value
-- treated as binary in ~37 places, and a volunteer who also drives the van has
-- to stay a volunteer. Modelled the way RestaurantManager is.
CREATE TABLE "DriverProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "DriverStatus" NOT NULL DEFAULT 'PENDING',
    "licenceClass" TEXT,
    "licenceExpiry" TIMESTAMP(3),
    "licenceFrontUrl" TEXT,
    "licenceBackUrl" TEXT,
    "organisationId" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "statusNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DriverProfile_userId_key" ON "DriverProfile"("userId");
CREATE INDEX "DriverProfile_status_idx" ON "DriverProfile"("status");
CREATE INDEX "DriverProfile_organisationId_idx" ON "DriverProfile"("organisationId");

ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_ownerOrgId_fkey"
  FOREIGN KEY ("ownerOrgId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Trip" ADD CONSTRAINT "Trip_vehicleId_fkey"
  FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_driverId_fkey"
  FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_purposeId_fkey"
  FOREIGN KEY ("purposeId") REFERENCES "TripPurpose"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_endedByUserId_fkey"
  FOREIGN KEY ("endedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DriverProfile" ADD CONSTRAINT "DriverProfile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DriverProfile" ADD CONSTRAINT "DriverProfile_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DriverProfile" ADD CONSTRAINT "DriverProfile_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
