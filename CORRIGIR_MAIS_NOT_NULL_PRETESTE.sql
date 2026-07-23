-- Mesmo bug do games_preteste/season, encontrado noutras 2 tabelas antes
-- de bloquearem o reset também. Corre isto junto com o
-- CORRIGIR_SEASON_GAMES_PRETESTE.sql (uma vez só).

-- allstar_config_preteste: 3 colunas sem valor (bloqueava o reset porque
-- allstar_config exige sempre um valor nestas 3)
UPDATE allstar_config_preteste SET rising_stars_announced = false WHERE rising_stars_announced IS NULL;
UPDATE allstar_config_preteste SET rising_stars_played = false WHERE rising_stars_played IS NULL;
UPDATE allstar_config_preteste SET all_star_game_played = false WHERE all_star_game_played IS NULL;
ALTER TABLE allstar_config_preteste ALTER COLUMN rising_stars_announced SET NOT NULL;
ALTER TABLE allstar_config_preteste ALTER COLUMN rising_stars_announced SET DEFAULT false;
ALTER TABLE allstar_config_preteste ALTER COLUMN rising_stars_played SET NOT NULL;
ALTER TABLE allstar_config_preteste ALTER COLUMN rising_stars_played SET DEFAULT false;
ALTER TABLE allstar_config_preteste ALTER COLUMN all_star_game_played SET NOT NULL;
ALTER TABLE allstar_config_preteste ALTER COLUMN all_star_game_played SET DEFAULT false;

-- gleague_games_preteste: 540 jogos sem tipo definido
UPDATE gleague_games_preteste SET game_type = 'regular' WHERE game_type IS NULL;
ALTER TABLE gleague_games_preteste ALTER COLUMN game_type SET NOT NULL;
ALTER TABLE gleague_games_preteste ALTER COLUMN game_type SET DEFAULT 'regular';

-- Estas duas não tinham nenhuma linha nula agora, mas têm o mesmo risco
-- para o futuro (a tabela live exige valor, a preteste não) — corrigido
-- preventivamente.
UPDATE transactions_preteste SET category = 'player' WHERE category IS NULL;
ALTER TABLE transactions_preteste ALTER COLUMN category SET NOT NULL;
ALTER TABLE transactions_preteste ALTER COLUMN category SET DEFAULT 'player';

UPDATE gleague_player_stats_preteste SET off_reb = 0 WHERE off_reb IS NULL;
UPDATE gleague_player_stats_preteste SET def_reb = 0 WHERE def_reb IS NULL;
UPDATE gleague_player_stats_preteste SET turnovers = 0 WHERE turnovers IS NULL;
UPDATE gleague_player_stats_preteste SET fouls = 0 WHERE fouls IS NULL;
UPDATE gleague_player_stats_preteste SET double_doubles = 0 WHERE double_doubles IS NULL;
UPDATE gleague_player_stats_preteste SET triple_doubles = 0 WHERE triple_doubles IS NULL;
ALTER TABLE gleague_player_stats_preteste ALTER COLUMN off_reb SET NOT NULL, ALTER COLUMN off_reb SET DEFAULT 0;
ALTER TABLE gleague_player_stats_preteste ALTER COLUMN def_reb SET NOT NULL, ALTER COLUMN def_reb SET DEFAULT 0;
ALTER TABLE gleague_player_stats_preteste ALTER COLUMN turnovers SET NOT NULL, ALTER COLUMN turnovers SET DEFAULT 0;
ALTER TABLE gleague_player_stats_preteste ALTER COLUMN fouls SET NOT NULL, ALTER COLUMN fouls SET DEFAULT 0;
ALTER TABLE gleague_player_stats_preteste ALTER COLUMN double_doubles SET NOT NULL, ALTER COLUMN double_doubles SET DEFAULT 0;
ALTER TABLE gleague_player_stats_preteste ALTER COLUMN triple_doubles SET NOT NULL, ALTER COLUMN triple_doubles SET DEFAULT 0;

SELECT 'Todas as inconsistências preteste corrigidas!' as resultado;
