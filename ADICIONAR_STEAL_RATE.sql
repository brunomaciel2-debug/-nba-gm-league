-- ============================================
-- ADICIONA A COLUNA "steal_rate" AOS JOGADORES
-- Cola no Supabase SQL Editor e corre (uma vez só)
--
-- Novo atributo oculto que define quantos roubos de bola por jogo um
-- jogador faz (a 36 min de referência) — não afeta a qualidade/forma como
-- rouba a bola (isso continua a cargo do atributo "stl" existente e dos
-- outros atributos defensivos), só a FREQUÊNCIA com que rouba.
-- ============================================

ALTER TABLE players ADD COLUMN IF NOT EXISTS steal_rate smallint;
ALTER TABLE players_preteste ADD COLUMN IF NOT EXISTS steal_rate smallint;

SELECT 'Coluna steal_rate adicionada!' as resultado;
