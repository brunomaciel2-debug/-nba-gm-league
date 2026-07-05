-- ============================================
-- ADICIONAR COMENTARIO EM PORTUGUES AOS POWER RANKINGS
-- Cola no Supabase SQL Editor e corre (só precisas de correr isto uma vez)
-- Guarda a analise de cada equipa tambem em portugues, para a pagina
-- Power Rankings mostrar o texto certo consoante o idioma escolhido.
-- ============================================

ALTER TABLE power_rankings ADD COLUMN IF NOT EXISTS comment_pt text;

SELECT 'Coluna comment_pt adicionada a power_rankings!' as resultado;
