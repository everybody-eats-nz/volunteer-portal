-- The Chef and FOH Manager (first names) running each service day at a
-- location: a standard weekly roster plus per-day overrides for swaps and
-- covers, shown to volunteers on the shift calendar.
-- CreateTable
CREATE TABLE "DayLeadRoster" (
    "id" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "chef" VARCHAR(40),
    "fohManager" VARCHAR(40),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "DayLeadRoster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DayLeadOverride" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "location" TEXT NOT NULL,
    "chef" VARCHAR(40),
    "fohManager" VARCHAR(40),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "DayLeadOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DayLeadRoster_location_dayOfWeek_key" ON "DayLeadRoster"("location", "dayOfWeek");

-- CreateIndex
CREATE INDEX "DayLeadOverride_date_idx" ON "DayLeadOverride"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DayLeadOverride_location_date_key" ON "DayLeadOverride"("location", "date");
