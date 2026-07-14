-- Adds a richer flavor-text detail to injury_log, copied from
-- injury_types.notes at the moment the injury happens (same convention
-- already used for body_part/severity/injury_category — duplicated onto
-- injury_log at insert time rather than joined at read time).
ALTER TABLE injury_log ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE injury_log_preteste ADD COLUMN IF NOT EXISTS notes text;
