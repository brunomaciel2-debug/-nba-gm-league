-- ============================================
-- ADICIONA "healed_week" A injury_log
-- Cola no Supabase SQL Editor e corre (uma vez só)
--
-- Necessário para o sistema de risco de reincidência: guarda em que semana
-- (numero da season) uma lesão foi dada como recuperada, para conseguirmos
-- calcular se o jogador ainda está "frágil" numa certa zona do corpo.
-- ============================================

ALTER TABLE injury_log ADD COLUMN IF NOT EXISTS healed_week int;
ALTER TABLE injury_log_preteste ADD COLUMN IF NOT EXISTS healed_week int;

SELECT 'Coluna healed_week adicionada!' as resultado;
