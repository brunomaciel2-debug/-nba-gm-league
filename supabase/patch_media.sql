-- Add media columns to teams and players
ALTER TABLE teams   ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS photo_url text;
