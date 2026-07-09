-- ============================================
-- HISTORICO DE SOCIAL MEDIA — registo real de cada evento (Fan Interaction /
-- Social Responsibility) para a nova aba "Social Media" na pagina da equipa.
-- Cola no Supabase SQL Editor e corre.
-- Tabela de log em crescimento continuo (mesmo padrao de player_interactions):
-- guarda data, tipo de evento, jogador envolvido e o impacto real (seguidores,
-- moral, popularidade, fama) tal como foi calculado no momento — nao e um
-- valor recalculado depois, e o que realmente aconteceu.
-- ============================================

CREATE TABLE IF NOT EXISTS social_media_events (
  id uuid primary key default gen_random_uuid(),
  team_id text not null references teams(id),
  season text not null default '2025-26',
  week_number int not null,
  event_type text not null,        -- 'fan_interaction' | 'social_responsibility'
  player_id int,
  player_name text,
  follower_delta int not null default 0,
  followers_after bigint not null,
  impact_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS social_media_events_preteste (LIKE social_media_events INCLUDING ALL);

SELECT * FROM social_media_events LIMIT 5;
