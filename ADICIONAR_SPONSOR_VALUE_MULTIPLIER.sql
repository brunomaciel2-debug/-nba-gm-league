-- Season-to-season sponsor confidence dynamic: a sponsor a GM previously
-- signed offers +20% next time if every objective under that deal was
-- achieved, or -20% if not — reflecting the sponsor's confidence (or lack
-- of it) in the franchise. A sponsor never signed stays unchanged. Stored
-- as a multiplier on sponsor_pool (per team, per template, per season)
-- rather than mutating sponsor_templates directly, since sponsor_templates
-- is one shared global row per company — adjusting it in place would have
-- changed that sponsor's offer for every OTHER team in the league too.
ALTER TABLE sponsor_pool ADD COLUMN IF NOT EXISTS value_multiplier numeric NOT NULL DEFAULT 1;

SELECT 'value_multiplier column added!' as resultado;
