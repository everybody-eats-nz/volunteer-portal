-- Admin user search filters with `contains` + insensitive mode, which Prisma
-- compiles to `ILIKE '%query%'`. A leading wildcard makes btree indexes
-- unusable, so searching name/email was a sequential scan of the whole User
-- table on every query. Trigram GIN indexes support leading-wildcard ILIKE.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "User_name_gin_trgm_idx" ON "User" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "User_firstName_gin_trgm_idx" ON "User" USING GIN ("firstName" gin_trgm_ops);
CREATE INDEX "User_lastName_gin_trgm_idx" ON "User" USING GIN ("lastName" gin_trgm_ops);
CREATE INDEX "User_email_gin_trgm_idx" ON "User" USING GIN ("email" gin_trgm_ops);
