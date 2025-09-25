-- AlterEnum
ALTER TYPE "public"."NotificationType" ADD VALUE 'SHIFT_CANCELLATION_MANAGER';

-- CreateTable
CREATE TABLE "public"."RestaurantManager" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "locations" TEXT[],
    "receiveNotifications" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantManager_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantManager_userId_key" ON "public"."RestaurantManager"("userId");

-- AddForeignKey
ALTER TABLE "public"."RestaurantManager" ADD CONSTRAINT "RestaurantManager_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
