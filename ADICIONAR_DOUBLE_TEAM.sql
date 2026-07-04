-- ============================================
-- ADICIONA "double_team_target" A gm_orders
-- Cola no Supabase SQL Editor e corre (uma vez só)
--
-- Necessário para a nova opção tática "Double Team": o GM escolhe o
-- jogador mais perigoso da equipa adversária para dobrar a marcação
-- nessa semana.
-- ============================================

ALTER TABLE gm_orders ADD COLUMN IF NOT EXISTS double_team_target text;
ALTER TABLE gm_orders_preteste ADD COLUMN IF NOT EXISTS double_team_target text;

SELECT 'Coluna double_team_target adicionada!' as resultado;
