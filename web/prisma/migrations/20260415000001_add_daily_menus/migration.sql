-- CreateTable
CREATE TABLE "DailyMenu" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL,
    "chefName" TEXT,
    "announcement" TEXT,
    "starter" JSONB NOT NULL DEFAULT '[]',
    "mains" JSONB NOT NULL DEFAULT '[]',
    "drink" JSONB NOT NULL DEFAULT '[]',
    "dessert" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "DailyMenu_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyMenu_date_location_key" ON "DailyMenu"("date", "location");

-- CreateIndex
CREATE INDEX "DailyMenu_location_date_idx" ON "DailyMenu"("location", "date");

-- CreateIndex
CREATE INDEX "DailyMenu_date_idx" ON "DailyMenu"("date");
