-- Shift previously had an index on `end` only, so every "upcoming shifts"
-- query (mobile home + shifts tabs, live-location lookup, admin calendars)
-- sequentially scanned and sorted the whole table.

-- Windowed scans on start (start >= now AND start < cutoff ORDER BY start).
-- The trailing `location` lets getLiveLocations' DISTINCT run index-only.
CREATE INDEX "Shift_start_location_idx" ON "Shift"("start", "location");

-- Per-restaurant lookups: "what's coming up at my location".
CREATE INDEX "Shift_location_start_idx" ON "Shift"("location", "start");
