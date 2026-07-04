-- ============================================
-- REMOVER TABELA "injuries" ANTIGA (nao usada)
-- Cola no Supabase SQL Editor e corre (uma vez so)
-- Tudo o que e' lesoes ja usa "injury_log" - esta tabela
-- nunca foi escrita por nenhum codigo activo do site.
-- ============================================

DROP TABLE IF EXISTS injuries;

SELECT 'Tabela injuries removida.' as resultado;
