-- AlterTable
ALTER TABLE "Resource" ADD COLUMN "chatContent" TEXT;
ALTER TABLE "Resource" ADD COLUMN "includeInChat" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Resource_includeInChat_idx" ON "Resource"("includeInChat");
