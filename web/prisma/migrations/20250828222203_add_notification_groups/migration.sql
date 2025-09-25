-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "excludedShortageNotificationTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "receiveShortageNotifications" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "public"."NotificationGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "filters" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NotificationGroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationGroup_name_key" ON "public"."NotificationGroup"("name");

-- CreateIndex
CREATE INDEX "NotificationGroupMember_groupId_idx" ON "public"."NotificationGroupMember"("groupId");

-- CreateIndex
CREATE INDEX "NotificationGroupMember_userId_idx" ON "public"."NotificationGroupMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationGroupMember_groupId_userId_key" ON "public"."NotificationGroupMember"("groupId", "userId");

-- AddForeignKey
ALTER TABLE "public"."NotificationGroupMember" ADD CONSTRAINT "NotificationGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."NotificationGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NotificationGroupMember" ADD CONSTRAINT "NotificationGroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
