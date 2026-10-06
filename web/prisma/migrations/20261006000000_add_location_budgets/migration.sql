-- CreateTable
CREATE TABLE "LocationBudget" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "annualTarget" DECIMAL(12,2) NOT NULL,
    "plannedServiceNights" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "LocationBudget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LocationBudget_year_idx" ON "LocationBudget"("year");

-- CreateIndex
CREATE UNIQUE INDEX "LocationBudget_locationId_year_key" ON "LocationBudget"("locationId", "year");

-- AddForeignKey
ALTER TABLE "LocationBudget" ADD CONSTRAINT "LocationBudget_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
