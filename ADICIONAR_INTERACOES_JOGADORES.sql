-- ============================================
-- SISTEMA DE INTERAÇÕES COM JOGADORES
-- Cola no Supabase SQL Editor e corre (uma vez só)
--
-- Cria a pool de razões pelas quais um jogador pode ficar descontente
-- (player_interaction_types, ~20 linhas, conteúdo fixo — mesmo padrão do
-- injury_types) e a tabela de registo de interações reais (player_interactions,
-- mesmo espírito do injury_log). Inclui os gémeos _preteste para o ciclo
-- de testes (Ponto de Origem).
-- ============================================

CREATE TABLE IF NOT EXISTS player_interaction_types (
  id uuid primary key default gen_random_uuid(),
  reason_key text unique not null,
  category text not null,
  resolution_type text not null,
  monitor_metric text,
  monitor_weeks int default 2,
  requires_partner boolean default false,
  weight numeric default 10,
  moral_met int,
  moral_partial int,
  moral_ignored int,
  moral_concede int,
  moral_compromise int,
  moral_dismiss int,
  moral_concede_partner int,
  moral_compromise_partner int,
  moral_dismiss_partner int,
  created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS player_interaction_types_preteste (LIKE player_interaction_types INCLUDING ALL);

CREATE TABLE IF NOT EXISTS player_interactions (
  id uuid primary key default gen_random_uuid(),
  player_id int not null,
  team_id text not null,
  season text not null default '2025-26',
  reason_key text not null,
  status text not null default 'pending_response',
  created_week int not null,
  deadline_week int,
  demand_target numeric,
  partner_player_id int,
  baseline_value numeric,
  current_progress numeric,
  response_choice text,
  outcome text,
  moral_before int,
  moral_after int,
  resolved_week int,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS player_interactions_preteste (LIKE player_interactions INCLUDING ALL);

-- ── Seed the reason pool (identical in both live and _preteste — it's
-- fixed game content, not per-save state, same treatment as injury_types) ──
INSERT INTO player_interaction_types
  (reason_key, category, resolution_type, monitor_metric, monitor_weeks, requires_partner, weight,
   moral_met, moral_partial, moral_ignored, moral_concede, moral_compromise, moral_dismiss,
   moral_concede_partner, moral_compromise_partner, moral_dismiss_partner)
VALUES
  ('wants_more_minutes',            'playing_time', 'monitored', 'avg_minutes',        2, false, 20, 20, 5, -15, null, null, null, null, null, null),
  ('wants_starter_role',            'playing_time', 'monitored', 'starter_role',       2, false, 14, 20, 5, -15, null, null, null, null, null, null),
  ('wants_more_touches',            'playing_time', 'monitored', 'priority_list',      2, false, 14, 20, 5, -15, null, null, null, null, null, null),
  ('wants_clutch_role',             'playing_time', 'monitored', 'clutch_role',        2, false, 8,  20, 5, -15, null, null, null, null, null, null),
  ('wants_lockdown_role',           'playing_time', 'monitored', 'lockdown_role',      2, false, 8,  20, 5, -15, null, null, null, null, null, null),
  ('wants_more_rest',               'coaching',     'monitored', 'training_intensity', 2, false, 10, 20, 5, -15, null, null, null, null, null, null),
  ('wants_more_three_rate',         'coaching',     'monitored', 'three_rate',         2, false, 8,  20, 5, -15, null, null, null, null, null, null),
  ('wants_to_play_with_teammate',   'team_fit',     'immediate', null,                 null, true, 10, null, null, null, 18, 6, -12, 18, 0, 0),
  ('conflict_with_teammate',        'team_fit',     'immediate', null,                 null, true, 8,  null, null, null, 18, 6, -12, -10, 6, 0),
  ('wants_veteran_mentor',          'team_fit',     'immediate', null,                 null, false, 6, null, null, null, 15, 5, -10, null, null, null),
  ('unhappy_with_team_record',      'culture',      'immediate', null,                 null, false, 10, null, null, null, 15, 5, -10, null, null, null),
  ('wants_leadership_recognition',  'culture',      'immediate', null,                 null, false, 6, null, null, null, 15, 5, -10, null, null, null),
  ('wants_contract_extension_talks','contract',     'immediate', null,                 null, false, 12, null, null, null, 18, 6, -12, null, null, null),
  ('feels_underpaid',               'contract',     'immediate', null,                 null, false, 10, null, null, null, 18, 6, -12, null, null, null),
  ('feels_development_neglected',  'coaching',      'immediate', null,                 null, false, 8, null, null, null, 15, 5, -10, null, null, null),
  ('wants_specialist_for_injury',   'coaching',     'immediate', null,                 null, false, 6, null, null, null, 20, 5, -10, null, null, null),
  ('homesickness_family',           'personal',     'immediate', null,                 null, false, 4, null, null, null, 15, 8, -8, null, null, null),
  ('media_pressure_stress',        'personal',      'immediate', null,                 null, false, 4, null, null, null, 15, 8, -8, null, null, null),
  ('personal_crisis',              'personal',      'immediate', null,                 null, false, 3, null, null, null, 15, 8, -8, null, null, null),
  ('wants_front_office_aggression', 'culture',      'immediate', null,                 null, false, 8, null, null, null, 15, 5, -10, null, null, null),
  ('general_frustration',          'culture',       'immediate', null,                 null, false, 5, null, null, null, 12, 6, -10, null, null, null)
ON CONFLICT (reason_key) DO NOTHING;

INSERT INTO player_interaction_types_preteste SELECT * FROM player_interaction_types;

SELECT 'Sistema de interacoes com jogadores criado!' as resultado;
