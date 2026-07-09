-- ============================================
-- HISTORICO DE MANDATOS DE GM — para a Satisfacao do GM ser avaliada por
-- MANDATO, nao por franchise. Se um GM sair a meio da epoca e vier outro,
-- o novo so e avaliado pelas suas proprias acoes a partir da semana em que
-- assumiu, nao herda o historico do anterior.
-- Cola no Supabase SQL Editor e corre.
-- ============================================

CREATE TABLE IF NOT EXISTS gm_tenure_log (
  id uuid primary key default gen_random_uuid(),
  team_id text not null references teams(id),
  gm_user_id uuid,
  gm_name text not null,
  season text not null default '2025-26',
  started_week int not null,
  started_at timestamptz not null default now(),
  ended_week int,
  ended_at timestamptz
);

CREATE TABLE IF NOT EXISTS gm_tenure_log_preteste (LIKE gm_tenure_log INCLUDING ALL);

-- Backfill: todo o GM atualmente em funcoes fica com um mandato "aberto"
-- a comecar na semana 1 (nao temos melhor informacao sobre quando comecaram
-- de facto, e presume-se que estao la desde o inicio da epoca).
INSERT INTO gm_tenure_log (team_id, gm_user_id, gm_name, started_week)
SELECT team_id, id, display_name, 1
FROM gm_profiles
WHERE role = 'gm'
AND NOT EXISTS (
  SELECT 1 FROM gm_tenure_log t WHERE t.team_id = gm_profiles.team_id AND t.ended_week IS NULL
);

SELECT * FROM gm_tenure_log LIMIT 5;
