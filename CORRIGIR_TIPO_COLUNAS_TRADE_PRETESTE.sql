-- ============================================
-- CORRIGIR O TIPO DAS COLUNAS players_out/players_in EM trade_proposal_teams_preteste
-- Cola no Supabase SQL Editor e corre (só precisas de correr isto uma vez)
--
-- CAUSA: a tabela trade_proposal_teams (tabela real, em uso) já foi
-- corrigida nesta sessão (CORRIGIR_TIPO_COLUNAS_TRADE.sql) para
-- players_out/players_in serem bigint[] em vez de uuid[]. Mas a tabela de
-- snapshot trade_proposal_teams_preteste (usada pelo Ponto de Origem)
-- ficou para trás com o tipo antigo — por isso o ATUALIZAR_PONTO_ORIGEM.sql
-- falha agora ao tentar copiar a tabela real (bigint[]) para o snapshot
-- (ainda uuid[]).
--
-- Esta tabela também tem uma proposta de teste antiga e partida (ATL/CHA,
-- de 11 Jun) com UUIDs falsos nos jogadores — não são números reais de
-- jogador, por isso teriam de ser removidos antes de a coluna poder passar
-- para bigint[] (o valor não converte). É lixo de teste, não uma troca
-- real, seguro apagar.
-- ============================================

DELETE FROM trade_proposal_teams_preteste WHERE proposal_id = 'a3047522-67e7-4079-9493-7d1cf3d45ca7';
DELETE FROM trade_proposals_preteste WHERE id = 'a3047522-67e7-4079-9493-7d1cf3d45ca7';

ALTER TABLE trade_proposal_teams_preteste
  ALTER COLUMN players_out TYPE bigint[] USING players_out::text[]::bigint[],
  ALTER COLUMN players_in  TYPE bigint[] USING players_in::text[]::bigint[];

SELECT 'trade_proposal_teams_preteste corrigida! Podes voltar a correr o ATUALIZAR_PONTO_ORIGEM.sql agora.' as resultado;
