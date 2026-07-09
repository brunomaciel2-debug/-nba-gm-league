-- ============================================
-- HISTORIAS DE FRANCHISE — factos reais e especificos de cada equipa
-- (contrato do craque a expirar, falta de um 2o craque, lesoes repetidas,
-- janela de titulo aberta, etc.), nao textos genericos por categoria.
-- Cola no Supabase SQL Editor e corre.
-- ============================================

ALTER TABLE gm_satisfaction_snapshots ADD COLUMN IF NOT EXISTS franchise_storylines jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE gm_satisfaction_snapshots_preteste ADD COLUMN IF NOT EXISTS franchise_storylines jsonb NOT NULL DEFAULT '[]'::jsonb;

SELECT team_id, franchise_storylines FROM gm_satisfaction_snapshots LIMIT 5;
