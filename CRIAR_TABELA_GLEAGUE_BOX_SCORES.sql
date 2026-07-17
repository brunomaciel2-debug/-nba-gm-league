-- ============================================
-- CRIAR TABELA "gleague_box_scores" (nunca existiu)
-- Cola no Supabase SQL Editor e corre (uma vez so)
-- Sem esta tabela, os jogos da G-League nao tem estatisticas
-- jogador-a-jogador (so o resultado final da equipa).
-- ============================================

CREATE TABLE IF NOT EXISTS gleague_box_scores (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  game_id uuid NOT NULL REFERENCES gleague_games(id),
  player_id bigint NOT NULL REFERENCES players(id),
  gleague_team_id text NOT NULL REFERENCES gleague_teams(id),
  mins integer NOT NULL DEFAULT 0,
  pts integer NOT NULL DEFAULT 0,
  fgm integer NOT NULL DEFAULT 0,
  fga integer NOT NULL DEFAULT 0,
  tpm integer NOT NULL DEFAULT 0,
  tpa integer NOT NULL DEFAULT 0,
  ftm integer NOT NULL DEFAULT 0,
  fta integer NOT NULL DEFAULT 0,
  reb integer NOT NULL DEFAULT 0,
  ast integer NOT NULL DEFAULT 0,
  turnovers integer NOT NULL DEFAULT 0,
  stl integer NOT NULL DEFAULT 0,
  blk integer NOT NULL DEFAULT 0,
  off_reb integer NOT NULL DEFAULT 0,
  def_reb integer NOT NULL DEFAULT 0,
  pf integer NOT NULL DEFAULT 0,
  is_starter boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gleague_box_scores_game ON gleague_box_scores(game_id);
CREATE INDEX IF NOT EXISTS idx_gleague_box_scores_player ON gleague_box_scores(player_id);

-- Tabela de segurança gémea (sem os REFERENCES/UNIQUE, tal como as outras
-- tabelas "_preteste" existentes) para entrar no ciclo de RESET_PRE_TESTE.sql
-- e ATUALIZAR_PONTO_ORIGEM.sql como qualquer outra tabela.
CREATE TABLE IF NOT EXISTS gleague_box_scores_preteste (
  id uuid PRIMARY KEY,
  game_id uuid,
  player_id bigint,
  gleague_team_id text,
  mins integer,
  pts integer,
  fgm integer,
  fga integer,
  tpm integer,
  tpa integer,
  ftm integer,
  fta integer,
  reb integer,
  ast integer,
  turnovers integer,
  stl integer,
  blk integer,
  off_reb integer,
  def_reb integer,
  pf integer,
  is_starter boolean,
  created_at timestamptz
);

SELECT 'Tabela gleague_box_scores criada!' as resultado;
