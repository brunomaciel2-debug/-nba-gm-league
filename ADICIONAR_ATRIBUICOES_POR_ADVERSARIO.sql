-- ============================================
-- ADICIONA "special_assignments" A gm_orders
-- Cola no Supabase SQL Editor e corre (uma vez só)
--
-- Substitui os campos double_team_target/lockdown_target/lockdown_defender
-- (que só permitiam UM alvo para toda a semana) por um mapa por adversário —
-- agora dá para escolher um Double Team e um Defensor de Marcação
-- diferentes para cada equipa que defrontas nessa semana.
-- ============================================

ALTER TABLE gm_orders ADD COLUMN IF NOT EXISTS special_assignments jsonb DEFAULT '{}'::jsonb;
ALTER TABLE gm_orders_preteste ADD COLUMN IF NOT EXISTS special_assignments jsonb DEFAULT '{}'::jsonb;

SELECT 'Coluna special_assignments adicionada!' as resultado;
