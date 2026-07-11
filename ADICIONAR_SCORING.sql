-- ============================================
-- ADICIONA AS COLUNAS "scoring" E "pot_scoring" AOS JOGADORES
-- Cola no Supabase SQL Editor e corre (uma vez só)
--
-- Novo atributo oculto que define a média de pontos por jogo de um
-- jogador (a 36 min de referência) — os atributos de lançamento
-- existentes (three, layup, dunk, mid, etc.) continuam a decidir COMO
-- os pontos são marcados, o scoring decide QUANTOS.
-- ============================================

ALTER TABLE players ADD COLUMN IF NOT EXISTS scoring smallint;
ALTER TABLE players ADD COLUMN IF NOT EXISTS pot_scoring smallint;
ALTER TABLE players_preteste ADD COLUMN IF NOT EXISTS scoring smallint;
ALTER TABLE players_preteste ADD COLUMN IF NOT EXISTS pot_scoring smallint;

SELECT 'Colunas scoring e pot_scoring adicionadas!' as resultado;
