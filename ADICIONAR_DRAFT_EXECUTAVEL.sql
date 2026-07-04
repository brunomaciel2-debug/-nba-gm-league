-- ============================================
-- DRAFT EXECUTÁVEL — colunas novas
-- Cola no Supabase SQL Editor e corre (uma vez só)
--
-- Nenhuma tabela nova é criada: prospects, draft_picks, draft_orders e
-- draft_results já existem e já estão no ciclo do RESET_PRE_TESTE.sql /
-- ATUALIZAR_PONTO_ORIGEM.sql — não é preciso mexer nesses ficheiros.
-- ============================================

-- draft_orders: falta o campo "round" (ronda 1 e ronda 2 têm janelas de
-- submissão e listas separadas). Uma equipa só pode ter UMA lista
-- combinada por ronda (cobre todas as escolhas que tiver nessa ronda).
ALTER TABLE draft_orders ADD COLUMN IF NOT EXISTS round int;
ALTER TABLE draft_orders_preteste ADD COLUMN IF NOT EXISTS round int;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'draft_orders_team_season_round_unique'
  ) THEN
    ALTER TABLE draft_orders ADD CONSTRAINT draft_orders_team_season_round_unique
      UNIQUE (team_id, season, round);
  END IF;
END $$;

-- prospects: marcar quem já foi escolhido (sai do "pool" disponível da
-- ronda seguinte) e a que jogador real deu origem.
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS drafted boolean DEFAULT false;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS drafted_by_team_id text REFERENCES teams(id);
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS resulting_player_id bigint REFERENCES players(id);
ALTER TABLE prospects_preteste ADD COLUMN IF NOT EXISTS drafted boolean DEFAULT false;
ALTER TABLE prospects_preteste ADD COLUMN IF NOT EXISTS drafted_by_team_id text;
ALTER TABLE prospects_preteste ADD COLUMN IF NOT EXISTS resulting_player_id bigint;

-- players: contrato de rookie (tiers fixos por pick) + confirmação
-- pós-draft + progressão das Team Options.
ALTER TABLE players ADD COLUMN IF NOT EXISTS is_rookie_contract boolean DEFAULT false;
ALTER TABLE players ADD COLUMN IF NOT EXISTS rookie_draft_season text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS rookie_draft_round int;
ALTER TABLE players ADD COLUMN IF NOT EXISTS rookie_draft_pick int;
ALTER TABLE players ADD COLUMN IF NOT EXISTS rookie_years_elapsed int DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS rookie_option_status text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS rookie_option_deadline timestamptz;
ALTER TABLE players ADD COLUMN IF NOT EXISTS draft_confirm_deadline timestamptz;

ALTER TABLE players_preteste ADD COLUMN IF NOT EXISTS is_rookie_contract boolean DEFAULT false;
ALTER TABLE players_preteste ADD COLUMN IF NOT EXISTS rookie_draft_season text;
ALTER TABLE players_preteste ADD COLUMN IF NOT EXISTS rookie_draft_round int;
ALTER TABLE players_preteste ADD COLUMN IF NOT EXISTS rookie_draft_pick int;
ALTER TABLE players_preteste ADD COLUMN IF NOT EXISTS rookie_years_elapsed int DEFAULT 0;
ALTER TABLE players_preteste ADD COLUMN IF NOT EXISTS rookie_option_status text;
ALTER TABLE players_preteste ADD COLUMN IF NOT EXISTS rookie_option_deadline timestamptz;
ALTER TABLE players_preteste ADD COLUMN IF NOT EXISTS draft_confirm_deadline timestamptz;

SELECT 'Draft executável — colunas adicionadas!' as resultado;
