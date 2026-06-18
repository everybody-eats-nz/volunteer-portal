-- Koha banking target per service night, per location.
ALTER TABLE "Location" ADD COLUMN "targetPerNight" DECIMAL(10,2);
