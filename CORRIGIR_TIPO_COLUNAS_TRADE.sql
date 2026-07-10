-- ============================================
-- CORRIGIR O TIPO DAS COLUNAS players_out/players_in EM trade_proposal_teams
-- Cola no Supabase SQL Editor e corre (só precisas de correr isto uma vez)
--
-- CAUSA RAIZ de "as trocas não aparecem em lado nenhum": a tabela
-- trade_proposal_teams foi criada com players_out/players_in do tipo
-- uuid[] — mas o id real de um jogador (players.id) é um número inteiro
-- (ex: 840), não um UUID. Isto significa que QUALQUER troca com jogadores
-- (não só escolhas de draft) falhava sempre ao gravar, silenciosamente,
-- desde sempre — nunca foi um problema de hoje, é estrutural.
--
-- picks_out/picks_in ficam como estavam (uuid[]) porque draft_picks.id
-- É mesmo um UUID — essa parte sempre esteve correta.
-- ============================================

ALTER TABLE trade_proposal_teams
  ALTER COLUMN players_out TYPE bigint[] USING players_out::text[]::bigint[],
  ALTER COLUMN players_in  TYPE bigint[] USING players_in::text[]::bigint[];

SELECT 'Colunas players_out/players_in corrigidas para bigint[]! As trocas com jogadores devem funcionar agora.' as resultado;
