-- ============================================
-- SOCIAL MEDIA MANAGER — novo cargo de staff + contador real de seguidores
-- Cola no Supabase SQL Editor e corre
-- Reaproveita a tabela partilhada "coaches" (mesmo padrao do Mental Coach),
-- com 3 atributos novos: Social Media Engagement, Team-Fan Interaction,
-- Social Responsibility. O contador de seguidores fica em "teams" e afeta
-- mesmo o jogo (fama/merchandising e assistencia), nao e decorativo.
-- ============================================

ALTER TABLE coaches ADD COLUMN IF NOT EXISTS sm_engagement int DEFAULT 60;
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS fan_interaction int DEFAULT 60;
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS social_responsibility int DEFAULT 60;

ALTER TABLE teams ADD COLUMN IF NOT EXISTS social_media_followers bigint DEFAULT 0;

-- Shadow "_preteste" columns/tables so RESET_PRE_TESTE.sql /
-- ATUALIZAR_PONTO_ORIGEM.sql can back up and restore these values, same as
-- every other mutable column this session (morale_management, popularity, etc).
ALTER TABLE coaches_preteste ADD COLUMN IF NOT EXISTS sm_engagement int DEFAULT 60;
ALTER TABLE coaches_preteste ADD COLUMN IF NOT EXISTS fan_interaction int DEFAULT 60;
ALTER TABLE coaches_preteste ADD COLUMN IF NOT EXISTS social_responsibility int DEFAULT 60;
ALTER TABLE teams_preteste ADD COLUMN IF NOT EXISTS social_media_followers bigint DEFAULT 0;

SELECT id, name, role, sm_engagement, fan_interaction, social_responsibility FROM coaches WHERE role = 'social_media_manager' LIMIT 5;
