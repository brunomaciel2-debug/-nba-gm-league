-- ============================================
-- HISTÓRICO DE TRANSFERÊNCIAS DE JOGADORES
-- Cola no Supabase SQL Editor e corre (só precisas de correr isto uma vez)
--
-- Nova tabela player_transactions: regista cada vez que um jogador muda de
-- equipa (troca, assinatura de free agency, corte, draft) — usada tanto
-- pelo painel de "Histórico de Transferências" na página do jogador como
-- pela aba "Transferências" na página da equipa.
-- ============================================

CREATE TABLE IF NOT EXISTS player_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id bigint NOT NULL,
  type text NOT NULL, -- 'trade' | 'fa_signing' | 'cut' | 'draft'
  from_team_id text,  -- team the player left (null for FA signing of an existing free agent, or draft)
  to_team_id text,    -- team the player joined (null for a cut)
  season text NOT NULL,
  week_number int,
  proposal_id uuid,   -- links back to trade_proposals for type='trade', otherwise null
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_player_transactions_player ON player_transactions(player_id);
CREATE INDEX IF NOT EXISTS idx_player_transactions_from_team ON player_transactions(from_team_id);
CREATE INDEX IF NOT EXISTS idx_player_transactions_to_team ON player_transactions(to_team_id);

-- Snapshot table for the Ponto de Origem reset mechanism, same pattern as
-- every other game-state table.
CREATE TABLE IF NOT EXISTS player_transactions_preteste (LIKE player_transactions INCLUDING ALL);

SELECT 'Tabela player_transactions criada!' as resultado;
