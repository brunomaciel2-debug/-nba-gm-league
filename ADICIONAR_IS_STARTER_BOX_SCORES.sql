-- ============================================
-- ADICIONA A COLUNA "is_starter" ÀS BOX SCORES
-- Cola no Supabase SQL Editor e corre (uma vez só)
--
-- Necessário para o novo layout da box score: separar
-- titulares (STARTERS) de suplentes (BENCH) e mostrar
-- jogadores que não entraram (DNP-COACH'S DECISION).
-- ============================================

ALTER TABLE box_scores ADD COLUMN IF NOT EXISTS is_starter boolean DEFAULT false;
ALTER TABLE box_scores_preteste ADD COLUMN IF NOT EXISTS is_starter boolean DEFAULT false;

SELECT 'Coluna is_starter adicionada!' as resultado;
