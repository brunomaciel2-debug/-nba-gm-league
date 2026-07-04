-- ============================================
-- CRIAR TABELA "fa_market_offers" (nunca existiu)
-- Cola no Supabase SQL Editor e corre (uma vez so)
-- Guarda as propostas de contrato reais feitas durante a
-- semana de Free Agency (4-9 Julho), diferente da tabela
-- "fa_offers" que so serve para o contrato fixo de $650K/1 ano
-- usado depois dessa semana.
-- ============================================

CREATE TABLE IF NOT EXISTS fa_market_offers (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  player_id bigint REFERENCES players(id),
  team_id text REFERENCES teams(id),
  offered_by uuid,
  salary bigint NOT NULL,
  years int NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  score numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  UNIQUE (player_id, team_id)
);

-- Tabela de segurança gémea (sem os REFERENCES/UNIQUE, tal como as outras
-- tabelas "_preteste" existentes) para entrar no ciclo de RESET_PRE_TESTE.sql
-- e ATUALIZAR_PONTO_ORIGEM.sql como qualquer outra tabela.
CREATE TABLE IF NOT EXISTS fa_market_offers_preteste (
  id uuid PRIMARY KEY,
  player_id bigint,
  team_id text,
  offered_by uuid,
  salary bigint,
  years int,
  status text,
  score numeric,
  created_at timestamptz,
  resolved_at timestamptz
);

SELECT 'Tabela fa_market_offers criada!' as resultado;
