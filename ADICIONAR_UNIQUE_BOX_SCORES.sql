-- Makes a duplicate box score physically impossible at the database level,
-- instead of relying only on application-level concurrency guards. A real
-- incident traced to an unsafe retry: a box score insert that succeeded on
-- the server but errored on the client (a momentary connection hiccup) got
-- retried with the exact same rows, inserting the same player's stats for
-- the same game a second time. With this constraint in place, any future
-- retry (or any other duplicate-insert path, known or not yet discovered)
-- becomes a normal UPSERT no-op instead of a second row.
--
-- Existing data must already be duplicate-free before this can be added —
-- confirmed clean (gleague_box_scores had 2 affected games, already fixed;
-- box_scores and summer_league_box_scores had none).

ALTER TABLE box_scores
  ADD CONSTRAINT box_scores_game_player_unique UNIQUE (game_id, player_id);

ALTER TABLE gleague_box_scores
  ADD CONSTRAINT gleague_box_scores_game_player_unique UNIQUE (game_id, player_id);

ALTER TABLE summer_league_box_scores
  ADD CONSTRAINT summer_league_box_scores_game_player_unique UNIQUE (game_id, player_id);

SELECT 'unique constraints added!' as resultado;
