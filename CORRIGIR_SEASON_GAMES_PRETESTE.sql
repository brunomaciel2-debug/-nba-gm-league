-- Corrige um bug: quando a coluna "season" foi adicionada, a tabela
-- games_preteste ficou sem valor (NULL) e sem exigir um, enquanto "games"
-- exige sempre um valor — por isso o RESET_PRE_TESTE.sql falhava ao tentar
-- repor os jogos. Isto só precisa de correr uma vez.
UPDATE games_preteste SET season = '2025-26' WHERE season IS NULL;
ALTER TABLE games_preteste ALTER COLUMN season SET NOT NULL;
ALTER TABLE games_preteste ALTER COLUMN season SET DEFAULT '2025-26';

SELECT 'games_preteste corrigido!' as resultado;
