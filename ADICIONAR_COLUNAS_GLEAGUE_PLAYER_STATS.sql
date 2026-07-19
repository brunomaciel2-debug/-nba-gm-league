-- ============================================
-- ADICIONAR COLUNAS EM FALTA A "gleague_player_stats"
-- Cola no Supabase SQL Editor e corre (uma vez so)
-- A tabela ja existia mas so guardava pts/reb/ast/stl/blk/fgm/fga/tpm/tpa/ftm/fta/mins —
-- faltavam ressaltos ofensivos/defensivos, perdas de bola, faltas
-- pessoais e duplos-duplos/triplos-duplos, que a NBA ja mostra.
-- ============================================

ALTER TABLE gleague_player_stats ADD COLUMN IF NOT EXISTS off_reb integer NOT NULL DEFAULT 0;
ALTER TABLE gleague_player_stats ADD COLUMN IF NOT EXISTS def_reb integer NOT NULL DEFAULT 0;
ALTER TABLE gleague_player_stats ADD COLUMN IF NOT EXISTS turnovers integer NOT NULL DEFAULT 0;
ALTER TABLE gleague_player_stats ADD COLUMN IF NOT EXISTS fouls integer NOT NULL DEFAULT 0;
ALTER TABLE gleague_player_stats ADD COLUMN IF NOT EXISTS double_doubles integer NOT NULL DEFAULT 0;
ALTER TABLE gleague_player_stats ADD COLUMN IF NOT EXISTS triple_doubles integer NOT NULL DEFAULT 0;

ALTER TABLE gleague_player_stats_preteste ADD COLUMN IF NOT EXISTS off_reb integer;
ALTER TABLE gleague_player_stats_preteste ADD COLUMN IF NOT EXISTS def_reb integer;
ALTER TABLE gleague_player_stats_preteste ADD COLUMN IF NOT EXISTS turnovers integer;
ALTER TABLE gleague_player_stats_preteste ADD COLUMN IF NOT EXISTS fouls integer;
ALTER TABLE gleague_player_stats_preteste ADD COLUMN IF NOT EXISTS double_doubles integer;
ALTER TABLE gleague_player_stats_preteste ADD COLUMN IF NOT EXISTS triple_doubles integer;

SELECT 'Colunas adicionadas a gleague_player_stats!' as resultado;
