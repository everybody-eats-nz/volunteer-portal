-- Rename "meatVegeSplit" to "vege" (number of vegetarian meals) and drop the
-- unused briefing and receipts-uploaded fields.
ALTER TABLE "MealsServed" RENAME COLUMN "meatVegeSplit" TO "vege";
ALTER TABLE "MealsServed" DROP COLUMN "briefing";
ALTER TABLE "MealsServed" DROP COLUMN "receiptsUploaded";
