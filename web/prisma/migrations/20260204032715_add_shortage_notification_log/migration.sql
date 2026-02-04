-- CreateTable
CREATE TABLE "ShortageNotificationLog" (
    "id" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentBy" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "shiftTypeName" TEXT NOT NULL,
    "shiftDate" TIMESTAMP(3) NOT NULL,
    "shiftLocation" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,

    CONSTRAINT "ShortageNotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShortageNotificationLog_sentAt_idx" ON "ShortageNotificationLog"("sentAt");

-- CreateIndex
CREATE INDEX "ShortageNotificationLog_sentBy_idx" ON "ShortageNotificationLog"("sentBy");

-- CreateIndex
CREATE INDEX "ShortageNotificationLog_shiftId_idx" ON "ShortageNotificationLog"("shiftId");

-- CreateIndex
CREATE INDEX "ShortageNotificationLog_recipientId_idx" ON "ShortageNotificationLog"("recipientId");
