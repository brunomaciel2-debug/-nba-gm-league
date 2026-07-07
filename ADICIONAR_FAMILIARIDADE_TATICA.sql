-- ============================================
-- FAMILIARIDADE COM SISTEMA TATICO
-- Cola no Supabase SQL Editor e corre
-- Cada equipa desenvolve uma "arvore de tecnologias" propria por sistema
-- ofensivo (motion/pickroll/transition/iso/post) - 15 nos por sistema (piramide
-- 5/4/3/2/1). O progresso so avanca no sistema atualmente escolhido nas
-- ordens semanais (gm_orders.atk_style); os outros sistemas decaem devagar.
-- ============================================

CREATE TABLE IF NOT EXISTS tactical_familiarity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id text NOT NULL,
  system text NOT NULL,
  node_id text NOT NULL,
  progress numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(team_id, system, node_id)
);

CREATE TABLE IF NOT EXISTS tactical_focus (
  team_id text NOT NULL,
  system text NOT NULL,
  node_id text,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY(team_id, system)
);

-- Ponto de Origem snapshot counterparts (mesmo tratamento do training_slots -
-- progresso real da epoca, restaurado no RESET_PRE_TESTE.sql, nao apenas
-- limpo como awards/jersey_sales_reports).
CREATE TABLE IF NOT EXISTS tactical_familiarity_preteste (LIKE tactical_familiarity INCLUDING ALL);
CREATE TABLE IF NOT EXISTS tactical_focus_preteste (LIKE tactical_focus INCLUDING ALL);

SELECT 'Familiaridade tatica criada' as resultado;
