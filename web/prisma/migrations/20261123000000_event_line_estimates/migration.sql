-- AlterTable
ALTER TABLE "EventIncome" ADD COLUMN     "estimated" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "EventExpense" ADD COLUMN     "estimated" BOOLEAN NOT NULL DEFAULT false;
