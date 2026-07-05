-- ============================================
-- ADICIONA "lockdown_target" e "lockdown_defender" A gm_orders
-- Cola no Supabase SQL Editor e corre (uma vez só)
--
-- Necessário para a nova opção tática "Defensor de Marcação Individual":
-- o GM escolhe um jogador do adversário e designa um jogador seu para o
-- marcar especificamente, sem penalização no resto da defesa (ao contrário
-- do Double Team).
-- ============================================

ALTER TABLE gm_orders ADD COLUMN IF NOT EXISTS lockdown_target text;
ALTER TABLE gm_orders ADD COLUMN IF NOT EXISTS lockdown_defender text;
ALTER TABLE gm_orders_preteste ADD COLUMN IF NOT EXISTS lockdown_target text;
ALTER TABLE gm_orders_preteste ADD COLUMN IF NOT EXISTS lockdown_defender text;

SELECT 'Colunas lockdown_target e lockdown_defender adicionadas!' as resultado;
