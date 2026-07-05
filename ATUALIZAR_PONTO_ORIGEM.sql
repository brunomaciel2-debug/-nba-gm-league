-- ============================================
-- ATUALIZAR PONTO DE ORIGEM
-- Cola no Supabase SQL Editor e corre
-- Tira uma nova "fotografia" do estado atual e torna-a
-- o novo Ponto de Origem (o que o RESET_PRE_TESTE.sql restaura)
-- Duas fases, pela mesma razao do RESET_PRE_TESTE.sql.
-- ============================================

SET session_replication_role = replica;

-- FASE 1: limpar todas as copias de seguranca
TRUNCATE TABLE box_scores_preteste CASCADE;
TRUNCATE TABLE play_by_play_preteste CASCADE;
TRUNCATE TABLE games_preteste CASCADE;
TRUNCATE TABLE preseason_games_preteste CASCADE;
TRUNCATE TABLE player_stats_preteste CASCADE;
TRUNCATE TABLE players_preteste CASCADE;
TRUNCATE TABLE teams_preteste CASCADE;
TRUNCATE TABLE gleague_teams_preteste CASCADE;
TRUNCATE TABLE gleague_games_preteste CASCADE;
TRUNCATE TABLE gleague_player_stats_preteste CASCADE;
TRUNCATE TABLE coaches_preteste CASCADE;
TRUNCATE TABLE gm_profiles_preteste CASCADE;
TRUNCATE TABLE profiles_preteste CASCADE;
TRUNCATE TABLE contracts_preteste CASCADE;
TRUNCATE TABLE contract_extension_offers_preteste CASCADE;
TRUNCATE TABLE gm_orders_preteste CASCADE;
TRUNCATE TABLE inbox_messages_preteste CASCADE;
TRUNCATE TABLE attribute_development_preteste CASCADE;
TRUNCATE TABLE injury_log_preteste CASCADE;
TRUNCATE TABLE player_interactions_preteste CASCADE;
TRUNCATE TABLE transactions_preteste CASCADE;
TRUNCATE TABLE awards_preteste CASCADE;
TRUNCATE TABLE weekly_highlights_preteste CASCADE;
TRUNCATE TABLE power_rankings_preteste CASCADE;
TRUNCATE TABLE trade_proposals_preteste CASCADE;
TRUNCATE TABLE trade_proposal_teams_preteste CASCADE;
TRUNCATE TABLE trade_block_preteste CASCADE;
TRUNCATE TABLE fa_offers_preteste CASCADE;
TRUNCATE TABLE staff_offers_preteste CASCADE;
TRUNCATE TABLE fa_market_offers_preteste CASCADE;
TRUNCATE TABLE draft_picks_preteste CASCADE;
TRUNCATE TABLE draft_orders_preteste CASCADE;
TRUNCATE TABLE draft_results_preteste CASCADE;
TRUNCATE TABLE prospects_preteste CASCADE;
TRUNCATE TABLE training_slots_preteste CASCADE;
TRUNCATE TABLE training_log_preteste CASCADE;
TRUNCATE TABLE franchise_config_preteste CASCADE;
TRUNCATE TABLE franchise_facilities_preteste CASCADE;
TRUNCATE TABLE franchise_finances_preteste CASCADE;
TRUNCATE TABLE franchise_transactions_preteste CASCADE;
TRUNCATE TABLE arena_concessions_preteste CASCADE;
TRUNCATE TABLE arena_sections_preteste CASCADE;
TRUNCATE TABLE construction_queue_preteste CASCADE;
TRUNCATE TABLE practice_facilities_preteste CASCADE;
TRUNCATE TABLE sponsor_contracts_preteste CASCADE;
TRUNCATE TABLE sponsor_objective_tracking_preteste CASCADE;
TRUNCATE TABLE sponsor_objectives_preteste CASCADE;
TRUNCATE TABLE sponsor_pool_preteste CASCADE;
TRUNCATE TABLE sponsor_templates_preteste CASCADE;
TRUNCATE TABLE sponsor_jersey_images_preteste CASCADE;
TRUNCATE TABLE scout_progress_preteste CASCADE;
TRUNCATE TABLE scouting_reveals_preteste CASCADE;
TRUNCATE TABLE allstar_config_preteste CASCADE;
TRUNCATE TABLE allstar_roster_preteste CASCADE;
TRUNCATE TABLE allstar_votes_preteste CASCADE;
TRUNCATE TABLE playoff_series_preteste CASCADE;
TRUNCATE TABLE playoff_games_preteste CASCADE;
TRUNCATE TABLE friendly_requests_preteste CASCADE;
TRUNCATE TABLE job_applications_preteste CASCADE;
TRUNCATE TABLE chat_messages_preteste CASCADE;
TRUNCATE TABLE messages_preteste CASCADE;
TRUNCATE TABLE articles_preteste CASCADE;
TRUNCATE TABLE world_teams_preteste CASCADE;
TRUNCATE TABLE season_events_preteste CASCADE;
TRUNCATE TABLE site_config_preteste CASCADE;
TRUNCATE TABLE injury_types_preteste CASCADE;
TRUNCATE TABLE player_interaction_types_preteste CASCADE;
TRUNCATE TABLE season_config_preteste CASCADE;

-- FASE 2: copiar o estado atual para as copias de seguranca
INSERT INTO box_scores_preteste SELECT * FROM box_scores;
INSERT INTO play_by_play_preteste SELECT * FROM play_by_play;
INSERT INTO games_preteste SELECT * FROM games;
INSERT INTO preseason_games_preteste SELECT * FROM preseason_games;
INSERT INTO player_stats_preteste SELECT * FROM player_stats;
INSERT INTO players_preteste SELECT * FROM players;
INSERT INTO teams_preteste SELECT * FROM teams;
INSERT INTO gleague_teams_preteste SELECT * FROM gleague_teams;
INSERT INTO gleague_games_preteste SELECT * FROM gleague_games;
INSERT INTO gleague_player_stats_preteste SELECT * FROM gleague_player_stats;
INSERT INTO coaches_preteste SELECT * FROM coaches;
INSERT INTO gm_profiles_preteste SELECT * FROM gm_profiles;
INSERT INTO profiles_preteste SELECT * FROM profiles;
INSERT INTO contracts_preteste SELECT * FROM contracts;
INSERT INTO contract_extension_offers_preteste SELECT * FROM contract_extension_offers;
INSERT INTO gm_orders_preteste SELECT * FROM gm_orders;
INSERT INTO inbox_messages_preteste SELECT * FROM inbox_messages;
INSERT INTO attribute_development_preteste SELECT * FROM attribute_development;
INSERT INTO injury_log_preteste SELECT * FROM injury_log;
INSERT INTO player_interactions_preteste SELECT * FROM player_interactions;
INSERT INTO transactions_preteste SELECT * FROM transactions;
INSERT INTO awards_preteste SELECT * FROM awards;
INSERT INTO weekly_highlights_preteste SELECT * FROM weekly_highlights;
INSERT INTO power_rankings_preteste SELECT * FROM power_rankings;
INSERT INTO trade_proposals_preteste SELECT * FROM trade_proposals;
INSERT INTO trade_proposal_teams_preteste SELECT * FROM trade_proposal_teams;
INSERT INTO trade_block_preteste SELECT * FROM trade_block;
INSERT INTO fa_offers_preteste SELECT * FROM fa_offers;
INSERT INTO staff_offers_preteste SELECT * FROM staff_offers;
INSERT INTO fa_market_offers_preteste SELECT * FROM fa_market_offers;
INSERT INTO draft_picks_preteste SELECT * FROM draft_picks;
INSERT INTO draft_orders_preteste SELECT * FROM draft_orders;
INSERT INTO draft_results_preteste SELECT * FROM draft_results;
INSERT INTO prospects_preteste SELECT * FROM prospects;
INSERT INTO training_slots_preteste SELECT * FROM training_slots;
INSERT INTO training_log_preteste SELECT * FROM training_log;
INSERT INTO franchise_config_preteste SELECT * FROM franchise_config;
INSERT INTO franchise_facilities_preteste SELECT * FROM franchise_facilities;
INSERT INTO franchise_finances_preteste SELECT * FROM franchise_finances;
INSERT INTO franchise_transactions_preteste SELECT * FROM franchise_transactions;
INSERT INTO arena_concessions_preteste SELECT * FROM arena_concessions;
INSERT INTO arena_sections_preteste SELECT * FROM arena_sections;
INSERT INTO construction_queue_preteste SELECT * FROM construction_queue;
INSERT INTO practice_facilities_preteste SELECT * FROM practice_facilities;
INSERT INTO sponsor_contracts_preteste SELECT * FROM sponsor_contracts;
INSERT INTO sponsor_objective_tracking_preteste SELECT * FROM sponsor_objective_tracking;
INSERT INTO sponsor_objectives_preteste SELECT * FROM sponsor_objectives;
INSERT INTO sponsor_pool_preteste SELECT * FROM sponsor_pool;
INSERT INTO sponsor_templates_preteste SELECT * FROM sponsor_templates;
INSERT INTO sponsor_jersey_images_preteste SELECT * FROM sponsor_jersey_images;
INSERT INTO scout_progress_preteste SELECT * FROM scout_progress;
INSERT INTO scouting_reveals_preteste SELECT * FROM scouting_reveals;
INSERT INTO allstar_config_preteste SELECT * FROM allstar_config;
INSERT INTO allstar_roster_preteste SELECT * FROM allstar_roster;
INSERT INTO allstar_votes_preteste SELECT * FROM allstar_votes;
INSERT INTO playoff_series_preteste SELECT * FROM playoff_series;
INSERT INTO playoff_games_preteste SELECT * FROM playoff_games;
INSERT INTO friendly_requests_preteste SELECT * FROM friendly_requests;
INSERT INTO job_applications_preteste SELECT * FROM job_applications;
INSERT INTO chat_messages_preteste SELECT * FROM chat_messages;
INSERT INTO messages_preteste SELECT * FROM messages;
INSERT INTO articles_preteste SELECT * FROM articles;
INSERT INTO world_teams_preteste SELECT * FROM world_teams;
INSERT INTO season_events_preteste SELECT * FROM season_events;
INSERT INTO site_config_preteste SELECT * FROM site_config;
INSERT INTO injury_types_preteste SELECT * FROM injury_types;
INSERT INTO player_interaction_types_preteste SELECT * FROM player_interaction_types;
INSERT INTO season_config_preteste SELECT * FROM season_config;

-- awards nao tem copia de seguranca (fica sempre vazia no RESET, por desenho)

SET session_replication_role = DEFAULT;

SELECT 'PONTO DE ORIGEM ATUALIZADO - este e agora o novo estado inicial!' as resultado;