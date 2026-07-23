-- Chat-only guides (created on the admin Chat Guides page) were previously
-- saved with isPublished = true only to satisfy the chat-context query, which
-- leaked them into the public Resource Hub. Chat inclusion no longer depends on
-- publication, so unpublish the guides that provably cannot be hub resources:
-- those with neither an uploaded file nor a URL (pure AI-context text guides).
--
-- This deliberately leaves any resource that has a file or URL untouched, so a
-- real hub resource that was also added to chat context stays published and
-- visible in the hub.
UPDATE "Resource"
SET "isPublished" = false
WHERE "includeInChat" = true
  AND "isPublished" = true
  AND "fileUrl" IS NULL
  AND "url" IS NULL;
