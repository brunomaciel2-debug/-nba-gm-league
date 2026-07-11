-- Adds next_sim_half to season_config (+ its _preteste mirror), so a
-- Regular-Season week can be simulated in 2 smaller steps (days 1-3, then
-- days 4-7) instead of one single, much heavier invocation.
ALTER TABLE season_config ADD COLUMN IF NOT EXISTS next_sim_half smallint NOT NULL DEFAULT 1;
ALTER TABLE season_config_preteste ADD COLUMN IF NOT EXISTS next_sim_half smallint NOT NULL DEFAULT 1;
