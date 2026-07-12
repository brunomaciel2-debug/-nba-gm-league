-- ============================================
-- ADICIONA AS COLUNAS "reb_rate" E "pot_reb_rate" AOS JOGADORES
-- Cola no Supabase SQL Editor e corre (uma vez só)
--
-- Novo atributo oculto que define o total de ressaltos por jogo de um
-- jogador (a 36 min de referência) — off_reb/def_reb continuam a decidir
-- o peso ofensivo vs. defensivo desse total, não o total em si.
-- ============================================

ALTER TABLE players ADD COLUMN IF NOT EXISTS reb_rate smallint;
ALTER TABLE players ADD COLUMN IF NOT EXISTS pot_reb_rate smallint;
ALTER TABLE players_preteste ADD COLUMN IF NOT EXISTS reb_rate smallint;
ALTER TABLE players_preteste ADD COLUMN IF NOT EXISTS pot_reb_rate smallint;

SELECT 'Colunas reb_rate e pot_reb_rate adicionadas!' as resultado;
