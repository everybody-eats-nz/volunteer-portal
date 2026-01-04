-- AlterTable
ALTER TABLE "User" ADD COLUMN     "newsletterLists" TEXT[] DEFAULT ARRAY[]::TEXT[];
