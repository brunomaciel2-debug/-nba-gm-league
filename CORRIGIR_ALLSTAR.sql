-- ============================================
-- CORRIGIR ALL-STAR WEEKEND
-- Cola no Supabase SQL Editor e corre
-- 1) Realinha as semanas do All-Star Weekend com o calendario real da epoca
--    (a epoca regular vai da semana 17 a 40 - antes disto a votacao e o jogo
--    estavam agendados para semanas 11-14, que cai ainda na pre-epoca).
-- 2) Adiciona a constraint unica em falta em allstar_votes - sem ela, TANTO
--    os votos automaticos como os votos reais de um GM (submetidos na
--    pagina /all-star) falhavam sempre silenciosamente, porque o codigo
--    sempre assumiu que este "upsert" tinha uma constraint para resolver
--    contra, mas ela nunca existiu na base de dados.
-- ============================================

ALTER TABLE allstar_votes
  ADD CONSTRAINT allstar_votes_unique UNIQUE (gm_team_id, season, conference, position, player_id);

UPDATE allstar_config SET
  voting_opens_week = 28,
  voting_closes_week = 30,
  announce_week = 31,
  allstar_week = 32
WHERE id = 1;

SELECT * FROM allstar_config;
