-- CreateEnum
CREATE TYPE "YearInReviewVideoStatus" AS ENUM ('QUEUED', 'RENDERING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "YearInReviewVideo" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "YearInReviewVideoStatus" NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "props" JSONB NOT NULL,
    "propsHash" TEXT NOT NULL,
    "storagePath" TEXT,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "renderedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YearInReviewVideo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "YearInReviewVideo_status_updatedAt_idx" ON "YearInReviewVideo"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "YearInReviewVideo_userId_year_key" ON "YearInReviewVideo"("userId", "year");

-- AddForeignKey
ALTER TABLE "YearInReviewVideo" ADD CONSTRAINT "YearInReviewVideo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

