-- ============================================
-- ANULAR AS ESCOLHAS DE DRAFT DE 2026
-- Cola no Supabase SQL Editor e corre (só precisas de correr isto uma vez)
--
-- CAUSA: a Season 1 não tem um draft real de 2026 — o sistema de draft
-- (draft_config.next_draft_season) está fixo em 2027, portanto quando a
-- época chegar à semana do draft (semana 51/52), o jogo vai resolver o
-- draft de 2027 (que já tem uma turma de prospects carregada) e nunca o
-- de 2026. As draft_picks com season='2026' nunca se vão converter em
-- jogadores — são um bem "morto" que continuava a poder ser negociado
-- como se tivesse valor real.
--
-- Esta correção anula (status='void') todas as escolhas de 2026 em vez de
-- as apagar — mantém o histórico de trocas já feitas intacto (ex: a troca
-- Portland/Brooklyn que já envolveu uma destas escolhas continua a mostrar
-- corretamente o que foi trocado), mas impede que voltem a ser
-- selecionadas em novas propostas de troca ou apareçam na lista de
-- escolhas de cada equipa.
-- ============================================

-- Anula na tabela real E na tabela de snapshot (Ponto de Origem) — se só
-- anulasse a tabela real, um RESET_PRE_TESTE.sql (que copia do snapshot)
-- traria de volta as escolhas de 2026 como 'owned', desfazendo a correção.
UPDATE draft_picks SET status = 'void' WHERE season = '2026' AND status = 'owned';
UPDATE draft_picks_preteste SET status = 'void' WHERE season = '2026' AND status = 'owned';

SELECT 'Escolhas de draft de 2026 anuladas (tabela real + Ponto de Origem)! Já não podem ser negociadas nem aparecem na lista de escolhas de cada equipa, mesmo depois de um RESET.' as resultado,
       (SELECT count(*) FROM draft_picks WHERE season = '2026' AND status = 'void') as total_anuladas_real,
       (SELECT count(*) FROM draft_picks_preteste WHERE season = '2026' AND status = 'void') as total_anuladas_preteste;
