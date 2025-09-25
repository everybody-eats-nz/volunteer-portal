-- CreateTable
CREATE TABLE "public"."CustomLabel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "icon" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomLabel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserCustomLabel" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCustomLabel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomLabel_name_key" ON "public"."CustomLabel"("name");

-- CreateIndex
CREATE INDEX "CustomLabel_isActive_idx" ON "public"."CustomLabel"("isActive");

-- CreateIndex
CREATE INDEX "UserCustomLabel_userId_idx" ON "public"."UserCustomLabel"("userId");

-- CreateIndex
CREATE INDEX "UserCustomLabel_labelId_idx" ON "public"."UserCustomLabel"("labelId");

-- CreateIndex
CREATE UNIQUE INDEX "UserCustomLabel_userId_labelId_key" ON "public"."UserCustomLabel"("userId", "labelId");

-- AddForeignKey
ALTER TABLE "public"."UserCustomLabel" ADD CONSTRAINT "UserCustomLabel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserCustomLabel" ADD CONSTRAINT "UserCustomLabel_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "public"."CustomLabel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
