-- CreateEnum
CREATE TYPE "DayReportType" AS ENUM ('SERVICE_NIGHT', 'EVENT', 'CAFE');

-- CreateEnum
CREATE TYPE "EventIncomeSource" AS ENUM ('CASH', 'EFTPOS', 'STRIPE', 'INVOICE');

-- CreateEnum
CREATE TYPE "EventIncomeCategory" AS ENUM ('KOHA', 'SALES', 'AUCTION', 'DONATION', 'OTHER');

-- AlterTable
ALTER TABLE "MealsServed" ADD COLUMN     "closesAt" VARCHAR(5),
ADD COLUMN     "eventName" VARCHAR(120),
ADD COLUMN     "opensAt" VARCHAR(5),
ADD COLUMN     "reportType" "DayReportType" NOT NULL DEFAULT 'SERVICE_NIGHT';

-- CreateTable
CREATE TABLE "EventIncome" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "source" "EventIncomeSource" NOT NULL,
    "category" "EventIncomeCategory" NOT NULL,
    "description" VARCHAR(120),
    "amount" DECIMAL(10,2) NOT NULL,
    "gstIncluded" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EventIncome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventIncome_reportId_idx" ON "EventIncome"("reportId");

-- CreateIndex
CREATE INDEX "MealsServed_reportType_date_idx" ON "MealsServed"("reportType", "date");

-- AddForeignKey
ALTER TABLE "EventIncome" ADD CONSTRAINT "EventIncome_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "MealsServed"("id") ON DELETE CASCADE ON UPDATE CASCADE;

