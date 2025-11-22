-- CreateTable
CREATE TABLE "public"."Location" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "defaultMealsServed" INTEGER NOT NULL DEFAULT 60,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MealsServed" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL,
    "mealsServed" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "MealsServed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Location_name_key" ON "public"."Location"("name");

-- CreateIndex
CREATE INDEX "Location_isActive_idx" ON "public"."Location"("isActive");

-- CreateIndex
CREATE INDEX "MealsServed_location_date_idx" ON "public"."MealsServed"("location", "date");

-- CreateIndex
CREATE INDEX "MealsServed_date_idx" ON "public"."MealsServed"("date");

-- CreateIndex
CREATE UNIQUE INDEX "MealsServed_date_location_key" ON "public"."MealsServed"("date", "location");
