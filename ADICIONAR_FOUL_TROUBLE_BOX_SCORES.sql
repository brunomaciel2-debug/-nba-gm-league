-- ============================================
-- ADICIONA A COLUNA "foul_trouble" ÀS BOX SCORES
-- Cola no Supabase SQL Editor e corre (uma vez só)
--
-- Necessário para o aviso "FOUL TROUBLE" na box score
-- passar a refletir o que realmente aconteceu no jogo
-- (3ª falta no 1º período ou 4ª/5ª no 2º período), em vez
-- de aparecer sempre que um jogador termina o jogo com
-- 4 ou 5 faltas pessoais, seja em que período for.
-- ============================================

ALTER TABLE box_scores ADD COLUMN IF NOT EXISTS foul_trouble boolean DEFAULT false;
ALTER TABLE box_scores_preteste ADD COLUMN IF NOT EXISTS foul_trouble boolean DEFAULT false;

SELECT 'Coluna foul_trouble adicionada!' as resultado;
