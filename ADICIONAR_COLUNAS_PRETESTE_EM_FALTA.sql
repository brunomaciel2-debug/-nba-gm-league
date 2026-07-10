-- ============================================
-- ADICIONAR COLUNAS EM FALTA NAS TABELAS _preteste
-- Cola no Supabase SQL Editor e corre (só precisas de correr isto uma vez)
--
-- Verificação ao Ponto de Origem encontrou 3 tabelas _preteste desatualizadas
-- em relação às tabelas reais — cada uma destas colunas foi adicionada à
-- tabela real por uma migração antiga, mas nunca replicada para a cópia
-- _preteste. Isto faria o próximo RESET_PRE_TESTE.sql falhar a meio
-- (INSERT INTO coaches/games/power_rankings SELECT * FROM ..._preteste
-- exige o mesmo número de colunas dos dois lados).
-- ============================================

ALTER TABLE coaches_preteste ADD COLUMN IF NOT EXISTS morale_management int DEFAULT 60;
ALTER TABLE coaches_preteste ADD COLUMN IF NOT EXISTS team_cohesion int DEFAULT 60;
ALTER TABLE coaches_preteste ADD COLUMN IF NOT EXISTS composure_coaching int DEFAULT 60;

ALTER TABLE games_preteste ADD COLUMN IF NOT EXISTS referee_rating numeric(3,1);
ALTER TABLE games_preteste ADD COLUMN IF NOT EXISTS scheduled_date date;

ALTER TABLE power_rankings_preteste ADD COLUMN IF NOT EXISTS comment_pt text;

SELECT 'Colunas em falta adicionadas às tabelas _preteste! Corre agora o ATUALIZAR_PONTO_ORIGEM.sql para tirar uma fotografia fresca e completa como novo Ponto de Origem.' as resultado;
