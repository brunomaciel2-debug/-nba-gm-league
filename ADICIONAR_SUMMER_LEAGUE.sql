-- ============================================
-- SUMMER LEAGUE
-- Cola no Supabase SQL Editor e corre (uma vez só)
--
-- Torneio à parte (Las Vegas, 11 dias) onde as 30 equipas jogam com os seus
-- Rookies + Sophomores + FAs até 26 anos, para os GMs verem como se saem
-- antes da época real. Tabelas totalmente isoladas de games/box_scores —
-- nenhum resultado ou estatística daqui conta para o registo real, cap ou
-- carreira de ninguém. Inclui os gémeos _preteste (Ponto de Origem).
-- ============================================

CREATE TABLE IF NOT EXISTS summer_league_rosters (
  id uuid primary key default gen_random_uuid(),
  season text not null,
  team_id text not null,
  player_id int not null,
  role text not null, -- 'rookie' | 'sophomore' | 'filler'
  created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS summer_league_rosters_preteste (LIKE summer_league_rosters INCLUDING ALL);

CREATE TABLE IF NOT EXISTS summer_league_games (
  id uuid primary key default gen_random_uuid(),
  season text not null,
  round text not null, -- 'prelim' | 'consolation' | 'semifinal' | 'final'
  game_number int, -- 1-4 for prelim rounds, null otherwise
  home_team text not null,
  away_team text not null,
  home_score int,
  away_score int,
  status text not null default 'final',
  scheduled_date date,
  created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS summer_league_games_preteste (LIKE summer_league_games INCLUDING ALL);

CREATE TABLE IF NOT EXISTS summer_league_box_scores (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null,
  player_id int not null,
  team_id text not null,
  mins int, is_starter boolean,
  pts int, ast int, stl int, blk int,
  fga int, fgm int, tpa int, tpm int, fta int, ftm int,
  pf int, tech_fouls int, off_reb int, def_reb int, reb int, turnovers int, plus_minus int,
  created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS summer_league_box_scores_preteste (LIKE summer_league_box_scores INCLUDING ALL);

SELECT 'Summer League criada!' as resultado;
