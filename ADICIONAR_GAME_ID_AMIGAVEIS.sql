-- ============================================
-- ADICIONAR GAME_ID AOS JOGOS AMIGAVEIS
-- Cola no Supabase SQL Editor e corre (só precisas de correr isto uma vez)
-- Liga cada jogo amigável (preseason_games) ao jogo criado em "games"
-- quando for simulado, para o resultado/box score ficar guardado
-- ============================================

ALTER TABLE preseason_games ADD COLUMN IF NOT EXISTS game_id uuid REFERENCES games(id);

SELECT 'Coluna game_id adicionada a preseason_games!' as resultado;
