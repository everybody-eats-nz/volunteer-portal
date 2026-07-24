-- Add an optional upper bound to shift-history targeting so announcements can
-- target e.g. volunteers who have worked exactly one shift.
ALTER TABLE "Announcement" ADD COLUMN "targetActivityMaxShifts" INTEGER;
