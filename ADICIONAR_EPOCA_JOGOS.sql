-- ============================================
-- COLUNA "season" NA TABELA "games"
-- Cola no Supabase SQL Editor e corre (uma vez só)
-- Necessário para a página de Recordes poder distinguir "por época" de
-- "all-time" — sem esta coluna não há forma de saber a que época um jogo
-- pertence. Todos os jogos já existentes são da 2025-26, por isso o valor
-- por omissão já os classifica corretamente sem precisar de backfill.
-- ============================================

ALTER TABLE games ADD COLUMN IF NOT EXISTS season text NOT NULL DEFAULT '2025-26';
ALTER TABLE games_preteste ADD COLUMN IF NOT EXISTS season text;

SELECT 'Coluna season adicionada a games!' as resultado;
