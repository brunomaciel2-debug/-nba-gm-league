-- ============================================
-- ADICIONA AS COLUNAS "assist_rate" E "pot_assist_rate" AOS JOGADORES
-- Cola no Supabase SQL Editor e corre (uma vez só)
--
-- Novo atributo oculto que define a média de assistências por jogo de um
-- jogador (a 36 min de referência) — os atributos existentes ligados a
-- passe (pass_vis, pass_iq, ball_hdl, assist_role) continuam a decidir a
-- QUALIDADE/tipo do passe, o assist_rate decide QUANTAS assistências.
-- ============================================

ALTER TABLE players ADD COLUMN IF NOT EXISTS assist_rate smallint;
ALTER TABLE players ADD COLUMN IF NOT EXISTS pot_assist_rate smallint;
ALTER TABLE players_preteste ADD COLUMN IF NOT EXISTS assist_rate smallint;
ALTER TABLE players_preteste ADD COLUMN IF NOT EXISTS pot_assist_rate smallint;

SELECT 'Colunas assist_rate e pot_assist_rate adicionadas!' as resultado;
