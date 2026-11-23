-- A day can now hold any number of fundraising activities (events and
-- catering gigs), each with its own name, guests, income and expenses.
-- Every existing event day becomes a day with one EVENT activity.

-- CreateEnum
CREATE TYPE "FundraisingActivityKind" AS ENUM ('EVENT', 'CATERING');

-- CreateTable
CREATE TABLE "FundraisingActivity" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "kind" "FundraisingActivityKind" NOT NULL DEFAULT 'EVENT',
    "name" VARCHAR(120),
    "pax" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FundraisingActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FundraisingActivity_reportId_idx" ON "FundraisingActivity"("reportId");

-- AddForeignKey
ALTER TABLE "FundraisingActivity" ADD CONSTRAINT "FundraisingActivity_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "MealsServed"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- One activity per event day (and per any other day that somehow has event
-- lines), carrying the event's name and its guests.
INSERT INTO "FundraisingActivity" ("id", "reportId", "kind", "name", "pax", "position")
SELECT gen_random_uuid()::text, m."id", 'EVENT', m."eventName",
       CASE WHEN m."reportType" = 'EVENT' THEN m."mealsServed" END, 0
FROM "MealsServed" m
WHERE m."reportType" = 'EVENT'
   OR EXISTS (SELECT 1 FROM "EventIncome" i WHERE i."reportId" = m."id")
   OR EXISTS (SELECT 1 FROM "EventExpense" e WHERE e."reportId" = m."id");

-- An event day's guests now live on its activities.
UPDATE "MealsServed" SET "mealsServed" = NULL WHERE "reportType" = 'EVENT';

-- Re-point income and expense lines from the day to its activity.
ALTER TABLE "EventIncome" ADD COLUMN "activityId" TEXT;
UPDATE "EventIncome" i SET "activityId" = a."id"
FROM "FundraisingActivity" a WHERE a."reportId" = i."reportId";
ALTER TABLE "EventIncome" ALTER COLUMN "activityId" SET NOT NULL;

ALTER TABLE "EventExpense" ADD COLUMN "activityId" TEXT;
UPDATE "EventExpense" e SET "activityId" = a."id"
FROM "FundraisingActivity" a WHERE a."reportId" = e."reportId";
ALTER TABLE "EventExpense" ALTER COLUMN "activityId" SET NOT NULL;

-- DropForeignKey
ALTER TABLE "EventIncome" DROP CONSTRAINT "EventIncome_reportId_fkey";
ALTER TABLE "EventExpense" DROP CONSTRAINT "EventExpense_reportId_fkey";

-- DropIndex
DROP INDEX "EventIncome_reportId_idx";
DROP INDEX "EventExpense_reportId_idx";

-- AlterTable
ALTER TABLE "EventIncome" DROP COLUMN "reportId";
ALTER TABLE "EventExpense" DROP COLUMN "reportId";
ALTER TABLE "MealsServed" DROP COLUMN "eventName";

-- CreateIndex
CREATE INDEX "EventIncome_activityId_idx" ON "EventIncome"("activityId");
CREATE INDEX "EventExpense_activityId_idx" ON "EventExpense"("activityId");

-- AddForeignKey
ALTER TABLE "EventIncome" ADD CONSTRAINT "EventIncome_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "FundraisingActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventExpense" ADD CONSTRAINT "EventExpense_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "FundraisingActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
