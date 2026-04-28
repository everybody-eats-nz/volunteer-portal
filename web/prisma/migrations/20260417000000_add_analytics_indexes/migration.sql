-- Analytics performance indexes
-- User: composite index on (role, createdAt) — recruitment/engagement queries filter on role='VOLUNTEER' and date range
CREATE INDEX "User_role_createdAt_idx" ON "User"("role", "createdAt");

-- Shift: index on end — analytics filter confirmed shifts where end < now
CREATE INDEX "Shift_end_idx" ON "Shift"("end");

-- Signup: index on shiftId — reverse join from Shift → Signup used in analytics CTEs
CREATE INDEX "Signup_shiftId_idx" ON "Signup"("shiftId");
