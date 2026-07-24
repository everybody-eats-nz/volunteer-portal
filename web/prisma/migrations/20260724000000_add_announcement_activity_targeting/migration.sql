-- Shift-history targeting for announcements: reach the volunteers who actually
-- worked shifts matching a location / date-window / minimum-count filter,
-- rather than everyone whose profile merely lists a location.
--
-- The dimension is dormant unless "targetActivityMinShifts" is set, so every
-- existing announcement keeps its current recipient set.
--
-- The recipient query joins Signup to Shift; the existing
-- Signup(userId, canceledAt) and Shift(end) indexes already serve it.
ALTER TABLE "Announcement"
  ADD COLUMN "targetActivityLocations" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "targetActivityFrom" TIMESTAMP(3),
  ADD COLUMN "targetActivityTo" TIMESTAMP(3),
  ADD COLUMN "targetActivityMinShifts" INTEGER;
