-- ============================================
-- FOTOS DE ARENA E DE GM
-- Cola no Supabase SQL Editor e corre (uma vez só)
-- Permite ao Comissário colar um link de foto para a arena de cada equipa
-- e para cada GM, geridos a partir do Media Manager (/admin/media).
-- ============================================

ALTER TABLE teams ADD COLUMN IF NOT EXISTS arena_photo_url text;
ALTER TABLE teams_preteste ADD COLUMN IF NOT EXISTS arena_photo_url text;

ALTER TABLE gm_profiles ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE gm_profiles_preteste ADD COLUMN IF NOT EXISTS photo_url text;

SELECT 'Colunas de foto de arena e de GM adicionadas!' as resultado;
