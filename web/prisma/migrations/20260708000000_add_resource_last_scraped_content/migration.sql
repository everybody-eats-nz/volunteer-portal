-- Raw text of the most recent URL scrape for LINK resources included in chat.
-- Lets the nightly refresh cron detect real page changes without clobbering
-- AI-refined chatContent.
ALTER TABLE "Resource" ADD COLUMN "lastScrapedContent" TEXT;
