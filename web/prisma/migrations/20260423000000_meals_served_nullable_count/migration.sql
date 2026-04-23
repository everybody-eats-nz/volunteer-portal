-- Allow MealsServed rows with notes but no recorded count.
ALTER TABLE "MealsServed" ALTER COLUMN "mealsServed" DROP NOT NULL;
