-- ============================================
-- PLAYOFFS DA G LEAGUE + HISTÓRICO DE CAMPEÕES (NBA + G LEAGUE)
-- Cola no Supabase SQL Editor e corre (uma vez só)
-- ============================================

-- Distingue jogos de playoff dos da época regular na G League, tal como já
-- acontece na tabela "games" da NBA.
ALTER TABLE gleague_games ADD COLUMN IF NOT EXISTS game_type text NOT NULL DEFAULT 'regular';
ALTER TABLE gleague_games_preteste ADD COLUMN IF NOT EXISTS game_type text NOT NULL DEFAULT 'regular';

-- Bracket de playoffs da G League — mesmo desenho da tabela "playoff_series"
-- já usada pela NBA, só que mais simples (jogo único por ronda em vez de
-- melhor-de-7, formato real da G League).
CREATE TABLE IF NOT EXISTS gleague_playoff_series (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  season text NOT NULL,
  series_type text NOT NULL,
  team_high text,
  team_low text,
  wins_high int NOT NULL DEFAULT 0,
  wins_low int NOT NULL DEFAULT 0,
  games_needed int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS gleague_playoff_series_preteste (
  id uuid PRIMARY KEY,
  season text,
  series_type text,
  team_high text,
  team_low text,
  wins_high int,
  wins_low int,
  games_needed int,
  status text,
  created_at timestamptz
);

-- Histórico de campeões e vice-campeões — NBA e G League juntos, distinguidos
-- pela coluna "league". Guarda o NOME da equipa na altura (não só o id),
-- para nunca depender de um join que possa quebrar num reset de época.
-- Sem cópia "_preteste": é um registo histórico definitivo, tal como
-- "awards" e "jersey_sales_reports" — fica sempre vazio no RESET, por
-- desenho (ver RESET_PRE_TESTE.sql).
CREATE TABLE IF NOT EXISTS championship_history (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  season text NOT NULL,
  league text NOT NULL,
  champion_team_id text NOT NULL,
  champion_team_name text NOT NULL,
  runner_up_team_id text NOT NULL,
  runner_up_team_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

SELECT 'Playoffs da G League + histórico de campeões prontos!' as resultado;
