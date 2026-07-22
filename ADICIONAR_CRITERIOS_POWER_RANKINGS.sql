-- Replaces the AI-written text comment with a structured, deterministic
-- breakdown of the criteria that actually decide a team's rank each week
-- (recent form, Elo, net rating, roster talent, schedule difficulty past/
-- next, injuries, trade activity, future trajectory). No more dependency
-- on a paid external API that can run out of credits mid-season.
ALTER TABLE power_rankings ADD COLUMN IF NOT EXISTS criteria jsonb;
ALTER TABLE power_rankings_preteste ADD COLUMN IF NOT EXISTS criteria jsonb;

-- The old AI-comment column was required (NOT NULL); the new criteria-based
-- generator no longer writes it, so every insert was silently failing.
ALTER TABLE power_rankings ALTER COLUMN comment DROP NOT NULL;
ALTER TABLE power_rankings_preteste ALTER COLUMN comment DROP NOT NULL;
