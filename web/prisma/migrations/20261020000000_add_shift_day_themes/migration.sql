-- A short free-text theme per service day per location ("Christmas Lunch",
-- "Pasta Night"), shown to volunteers beside the date on the shift calendar.
-- CreateTable
CREATE TABLE "ShiftDayTheme" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "location" TEXT NOT NULL,
    "theme" VARCHAR(80) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "ShiftDayTheme_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShiftDayTheme_date_idx" ON "ShiftDayTheme"("date");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftDayTheme_location_date_key" ON "ShiftDayTheme"("location", "date");
