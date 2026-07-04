-- ============================================
-- ADICIONA A COLUNA "suspended_games_remaining" AOS JOGADORES
-- Cola no Supabase SQL Editor e corre (uma vez só)
--
-- Necessário para a suspensão automática por faltas técnicas:
-- guarda quantos jogos de suspensão o jogador ainda tem de cumprir.
-- ============================================

ALTER TABLE players ADD COLUMN IF NOT EXISTS suspended_games_remaining int DEFAULT 0;
ALTER TABLE players_preteste ADD COLUMN IF NOT EXISTS suspended_games_remaining int DEFAULT 0;

SELECT 'Coluna suspended_games_remaining adicionada!' as resultado;
