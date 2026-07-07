-- ============================================
-- CORRIGIR MERCHANDISING v3
-- Cola no Supabase SQL Editor e corre
-- 1) Impede duplicados no relatorio mensal (o resolver ja tem uma
--    salvaguarda no codigo, isto e uma segunda camada de proteccao a nivel
--    da base de dados).
-- 2) Adiciona a coluna "fame" a tabela players_preteste (Ponto de Origem),
--    que faltava desde que a coluna foi criada em ADICIONAR_MERCHANDISING.sql
--    - sem isto, o RESET_PRE_TESTE.sql falhava a restaurar a tabela players.
-- ============================================

ALTER TABLE jersey_sales_reports
  ADD CONSTRAINT jersey_sales_reports_unique UNIQUE (season, month_num, player_id);

ALTER TABLE players_preteste ADD COLUMN IF NOT EXISTS fame int DEFAULT 50;
