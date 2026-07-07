-- ============================================
-- DRAFT CLASS UPLOAD
-- Cola no Supabase SQL Editor e corre
-- Substitui a constante fixa NEXT_DRAFT (que exigia sempre editar codigo e
-- publicar de novo) por um valor guardado na base de dados - o upload da
-- Draft Class atualiza este valor automaticamente, sem nunca mais precisar
-- de uma alteracao de codigo.
-- ============================================

CREATE TABLE IF NOT EXISTS draft_config (
  id int PRIMARY KEY DEFAULT 1,
  next_draft_season text NOT NULL DEFAULT '2027',
  updated_at timestamptz DEFAULT now()
);

INSERT INTO draft_config (id, next_draft_season)
VALUES (1, '2027')
ON CONFLICT (id) DO NOTHING;

-- Shadow "_preteste" table so RESET_PRE_TESTE.sql / ATUALIZAR_PONTO_ORIGEM.sql
-- can back up and restore this value, same as every other mutable config
-- table (season_config, franchise_config, etc).
CREATE TABLE IF NOT EXISTS draft_config_preteste (LIKE draft_config INCLUDING ALL);
INSERT INTO draft_config_preteste SELECT * FROM draft_config ON CONFLICT (id) DO NOTHING;

SELECT * FROM draft_config;
