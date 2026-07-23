-- ============================================
-- IDs DE JOGADOR NO FEED GLOBAL DE TRANSAÇÕES
-- Cola no Supabase SQL Editor e corre (uma vez só)
-- A tabela "transactions" (o feed /transactions) já guardava o ID real da
-- equipa na coluna "teams" — só a coluna "players" guardava nomes em texto,
-- sem ID nenhum. Esta coluna nova permite ligar cada jogador mencionado à
-- sua página, tal como as equipas já ficam ligadas.
-- ============================================

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS player_ids bigint[];
ALTER TABLE transactions_preteste ADD COLUMN IF NOT EXISTS player_ids bigint[];

SELECT 'Coluna player_ids adicionada a transactions!' as resultado;
