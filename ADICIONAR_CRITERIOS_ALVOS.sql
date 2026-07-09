-- ============================================
-- CRITERIOS DOS ALVOS DA EPOCA — cada franchise passa a ter um CONJUNTO
-- diferente de criterios (nao so numeros diferentes), escolhido no mesmo
-- momento em que as expetativas sao bloqueadas: rivalidade real, craque
-- com contrato a expirar, situacao de reconstrucao, instalacoes fracas,
-- lugar nos playoffs — reflete o que cada fanbase/administracao realmente
-- valoriza, nao um conjunto fixo genérico.
-- Cola no Supabase SQL Editor e corre.
-- ============================================

ALTER TABLE gm_season_targets ADD COLUMN IF NOT EXISTS fans_criteria jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE gm_season_targets ADD COLUMN IF NOT EXISTS owners_criteria jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE gm_season_targets_preteste ADD COLUMN IF NOT EXISTS fans_criteria jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE gm_season_targets_preteste ADD COLUMN IF NOT EXISTS owners_criteria jsonb NOT NULL DEFAULT '[]'::jsonb;

SELECT team_id, fans_criteria, owners_criteria FROM gm_season_targets LIMIT 5;
