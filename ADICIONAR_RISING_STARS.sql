-- ============================================
-- ALL-STAR WEEKEND: Rising Stars (Rookies vs Sophomores) + flags de controlo
-- Cola no Supabase SQL Editor e corre (uma vez so)
-- ============================================

-- Roster do jogo Rookies vs Sophomores, selecionado automaticamente pelo
-- sistema (Game Score medio da epoca), tal como o allstar_roster ja existe
-- para o East vs West (esse continua a ser por votacao dos GMs).
CREATE TABLE IF NOT EXISTS rising_stars_roster (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  season text NOT NULL,
  team_id text REFERENCES teams(id),   -- 'ROO' (Rookies) ou 'SOP' (Sophomores)
  player_id bigint REFERENCES players(id),
  is_starter boolean DEFAULT false,
  game_score numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rising_stars_roster_preteste (
  id uuid PRIMARY KEY,
  season text,
  team_id text,
  player_id bigint,
  is_starter boolean,
  game_score numeric,
  created_at timestamptz
);

-- Flags de controlo (mesmo padrao do roster_announced ja existente) — evitam
-- que o roster do Rising Stars ou os dois jogos de exibicao sejam gerados
-- em duplicado quando o cron corre duas vezes na mesma semana (meia-semana 1
-- e 2).
ALTER TABLE allstar_config ADD COLUMN IF NOT EXISTS rising_stars_announced boolean NOT NULL DEFAULT false;
ALTER TABLE allstar_config ADD COLUMN IF NOT EXISTS rising_stars_played boolean NOT NULL DEFAULT false;
ALTER TABLE allstar_config ADD COLUMN IF NOT EXISTS all_star_game_played boolean NOT NULL DEFAULT false;
ALTER TABLE allstar_config_preteste ADD COLUMN IF NOT EXISTS rising_stars_announced boolean NOT NULL DEFAULT false;
ALTER TABLE allstar_config_preteste ADD COLUMN IF NOT EXISTS rising_stars_played boolean NOT NULL DEFAULT false;
ALTER TABLE allstar_config_preteste ADD COLUMN IF NOT EXISTS all_star_game_played boolean NOT NULL DEFAULT false;

-- As semanas guardadas aqui sao so um espelho informativo (nenhum codigo as
-- le - as reais estao em src/lib/allstar-constants.ts) mas mantemos em sincronia
-- para nao ficarem enganadoras: All-Star Weekend passou a semana 33 (nao 32),
-- ver o comentario em allstar-constants.ts.
UPDATE allstar_config SET
  voting_opens_week = 29, voting_closes_week = 31, announce_week = 32, allstar_week = 33
WHERE id = 1;

SELECT 'rising_stars_roster criada + flags de controlo adicionadas!' as resultado;
