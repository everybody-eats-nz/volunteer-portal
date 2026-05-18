-- AlterTable: mark a Location as a pop-up / temporary venue.
-- Pop-up locations stay selectable as an available location but are never
-- offered as a user's default location.
ALTER TABLE "Location"
  ADD COLUMN "isPopup" BOOLEAN NOT NULL DEFAULT false;
