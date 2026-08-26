-- Adds a global lock column so two overlapping simulate calls (an admin
-- double-click, or a manual trigger landing close to a cron tick) can never
-- both process the same not-yet-committed state at once.
ALTER TABLE season_config ADD COLUMN IF NOT EXISTS simulating_since timestamptz;
