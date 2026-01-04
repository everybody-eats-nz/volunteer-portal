-- CreateTable
CREATE TABLE "NewsletterList" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "campaignMonitorId" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsletterList_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterList_campaignMonitorId_key" ON "NewsletterList"("campaignMonitorId");

-- CreateIndex
CREATE INDEX "NewsletterList_active_idx" ON "NewsletterList"("active");

-- CreateIndex
CREATE INDEX "NewsletterList_displayOrder_idx" ON "NewsletterList"("displayOrder");
