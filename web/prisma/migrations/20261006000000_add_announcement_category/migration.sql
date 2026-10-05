-- Announcement categories: volunteers will be able to opt out of shortage and
-- promotional announcements, but never shift-related or urgent ones.
CREATE TYPE "AnnouncementCategory" AS ENUM ('SHIFT_RELATED', 'URGENT', 'SHIFT_SHORTAGE', 'PROMOTIONAL');

-- Existing announcements predate categories and mix urgent notices with
-- promos. Backfill them to URGENT (mandatory) so no volunteer loses one from
-- their feed once opt-outs ship; admins can re-categorise from the list.
-- The default only exists to backfill: new rows must name a category.
ALTER TABLE "Announcement" ADD COLUMN "category" "AnnouncementCategory" NOT NULL DEFAULT 'URGENT';
ALTER TABLE "Announcement" ALTER COLUMN "category" DROP DEFAULT;
