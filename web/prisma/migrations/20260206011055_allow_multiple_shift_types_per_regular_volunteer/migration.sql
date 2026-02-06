-- DropIndex
DROP INDEX "RegularVolunteer_userId_key";

-- CreateIndex
CREATE UNIQUE INDEX "RegularVolunteer_userId_shiftTypeId_key" ON "RegularVolunteer"("userId", "shiftTypeId");
