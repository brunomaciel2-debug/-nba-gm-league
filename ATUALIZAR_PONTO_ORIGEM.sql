-- ============================================
-- ATUALIZAR PONTO DE ORIGEM
-- Cola no Supabase SQL Editor e corre
-- Tira uma nova "fotografia" do estado atual e torna-a
-- o novo Ponto de Origem (o que o RESET_PRE_TESTE.sql restaura)
-- ============================================

SET session_replication_role = replica;

TRUNCATE TABLE box_scores_preteste CASCADE;
INSERT INTO box_scores_preteste SELECT * FROM box_scores;

TRUNCATE TABLE play_by_play_preteste CASCADE;
INSERT INTO play_by_play_preteste SELECT * FROM play_by_play;

TRUNCATE TABLE games_preteste CASCADE;
INSERT INTO games_preteste SELECT * FROM games;

TRUNCATE TABLE preseason_games_preteste CASCADE;
INSERT INTO preseason_games_preteste SELECT * FROM preseason_games;

TRUNCATE TABLE player_stats_preteste CASCADE;
INSERT INTO player_stats_preteste SELECT * FROM player_stats;

TRUNCATE TABLE players_preteste CASCADE;
INSERT INTO players_preteste SELECT * FROM players;

TRUNCATE TABLE teams_preteste CASCADE;
INSERT INTO teams_preteste SELECT * FROM teams;

TRUNCATE TABLE gleague_teams_preteste CASCADE;
INSERT INTO gleague_teams_preteste SELECT * FROM gleague_teams;

TRUNCATE TABLE gleague_games_preteste CASCADE;
INSERT INTO gleague_games_preteste SELECT * FROM gleague_games;

TRUNCATE TABLE gleague_player_stats_preteste CASCADE;
INSERT INTO gleague_player_stats_preteste SELECT * FROM gleague_player_stats;

TRUNCATE TABLE coaches_preteste CASCADE;
INSERT INTO coaches_preteste SELECT * FROM coaches;

TRUNCATE TABLE gm_profiles_preteste CASCADE;
INSERT INTO gm_profiles_preteste SELECT * FROM gm_profiles;

TRUNCATE TABLE profiles_preteste CASCADE;
INSERT INTO profiles_preteste SELECT * FROM profiles;

TRUNCATE TABLE contracts_preteste CASCADE;
INSERT INTO contracts_preteste SELECT * FROM contracts;

TRUNCATE TABLE contract_extension_offers_preteste CASCADE;
INSERT INTO contract_extension_offers_preteste SELECT * FROM contract_extension_offers;

TRUNCATE TABLE gm_orders_preteste CASCADE;
INSERT INTO gm_orders_preteste SELECT * FROM gm_orders;

TRUNCATE TABLE inbox_messages_preteste CASCADE;
INSERT INTO inbox_messages_preteste SELECT * FROM inbox_messages;

TRUNCATE TABLE attribute_development_preteste CASCADE;
INSERT INTO attribute_development_preteste SELECT * FROM attribute_development;

TRUNCATE TABLE injury_log_preteste CASCADE;
INSERT INTO injury_log_preteste SELECT * FROM injury_log;

TRUNCATE TABLE transactions_preteste CASCADE;
INSERT INTO transactions_preteste SELECT * FROM transactions;

TRUNCATE TABLE weekly_highlights_preteste CASCADE;
INSERT INTO weekly_highlights_preteste SELECT * FROM weekly_highlights;

TRUNCATE TABLE power_rankings_preteste CASCADE;
INSERT INTO power_rankings_preteste SELECT * FROM power_rankings;

TRUNCATE TABLE trade_proposals_preteste CASCADE;
INSERT INTO trade_proposals_preteste SELECT * FROM trade_proposals;

TRUNCATE TABLE trade_proposal_teams_preteste CASCADE;
INSERT INTO trade_proposal_teams_preteste SELECT * FROM trade_proposal_teams;

TRUNCATE TABLE trade_block_preteste CASCADE;
INSERT INTO trade_block_preteste SELECT * FROM trade_block;

TRUNCATE TABLE fa_offers_preteste CASCADE;
INSERT INTO fa_offers_preteste SELECT * FROM fa_offers;

TRUNCATE TABLE staff_offers_preteste CASCADE;
INSERT INTO staff_offers_preteste SELECT * FROM staff_offers;

TRUNCATE TABLE draft_picks_preteste CASCADE;
INSERT INTO draft_picks_preteste SELECT * FROM draft_picks;

TRUNCATE TABLE draft_orders_preteste CASCADE;
INSERT INTO draft_orders_preteste SELECT * FROM draft_orders;

TRUNCATE TABLE draft_results_preteste CASCADE;
INSERT INTO draft_results_preteste SELECT * FROM draft_results;

TRUNCATE TABLE prospects_preteste CASCADE;
INSERT INTO prospects_preteste SELECT * FROM prospects;

TRUNCATE TABLE training_slots_preteste CASCADE;
INSERT INTO training_slots_preteste SELECT * FROM training_slots;

TRUNCATE TABLE training_log_preteste CASCADE;
INSERT INTO training_log_preteste SELECT * FROM training_log;

TRUNCATE TABLE franchise_config_preteste CASCADE;
INSERT INTO franchise_config_preteste SELECT * FROM franchise_config;

TRUNCATE TABLE franchise_facilities_preteste CASCADE;
INSERT INTO franchise_facilities_preteste SELECT * FROM franchise_facilities;

TRUNCATE TABLE franchise_finances_preteste CASCADE;
INSERT INTO franchise_finances_preteste SELECT * FROM franchise_finances;

TRUNCATE TABLE franchise_transactions_preteste CASCADE;
INSERT INTO franchise_transactions_preteste SELECT * FROM franchise_transactions;

TRUNCATE TABLE arena_concessions_preteste CASCADE;
INSERT INTO arena_concessions_preteste SELECT * FROM arena_concessions;

TRUNCATE TABLE arena_sections_preteste CASCADE;
INSERT INTO arena_sections_preteste SELECT * FROM arena_sections;

TRUNCATE TABLE construction_queue_preteste CASCADE;
INSERT INTO construction_queue_preteste SELECT * FROM construction_queue;

TRUNCATE TABLE practice_facilities_preteste CASCADE;
INSERT INTO practice_facilities_preteste SELECT * FROM practice_facilities;

TRUNCATE TABLE sponsor_contracts_preteste CASCADE;
INSERT INTO sponsor_contracts_preteste SELECT * FROM sponsor_contracts;

TRUNCATE TABLE sponsor_objective_tracking_preteste CASCADE;
INSERT INTO sponsor_objective_tracking_preteste SELECT * FROM sponsor_objective_tracking;

TRUNCATE TABLE sponsor_objectives_preteste CASCADE;
INSERT INTO sponsor_objectives_preteste SELECT * FROM sponsor_objectives;

TRUNCATE TABLE sponsor_pool_preteste CASCADE;
INSERT INTO sponsor_pool_preteste SELECT * FROM sponsor_pool;

TRUNCATE TABLE sponsor_templates_preteste CASCADE;
INSERT INTO sponsor_templates_preteste SELECT * FROM sponsor_templates;

TRUNCATE TABLE sponsor_jersey_images_preteste CASCADE;
INSERT INTO sponsor_jersey_images_preteste SELECT * FROM sponsor_jersey_images;

TRUNCATE TABLE scout_progress_preteste CASCADE;
INSERT INTO scout_progress_preteste SELECT * FROM scout_progress;

TRUNCATE TABLE scouting_reveals_preteste CASCADE;
INSERT INTO scouting_reveals_preteste SELECT * FROM scouting_reveals;

TRUNCATE TABLE allstar_config_preteste CASCADE;
INSERT INTO allstar_config_preteste SELECT * FROM allstar_config;

TRUNCATE TABLE allstar_roster_preteste CASCADE;
INSERT INTO allstar_roster_preteste SELECT * FROM allstar_roster;

TRUNCATE TABLE allstar_votes_preteste CASCADE;
INSERT INTO allstar_votes_preteste SELECT * FROM allstar_votes;

TRUNCATE TABLE playoff_series_preteste CASCADE;
INSERT INTO playoff_series_preteste SELECT * FROM playoff_series;

TRUNCATE TABLE playoff_games_preteste CASCADE;
INSERT INTO playoff_games_preteste SELECT * FROM playoff_games;

TRUNCATE TABLE friendly_requests_preteste CASCADE;
INSERT INTO friendly_requests_preteste SELECT * FROM friendly_requests;

TRUNCATE TABLE job_applications_preteste CASCADE;
INSERT INTO job_applications_preteste SELECT * FROM job_applications;

TRUNCATE TABLE chat_messages_preteste CASCADE;
INSERT INTO chat_messages_preteste SELECT * FROM chat_messages;

TRUNCATE TABLE messages_preteste CASCADE;
INSERT INTO messages_preteste SELECT * FROM messages;

TRUNCATE TABLE articles_preteste CASCADE;
INSERT INTO articles_preteste SELECT * FROM articles;

TRUNCATE TABLE world_teams_preteste CASCADE;
INSERT INTO world_teams_preteste SELECT * FROM world_teams;

TRUNCATE TABLE season_events_preteste CASCADE;
INSERT INTO season_events_preteste SELECT * FROM season_events;

TRUNCATE TABLE site_config_preteste CASCADE;
INSERT INTO site_config_preteste SELECT * FROM site_config;

TRUNCATE TABLE injury_types_preteste CASCADE;
INSERT INTO injury_types_preteste SELECT * FROM injury_types;

TRUNCATE TABLE season_config_preteste CASCADE;
INSERT INTO season_config_preteste SELECT * FROM season_config;

-- awards não tem cópia de segurança (fica sempre vazia no RESET, por desenho)

SET session_replication_role = DEFAULT;

SELECT 'PONTO DE ORIGEM ATUALIZADO - este é agora o novo estado inicial!' as resultado;