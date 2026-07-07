-- ============================================
-- DRAFT LOTTERY
-- Cola no Supabase SQL Editor e corre
-- Guarda o resultado do sorteio da draft (formato real da NBA desde 2019:
-- 14 equipas fora dos playoffs, odds ponderadas, so as escolhas 1-4 sao
-- sorteadas, as 5-14 seguem a ordem da classificacao).
-- ============================================

CREATE TABLE IF NOT EXISTS draft_lottery_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season text NOT NULL,
  team_id text NOT NULL,
  original_seed int NOT NULL,
  resulting_pick int NOT NULL,
  odds_pct numeric NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(season, team_id)
);

SELECT 'Draft Lottery criada' as resultado;
