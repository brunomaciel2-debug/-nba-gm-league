-- ============================================
-- ADICIONAR AVALIACAO DE ARBITRAGEM
-- Cola no Supabase SQL Editor e corre (só precisas de correr isto uma vez)
-- Cada jogo passa a guardar a nota (0-10, uma casa decimal) atribuida ao
-- arbitro dessa partida, com base no que realmente aconteceu no jogo
-- (simetria de faltas, tecnicas, etc.) - nao e decorativo.
-- ============================================

ALTER TABLE games ADD COLUMN IF NOT EXISTS referee_rating numeric(3,1);

SELECT 'Coluna referee_rating adicionada a games!' as resultado;
