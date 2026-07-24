-- ============================================
-- DESCRIÇÃO EM PORTUGUÊS DAS EQUIPAS INTERNACIONAIS
-- Cola no Supabase SQL Editor e corre (uma vez só)
-- Depois de correres isto, eu preencho o texto em português para as
-- 24 equipas (script à parte, com a service role key).
-- ============================================

ALTER TABLE world_teams ADD COLUMN IF NOT EXISTS description_pt text;
ALTER TABLE world_teams_preteste ADD COLUMN IF NOT EXISTS description_pt text;

SELECT 'Coluna description_pt adicionada!' as resultado;
