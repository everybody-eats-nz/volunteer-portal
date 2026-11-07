-- Demo-data polish for store screenshots.
--
-- Run against a THROWAWAY database that has been migrated and seeded with
-- `web/prisma/seed-demo.ts` (never against a real one). The seed already
-- gives every volunteer a random name and stock photo from randomuser.me.
-- This makes the demo volunteer a plain volunteer (no van driving, so the
-- Drive tab stays hidden), keeps the seasonal Year in mahi card off, and
-- clears their unlocked achievements so the next app launch unlocks them
-- again and shows the achievements sheet. It also opens team messaging all
-- week and seeds a "can I bring a friend?" conversation with the team.

BEGIN;

DELETE FROM "DriverProfile"
WHERE "userId" = (SELECT id FROM "User" WHERE email = 'volunteer@example.com');

DELETE FROM "SiteSetting"
WHERE key IN ('YEAR_IN_REVIEW_ENABLED', 'YEAR_IN_REVIEW_YEAR');

DELETE FROM "UserAchievement"
WHERE "userId" = (SELECT id FROM "User" WHERE email = 'volunteer@example.com');

-- Team messaging open all week so the header reads "Online"
INSERT INTO "MessagingHours" (id, location, "dayOfWeek", "isOpen", "openTime", "closeTime", "updatedAt")
SELECT 'mh-' || l.name || '-' || d, l.name, d, true, '08:00', '22:00', now()
FROM "Location" l, generate_series(0, 6) d
ON CONFLICT (location, "dayOfWeek") DO UPDATE SET "isOpen" = true, "openTime" = '08:00', "closeTime" = '22:00';

-- One thread with the team: the volunteer asks if they can bring a friend.
-- Times sit just before the simulator's 9:41 status bar; change the date to
-- the day you capture.
DELETE FROM "MessageThread" WHERE "volunteerId" = (SELECT id FROM "User" WHERE email = 'volunteer@example.com');
INSERT INTO "MessageThread" (id, "volunteerId", status, "lastMessageAt", "volunteerLastReadAt", "teamLastReadAt", "createdAt", "updatedAt")
SELECT 'demo-thread', id, 'OPEN', now(), now(), now(), now(), now() FROM "User" WHERE email = 'volunteer@example.com';

WITH v AS (SELECT id FROM "User" WHERE email = 'volunteer@example.com'),
     a AS (SELECT id FROM "User" WHERE email = 'admin@everybodyeats.nz'),
     msgs(n, who, at, body) AS (VALUES
  (1, 'v', '08:52', 'Kia ora! I''m on Front of House on Monday night. Could I bring a friend along? It would be their first shift.'),
  (2, 'a', '09:04', 'Kia ora ' || (SELECT "firstName" FROM "User" WHERE email = 'volunteer@example.com') || '! Absolutely, we''d love to meet them 🙌'),
  (3, 'a', '09:05', 'Get them to sign up for the same shift in the app so we know to expect them. There are still a couple of spots left.'),
  (4, 'v', '09:21', 'Ka pai, just sent them the link. Anything they need to bring?'),
  (5, 'a', '09:26', 'Just closed-toe shoes and a smile. We''ll sort an apron and give you both a quick tour when you arrive. See you Monday! 🌿'),
  (6, 'v', '09:30', 'Ngā mihi, see you then!')
)
INSERT INTO "Message" (id, "threadId", "senderId", "senderRole", body, "createdAt")
SELECT 'demo-msg-' || n, 'demo-thread',
       CASE WHEN who = 'v' THEN (SELECT id FROM v) ELSE (SELECT id FROM a) END,
       (CASE WHEN who = 'v' THEN 'VOLUNTEER' ELSE 'ADMIN' END)::"Role",
       body,
       ((('2026-11-07 ' || at)::timestamp AT TIME ZONE 'Pacific/Auckland') AT TIME ZONE 'UTC')
FROM msgs;
UPDATE "MessageThread" SET "lastMessageAt" = ((timestamp '2026-11-07 09:30' AT TIME ZONE 'Pacific/Auckland') AT TIME ZONE 'UTC') WHERE id = 'demo-thread';
COMMIT;
