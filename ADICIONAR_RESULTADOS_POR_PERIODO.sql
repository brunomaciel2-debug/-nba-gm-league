-- ============================================
-- ADICIONA A COLUNA "period_scores" AOS JOGOS
-- Cola no Supabase SQL Editor e corre (uma vez só)
--
-- Guarda o resultado parcial de cada período (Q1-Q4, e OT1/OT2/... se
-- necessário) em formato jsonb: [{"quarter":1,"home":28,"away":24}, ...]
-- Usado pela box score para mostrar o resultado por período, tal como um
-- jogo real da NBA.
-- ============================================

ALTER TABLE games ADD COLUMN IF NOT EXISTS period_scores jsonb;
ALTER TABLE games_preteste ADD COLUMN IF NOT EXISTS period_scores jsonb;
ALTER TABLE preseason_games ADD COLUMN IF NOT EXISTS period_scores jsonb;
ALTER TABLE preseason_games_preteste ADD COLUMN IF NOT EXISTS period_scores jsonb;

SELECT 'Coluna period_scores adicionada!' as resultado;
