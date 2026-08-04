-- The banner's "Now: <date>" used to be GUESSED from the games table (find
-- the next scheduled game, subtract a day) — which only worked for the
-- regular season, where games have real scheduled_date values. Pre-season
-- friendlies don't, so once "Simulate 1 Day" started correctly stopping
-- after a single day instead of the whole 3-4 day block, the display had
-- no way to show that a day had actually been processed until the WHOLE
-- block finished. This column is written directly by the simulator itself
-- (the one source that actually knows what day it just simulated), so the
-- banner can just read it instead of re-deriving a guess.

ALTER TABLE season_config ADD COLUMN IF NOT EXISTS last_sim_day date;
ALTER TABLE season_config_preteste ADD COLUMN IF NOT EXISTS last_sim_day date;
