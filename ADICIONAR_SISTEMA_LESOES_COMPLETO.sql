-- ============================================
-- SISTEMA DE LESÕES COMPLETO — novas colunas em injury_log
-- Cola no Supabase SQL Editor e corre (uma vez só)
--
-- Necessário para:
-- 1) corrigir a notificação de lesão que nunca disparava (filtrava por
--    game_id, que nunca é preenchido — passa a filtrar por week_number)
-- 2) marcar quando uma lesão foi tratada por um especialista
-- 3) marcar quando uma lesão foi dada como recuperada
-- ============================================

ALTER TABLE injury_log ADD COLUMN IF NOT EXISTS week_number int;
ALTER TABLE injury_log ADD COLUMN IF NOT EXISTS specialist_used boolean DEFAULT false;
ALTER TABLE injury_log ADD COLUMN IF NOT EXISTS specialist_health_bonus int;
ALTER TABLE injury_log ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

ALTER TABLE injury_log_preteste ADD COLUMN IF NOT EXISTS week_number int;
ALTER TABLE injury_log_preteste ADD COLUMN IF NOT EXISTS specialist_used boolean DEFAULT false;
ALTER TABLE injury_log_preteste ADD COLUMN IF NOT EXISTS specialist_health_bonus int;
ALTER TABLE injury_log_preteste ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

SELECT 'Colunas do sistema de lesoes adicionadas!' as resultado;
