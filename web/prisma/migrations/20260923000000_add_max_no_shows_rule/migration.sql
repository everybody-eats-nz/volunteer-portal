-- Auto-accept rules can now cap how many no-shows a volunteer is allowed
-- before the rule stops matching them. Set on a BLOCK rule, this is how
-- repeat no-shows lose auto-approval without an admin having to spot it.
ALTER TABLE "AutoAcceptRule" ADD COLUMN "maxNoShows" INTEGER;
