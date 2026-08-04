-- Playoff series now advance day-by-day (games every other day within a
-- series, 2 rest days before a team's next series) instead of one game per
-- series per week. This column tracks when a series' next game is due, so
-- the day-based simulator knows what's ready to play on any given day.

ALTER TABLE playoff_series ADD COLUMN IF NOT EXISTS next_game_date date;
ALTER TABLE playoff_series_preteste ADD COLUMN IF NOT EXISTS next_game_date date;
