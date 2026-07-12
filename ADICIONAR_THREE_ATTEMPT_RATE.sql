-- ============================================
-- ADICIONA AS COLUNAS "three_attempt_rate" E "pot_three_attempt_rate" AOS JOGADORES
-- Cola no Supabase SQL Editor e corre (uma vez só)
--
-- Novo atributo oculto que define quantas tentativas de triplo por jogo um
-- jogador faz (a 36 min de referência) — não afeta a % de acerto nem as
-- circunstâncias do lançamento (isso continua a cargo de "three" e dos
-- outros atributos existentes), só a FREQUÊNCIA com que é escolhido para
-- lançar de longe.
-- ============================================

ALTER TABLE players ADD COLUMN IF NOT EXISTS three_attempt_rate smallint;
ALTER TABLE players ADD COLUMN IF NOT EXISTS pot_three_attempt_rate smallint;
ALTER TABLE players_preteste ADD COLUMN IF NOT EXISTS three_attempt_rate smallint;
ALTER TABLE players_preteste ADD COLUMN IF NOT EXISTS pot_three_attempt_rate smallint;

SELECT 'Colunas three_attempt_rate e pot_three_attempt_rate adicionadas!' as resultado;
