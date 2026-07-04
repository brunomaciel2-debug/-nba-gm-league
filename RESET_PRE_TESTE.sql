-- ============================================
-- RESET COMPLETO PRÉ-TESTE
-- Cola no Supabase SQL Editor e corre
-- ============================================

-- Desactivar triggers temporariamente
SET session_replication_role = replica;

-- Limpar e restaurar cada tabela
TRUNCATE TABLE box_scores CASCADE;
INSERT INTO box_scores SELECT * FROM box_scores_preteste;

TRUNCATE TABLE play_by_play CASCADE;
INSERT INTO play_by_play SELECT * FROM play_by_play_preteste;

TRUNCATE TABLE games CASCADE;
INSERT INTO games SELECT * FROM games_preteste;

TRUNCATE TABLE preseason_games CASCADE;
INSERT INTO preseason_games SELECT * FROM preseason_games_preteste;

TRUNCATE TABLE player_stats CASCADE;
INSERT INTO player_stats SELECT * FROM player_stats_preteste;

TRUNCATE TABLE players CASCADE;
INSERT INTO players SELECT * FROM players_preteste;

TRUNCATE TABLE teams CASCADE;
INSERT INTO teams SELECT * FROM teams_preteste;

TRUNCATE TABLE gleague_teams CASCADE;
INSERT INTO gleague_teams SELECT * FROM gleague_teams_preteste;

TRUNCATE TABLE gleague_games CASCADE;
INSERT INTO gleague_games SELECT * FROM gleague_games_preteste;

TRUNCATE TABLE gleague_player_stats CASCADE;
INSERT INTO gleague_player_stats SELECT * FROM gleague_player_stats_preteste;

TRUNCATE TABLE coaches CASCADE;
INSERT INTO coaches SELECT * FROM coaches_preteste;

TRUNCATE TABLE gm_profiles CASCADE;
INSERT INTO gm_profiles SELECT * FROM gm_profiles_preteste;

TRUNCATE TABLE profiles CASCADE;
INSERT INTO profiles SELECT * FROM profiles_preteste;

TRUNCATE TABLE contracts CASCADE;
INSERT INTO contracts SELECT * FROM contracts_preteste;

TRUNCATE TABLE contract_extension_offers CASCADE;
INSERT INTO contract_extension_offers SELECT * FROM contract_extension_offers_preteste;

TRUNCATE TABLE gm_orders CASCADE;
INSERT INTO gm_orders SELECT * FROM gm_orders_preteste;

TRUNCATE TABLE inbox_messages CASCADE;
INSERT INTO inbox_messages SELECT * FROM inbox_messages_preteste;

TRUNCATE TABLE attribute_development CASCADE;
INSERT INTO attribute_development SELECT * FROM attribute_development_preteste;

TRUNCATE TABLE injury_log CASCADE;
INSERT INTO injury_log SELECT * FROM injury_log_preteste;

TRUNCATE TABLE transactions CASCADE;
INSERT INTO transactions SELECT * FROM transactions_preteste;

TRUNCATE TABLE awards CASCADE;
INSERT INTO awards SELECT * FROM awards_preteste;

TRUNCATE TABLE weekly_highlights CASCADE;
INSERT INTO weekly_highlights SELECT * FROM weekly_highlights_preteste;

TRUNCATE TABLE power_rankings CASCADE;
INSERT INTO power_rankings SELECT * FROM power_rankings_preteste;

TRUNCATE TABLE trade_proposals CASCADE;
INSERT INTO trade_proposals SELECT * FROM trade_proposals_preteste;

TRUNCATE TABLE trade_proposal_teams CASCADE;
INSERT INTO trade_proposal_teams SELECT * FROM trade_proposal_teams_preteste;

TRUNCATE TABLE trade_block CASCADE;
INSERT INTO trade_block SELECT * FROM trade_block_preteste;

TRUNCATE TABLE fa_offers CASCADE;
INSERT INTO fa_offers SELECT * FROM fa_offers_preteste;

TRUNCATE TABLE staff_offers CASCADE;
INSERT INTO staff_offers SELECT * FROM staff_offers_preteste;

TRUNCATE TABLE draft_picks CASCADE;
INSERT INTO draft_picks SELECT * FROM draft_picks_preteste;

TRUNCATE TABLE draft_orders CASCADE;
INSERT INTO draft_orders SELECT * FROM draft_orders_preteste;

TRUNCATE TABLE draft_results CASCADE;
INSERT INTO draft_results SELECT * FROM draft_results_preteste;

TRUNCATE TABLE prospects CASCADE;
INSERT INTO prospects SELECT * FROM prospects_preteste;

TRUNCATE TABLE training_slots CASCADE;
INSERT INTO training_slots SELECT * FROM training_slots_preteste;

TRUNCATE TABLE training_log CASCADE;
INSERT INTO training_log SELECT * FROM training_log_preteste;

TRUNCATE TABLE franchise_config CASCADE;
INSERT INTO franchise_config SELECT * FROM franchise_config_preteste;

TRUNCATE TABLE franchise_facilities CASCADE;
INSERT INTO franchise_facilities SELECT * FROM franchise_facilities_preteste;

TRUNCATE TABLE franchise_finances CASCADE;
INSERT INTO franchise_finances SELECT * FROM franchise_finances_preteste;

TRUNCATE TABLE franchise_transactions CASCADE;
INSERT INTO franchise_transactions SELECT * FROM franchise_transactions_preteste;

TRUNCATE TABLE arena_concessions CASCADE;
INSERT INTO arena_concessions SELECT * FROM arena_concessions_preteste;

TRUNCATE TABLE arena_sections CASCADE;
INSERT INTO arena_sections SELECT * FROM arena_sections_preteste;

TRUNCATE TABLE construction_queue CASCADE;
INSERT INTO construction_queue SELECT * FROM construction_queue_preteste;

TRUNCATE TABLE practice_facilities CASCADE;
INSERT INTO practice_facilities SELECT * FROM practice_facilities_preteste;

TRUNCATE TABLE sponsor_contracts CASCADE;
INSERT INTO sponsor_contracts SELECT * FROM sponsor_contracts_preteste;

TRUNCATE TABLE sponsor_objective_tracking CASCADE;
INSERT INTO sponsor_objective_tracking SELECT * FROM sponsor_objective_tracking_preteste;

TRUNCATE TABLE sponsor_objectives CASCADE;
INSERT INTO sponsor_objectives SELECT * FROM sponsor_objectives_preteste;

TRUNCATE TABLE sponsor_pool CASCADE;
INSERT INTO sponsor_pool SELECT * FROM sponsor_pool_preteste;

TRUNCATE TABLE sponsor_templates CASCADE;
INSERT INTO sponsor_templates SELECT * FROM sponsor_templates_preteste;

TRUNCATE TABLE sponsor_jersey_images CASCADE;
INSERT INTO sponsor_jersey_images SELECT * FROM sponsor_jersey_images_preteste;

TRUNCATE TABLE scout_progress CASCADE;
INSERT INTO scout_progress SELECT * FROM scout_progress_preteste;

TRUNCATE TABLE scouting_reveals CASCADE;
INSERT INTO scouting_reveals SELECT * FROM scouting_reveals_preteste;

TRUNCATE TABLE allstar_config CASCADE;
INSERT INTO allstar_config SELECT * FROM allstar_config_preteste;

TRUNCATE TABLE allstar_roster CASCADE;
INSERT INTO allstar_roster SELECT * FROM allstar_roster_preteste;

TRUNCATE TABLE allstar_votes CASCADE;
INSERT INTO allstar_votes SELECT * FROM allstar_votes_preteste;

TRUNCATE TABLE playoff_series CASCADE;
INSERT INTO playoff_series SELECT * FROM playoff_series_preteste;

TRUNCATE TABLE playoff_games CASCADE;
INSERT INTO playoff_games SELECT * FROM playoff_games_preteste;

TRUNCATE TABLE friendly_requests CASCADE;
INSERT INTO friendly_requests SELECT * FROM friendly_requests_preteste;

TRUNCATE TABLE job_applications CASCADE;
INSERT INTO job_applications SELECT * FROM job_applications_preteste;

TRUNCATE TABLE chat_messages CASCADE;
INSERT INTO chat_messages SELECT * FROM chat_messages_preteste;

TRUNCATE TABLE messages CASCADE;
INSERT INTO messages SELECT * FROM messages_preteste;

TRUNCATE TABLE articles CASCADE;
INSERT INTO articles SELECT * FROM articles_preteste;

TRUNCATE TABLE world_teams CASCADE;
INSERT INTO world_teams SELECT * FROM world_teams_preteste;

TRUNCATE TABLE season_events CASCADE;
INSERT INTO season_events SELECT * FROM season_events_preteste;

TRUNCATE TABLE site_config CASCADE;
INSERT INTO site_config SELECT * FROM site_config_preteste;

TRUNCATE TABLE injury_types CASCADE;
INSERT INTO injury_types SELECT * FROM injury_types_preteste;

TRUNCATE TABLE season_config CASCADE;
INSERT INTO season_config SELECT * FROM season_config_preteste;

-- Reactivar triggers
SET session_replication_role = DEFAULT;

SELECT 'RESET COMPLETO - voltaste ao ponto de partida!' as resultado;