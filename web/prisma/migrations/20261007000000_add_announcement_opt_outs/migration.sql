-- Volunteers can opt out of promotional announcements from their profile.
-- Shift shortages reuse the existing "receiveShortageNotifications" switch, and
-- shift-related and urgent announcements can't be opted out of.
ALTER TABLE "User" ADD COLUMN "announcementOptOuts" "AnnouncementCategory"[] DEFAULT ARRAY[]::"AnnouncementCategory"[];
