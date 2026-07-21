-- ============================================
-- RETIRADAS DE JOGADORES (35+ anos) + REGISTO DE RENOVAÇÕES
-- Cola no Supabase SQL Editor e corre (uma vez só)
-- ============================================

-- Fila de decisões de fim de época — um jogador 35+ por linha, o Comissário
-- decide (via /admin/retirements) se fica mais um ano ou se retira.
CREATE TABLE IF NOT EXISTS retirement_decisions (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  season text NOT NULL,
  player_id bigint NOT NULL REFERENCES players(id),
  team_id text,
  status text NOT NULL DEFAULT 'pending',
  decision text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (season, player_id)
);
CREATE TABLE IF NOT EXISTS retirement_decisions_preteste (
  id uuid PRIMARY KEY,
  season text,
  player_id bigint,
  team_id text,
  status text,
  decision text,
  decided_at timestamptz,
  created_at timestamptz
);

SELECT 'retirement_decisions criada!' as resultado;
