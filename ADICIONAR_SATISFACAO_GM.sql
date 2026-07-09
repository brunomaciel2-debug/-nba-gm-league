-- ============================================
-- SATISFACAO DO GM — avaliacao real de desempenho em 3 dimensoes:
-- Fas, Owners, Sponsors. Cola no Supabase SQL Editor e corre.
-- Tabela de log semanal em crescimento continuo (mesmo padrao de
-- power_rankings / social_media_events), para se ver a evolucao ao longo
-- da epoca, nao so o numero atual.
-- ============================================

CREATE TABLE IF NOT EXISTS gm_satisfaction_snapshots (
  id uuid primary key default gen_random_uuid(),
  team_id text not null references teams(id),
  season text not null default '2025-26',
  week_number int not null,
  win_now_index numeric,
  win_now_label text,
  fans_score numeric,
  fans_breakdown jsonb not null default '{}'::jsonb,
  owners_score numeric,
  owners_breakdown jsonb not null default '{}'::jsonb,
  sponsors_score numeric,
  sponsors_breakdown jsonb not null default '{}'::jsonb,
  performance_score numeric,
  created_at timestamptz default now(),
  unique (team_id, season, week_number)
);

CREATE TABLE IF NOT EXISTS gm_satisfaction_snapshots_preteste (LIKE gm_satisfaction_snapshots INCLUDING ALL);

SELECT * FROM gm_satisfaction_snapshots LIMIT 5;
