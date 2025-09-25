-- CreateTable
CREATE TABLE "public"."AdminNote" (
    "id" TEXT NOT NULL,
    "volunteerId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AdminNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminNote_volunteerId_isArchived_idx" ON "public"."AdminNote"("volunteerId", "isArchived");

-- CreateIndex
CREATE INDEX "AdminNote_createdBy_idx" ON "public"."AdminNote"("createdBy");

-- CreateIndex
CREATE INDEX "AdminNote_createdAt_idx" ON "public"."AdminNote"("createdAt");

-- AddForeignKey
ALTER TABLE "public"."AdminNote" ADD CONSTRAINT "AdminNote_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AdminNote" ADD CONSTRAINT "AdminNote_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
