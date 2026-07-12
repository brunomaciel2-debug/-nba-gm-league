-- ============================================
-- ADICIONA A COLUNA "free_throw_rate" AOS JOGADORES
-- Cola no Supabase SQL Editor e corre (uma vez só)
--
-- Novo atributo oculto que define quantos Lances Livres por jogo um
-- jogador vai buscar (a 36 min de referência) — não afeta a % de Lance
-- Livre (isso continua a cargo do atributo "ft" existente), só a
-- FREQUÊNCIA com que vai à linha. Relacionado com o Draw Fouls mas
-- separado dele: draw_foul continua a decidir o "how" (é ele quem sofre
-- a falta), free_throw_rate decide o "how often" (com que frequência).
-- ============================================

ALTER TABLE players ADD COLUMN IF NOT EXISTS free_throw_rate smallint;
ALTER TABLE players_preteste ADD COLUMN IF NOT EXISTS free_throw_rate smallint;

SELECT 'Coluna free_throw_rate adicionada!' as resultado;
