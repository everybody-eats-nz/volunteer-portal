-- CreateTable
CREATE TABLE "public"."ShiftTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shiftTypeId" TEXT NOT NULL,
    "location" TEXT,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShiftTemplate_name_location_key" ON "public"."ShiftTemplate"("name", "location");

-- AddForeignKey
ALTER TABLE "public"."ShiftTemplate" ADD CONSTRAINT "ShiftTemplate_shiftTypeId_fkey" FOREIGN KEY ("shiftTypeId") REFERENCES "public"."ShiftType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ShiftTemplate" ADD CONSTRAINT "ShiftTemplate_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
