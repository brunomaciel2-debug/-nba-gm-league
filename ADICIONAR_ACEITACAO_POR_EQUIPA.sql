-- ============================================
-- ADICIONAR status POR EQUIPA EM trade_proposal_teams
-- Cola no Supabase SQL Editor e corre (só precisas de correr isto uma vez)
--
-- CAUSA: numa troca a 3 (ou mais) equipas, assim que UMA das equipas
-- recetoras aceitava, a troca INTEIRA era executada de imediato — mesmo
-- que outras equipas envolvidas ainda não tivessem tido oportunidade de
-- aceitar ou recusar. Isto acontecia porque só existia um status geral
-- na proposta (trade_proposals.status), nunca um status por equipa.
--
-- Esta coluna guarda a resposta de CADA equipa individualmente
-- ('pending'/'accepted'/'rejected'). A equipa que propôs a troca já fica
-- automaticamente 'accepted' (implícito, foi ela que propôs). A troca só
-- é mesmo executada quando TODAS as equipas envolvidas tiverem 'accepted'.
-- Uma recusa de qualquer equipa cancela a troca toda.
-- ============================================

ALTER TABLE trade_proposal_teams ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
ALTER TABLE trade_proposal_teams_preteste ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';

-- Propostas já existentes: marca a equipa iniciadora como 'accepted' (ela
-- propôs, logo já concordou) e o resto conforme o estado atual da troca —
-- se a troca já estava aceite/recusada no geral, todas as equipas ficam
-- com esse mesmo estado; se ainda está pendente, as não-iniciadoras ficam
-- 'pending'.
UPDATE trade_proposal_teams tpt
SET status = CASE
  WHEN tpt.team_id = tp.initiator_team THEN 'accepted'
  WHEN tp.status IN ('accepted','rejected') THEN tp.status
  ELSE 'pending'
END
FROM trade_proposals tp
WHERE tpt.proposal_id = tp.id;

UPDATE trade_proposal_teams_preteste tpt
SET status = CASE
  WHEN tpt.team_id = tp.initiator_team THEN 'accepted'
  WHEN tp.status IN ('accepted','rejected') THEN tp.status
  ELSE 'pending'
END
FROM trade_proposals_preteste tp
WHERE tpt.proposal_id = tp.id;

SELECT 'Coluna status adicionada e propostas existentes atualizadas!' as resultado;
