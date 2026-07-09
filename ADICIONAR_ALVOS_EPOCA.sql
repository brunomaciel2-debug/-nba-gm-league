-- ============================================
-- ALVOS DA EPOCA (GM Satisfaction v3) — expetativas bloqueadas uma unica
-- vez por mandato de GM (inicio da epoca regular, ou inicio do mandato se
-- for mais tarde), para que um trade a meio da epoca nao baixe/suba as
-- expetativas ja definidas. Guarda tambem alvos concretos de vitorias
-- (numeros reais, nao so percentagens) para Fas e Administracao.
-- Cola no Supabase SQL Editor e corre.
-- ============================================

CREATE TABLE IF NOT EXISTS gm_season_targets (
  id uuid primary key default gen_random_uuid(),
  team_id text not null references teams(id),
  season text not null default '2025-26',
  tenure_started_week int not null,
  locked_week int not null,
  locked_wni numeric not null,
  locked_win_now_label text not null,
  fans_target_wins int not null,
  owners_target_wins int not null,
  created_at timestamptz default now(),
  unique (team_id, season, tenure_started_week)
);

CREATE TABLE IF NOT EXISTS gm_season_targets_preteste (LIKE gm_season_targets INCLUDING ALL);

SELECT * FROM gm_season_targets LIMIT 5;
