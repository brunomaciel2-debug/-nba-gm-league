-- ============================================
-- ADICIONAR MERCHANDISING (venda de jerseys, fama do jogador, campanhas de marketing)
-- Cola no Supabase SQL Editor e corre (só precisas de correr isto uma vez)
-- ============================================

ALTER TABLE players ADD COLUMN IF NOT EXISTS fame int DEFAULT 50;

CREATE TABLE IF NOT EXISTS jersey_sales_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season text NOT NULL,
  month_num int NOT NULL,
  team_id text NOT NULL,
  player_id bigint NOT NULL,
  units_sold int NOT NULL,
  revenue numeric NOT NULL,
  fame_at_time int NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id text NOT NULL,
  player_id bigint NOT NULL,
  budget numeric NOT NULL,
  fame_boost_target numeric NOT NULL,
  start_week int NOT NULL,
  status text NOT NULL DEFAULT 'active',
  result_note text,
  created_at timestamptz DEFAULT now()
);

SELECT 'Merchandising (fame, jersey_sales_reports, marketing_campaigns) criado!' as resultado;
