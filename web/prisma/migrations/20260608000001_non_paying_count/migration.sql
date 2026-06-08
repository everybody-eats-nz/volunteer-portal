-- Replace the manually-entered non-paying ratio with an observed non-paying
-- count; the ratio is now derived (count / customers) at display time.
ALTER TABLE "MealsServed" DROP COLUMN "nonPayingRatio";
ALTER TABLE "MealsServed" ADD COLUMN "nonPayingCount" INTEGER;
