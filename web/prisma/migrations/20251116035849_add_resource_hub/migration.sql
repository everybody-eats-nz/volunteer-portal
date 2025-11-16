-- CreateEnum
CREATE TYPE "public"."ResourceType" AS ENUM ('PDF', 'IMAGE', 'DOCUMENT', 'LINK', 'VIDEO');

-- CreateEnum
CREATE TYPE "public"."ResourceCategory" AS ENUM ('TRAINING', 'POLICIES', 'FORMS', 'GUIDES', 'RECIPES', 'SAFETY', 'GENERAL');

-- CreateTable
CREATE TABLE "public"."Resource" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "public"."ResourceType" NOT NULL,
    "category" "public"."ResourceCategory" NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fileUrl" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "url" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Resource_type_isPublished_idx" ON "public"."Resource"("type", "isPublished");

-- CreateIndex
CREATE INDEX "Resource_category_isPublished_idx" ON "public"."Resource"("category", "isPublished");

-- CreateIndex
CREATE INDEX "Resource_uploadedBy_idx" ON "public"."Resource"("uploadedBy");

-- CreateIndex
CREATE INDEX "Resource_createdAt_idx" ON "public"."Resource"("createdAt");

-- AddForeignKey
ALTER TABLE "public"."Resource" ADD CONSTRAINT "Resource_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
