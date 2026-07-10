-- ============================================
-- ADICIONAR proposed_by_commissioner À TABELA trade_proposals
-- Cola no Supabase SQL Editor e corre (só precisas de correr isto uma vez)
--
-- CAUSA: quando o Comissário propõe uma troca em nome de uma equipa (não a
-- sua), e essa troca é depois aceite ou recusada, a notificação só ia para
-- a caixa de entrada da equipa que propôs — o Comissário nunca era avisado,
-- mesmo tendo sido ele a fazer a proposta. Esta coluna marca que a proposta
-- foi feita pelo Comissário, para se poder avisá-lo também.
-- ============================================

ALTER TABLE trade_proposals ADD COLUMN IF NOT EXISTS proposed_by_commissioner boolean DEFAULT false;
ALTER TABLE trade_proposals_preteste ADD COLUMN IF NOT EXISTS proposed_by_commissioner boolean DEFAULT false;

SELECT 'Coluna proposed_by_commissioner adicionada!' as resultado;
