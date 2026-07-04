-- ============================================
-- CRIAR TABELA "awards" (nunca existiu)
-- Cola no Supabase SQL Editor e corre (uma vez so)
-- Sem esta tabela, o sistema de premios (MVP, Defensivo do Ano,
-- Rookie do Ano, Jogador da Semana/Mes) falha sempre em silencio.
-- ============================================

CREATE TABLE IF NOT EXISTS awards (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  season text NOT NULL,
  award_type text NOT NULL,
  period text NOT NULL,
  conference text,
  player_id bigint REFERENCES players(id),
  coach_id uuid REFERENCES coaches(id),
  team_id text REFERENCES teams(id),
  score numeric,
  stats_context jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (season, award_type, period)
);

-- Tabela de segurança gémea (sem os REFERENCES/UNIQUE, tal como as outras
-- tabelas "_preteste" existentes) para entrar no ciclo de RESET_PRE_TESTE.sql
-- e ATUALIZAR_PONTO_ORIGEM.sql como qualquer outra tabela.
CREATE TABLE IF NOT EXISTS awards_preteste (
  id uuid PRIMARY KEY,
  season text,
  award_type text,
  period text,
  conference text,
  player_id bigint,
  coach_id uuid,
  team_id text,
  score numeric,
  stats_context jsonb,
  notes text,
  created_at timestamptz
);

SELECT 'Tabela awards criada!' as resultado;
