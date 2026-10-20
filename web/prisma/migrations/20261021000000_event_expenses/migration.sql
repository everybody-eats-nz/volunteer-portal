-- AlterEnum
ALTER TYPE "EventIncomeCategory" ADD VALUE 'INVOICE' BEFORE 'AUCTION';

-- CreateEnum
CREATE TYPE "EventExpenseCategory" AS ENUM ('STAFFING', 'FOOD', 'LICENCES', 'EQUIPMENT_HIRE', 'DECOR', 'DRINKS', 'OTHER');

-- CreateTable
CREATE TABLE "EventExpense" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "category" "EventExpenseCategory" NOT NULL,
    "description" VARCHAR(120),
    "amount" DECIMAL(10,2) NOT NULL,
    "gstIncluded" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EventExpense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventExpense_reportId_idx" ON "EventExpense"("reportId");

-- AddForeignKey
ALTER TABLE "EventExpense" ADD CONSTRAINT "EventExpense_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "MealsServed"("id") ON DELETE CASCADE ON UPDATE CASCADE;
