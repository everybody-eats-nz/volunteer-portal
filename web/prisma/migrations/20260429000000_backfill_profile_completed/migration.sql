-- Backfill profileCompleted for users who already meet the requirements.
--
-- Until now profileCompleted only flipped to true on migration registrations
-- or on a subsequent /api/profile update. New email/password signups left it
-- false even when the registration form supplied every required field. This
-- caused the onboarding funnel to report more "signed up for a shift" than
-- "profile complete" because the data didn't reflect reality.
--
-- The signup endpoint now gates on profileCompleted, so we backfill existing
-- users with all required fields to keep them able to sign up.
UPDATE "User"
SET "profileCompleted" = true
WHERE "profileCompleted" = false
  AND "firstName" IS NOT NULL AND "firstName" <> ''
  AND "phone" IS NOT NULL AND "phone" <> ''
  AND "dateOfBirth" IS NOT NULL
  AND "emergencyContactName" IS NOT NULL AND "emergencyContactName" <> ''
  AND "emergencyContactPhone" IS NOT NULL AND "emergencyContactPhone" <> ''
  AND "volunteerAgreementAccepted" = true
  AND "healthSafetyPolicyAccepted" = true;
