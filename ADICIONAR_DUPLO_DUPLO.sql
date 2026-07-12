-- ============================================
-- ADICIONA O TRACKING DE "DUPLO-DUPLO" (double-double)
-- Cola no Supabase SQL Editor e corre (uma vez só)
--
-- Espelha exatamente o que já existe para triplo-duplo:
--   box_scores.is_double_double   -> flag por jogo
--   player_stats.double_doubles   -> contador acumulado da época
--
-- Regra oficial da NBA: 10+ em pelo menos 2 das 5 categorias principais
-- (PTS, REB, AST, STL, BLK). Por definição, todo triplo-duplo é também
-- um duplo-duplo.
-- ============================================

ALTER TABLE box_scores ADD COLUMN IF NOT EXISTS is_double_double boolean DEFAULT false;
ALTER TABLE box_scores_preteste ADD COLUMN IF NOT EXISTS is_double_double boolean DEFAULT false;

ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS double_doubles smallint DEFAULT 0;
ALTER TABLE player_stats_preteste ADD COLUMN IF NOT EXISTS double_doubles smallint DEFAULT 0;

SELECT 'Colunas is_double_double e double_doubles adicionadas!' as resultado;
