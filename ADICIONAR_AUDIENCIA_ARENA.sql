-- ============================================
-- AUDIENCIA DA ARENA — pontos de extensao para futuras campanhas de Social Media
-- Cola no Supabase SQL Editor e corre
-- Os 4 segmentos de publico (familia, jovem adulto, fa fiel, corporativo)
-- e as suas quotas por equipa sao calculados em tempo real a partir de dados
-- ja existentes (mercado da equipa, popularidade, forma da epoca) — nao
-- precisam de tabela propria. Esta tabela guarda apenas um AJUSTE manual por
-- segmento, que uma futura funcionalidade de Social Media podera escrever
-- (ex: uma campanha dirigida a jovens sobe temporariamente esse ajuste).
-- Comeca tudo a 0 (sem efeito nenhum) ate essa funcionalidade existir.
-- ============================================

CREATE TABLE IF NOT EXISTS arena_audience_modifiers (
  team_id text PRIMARY KEY REFERENCES teams(id),
  family_modifier numeric DEFAULT 0,
  young_adult_modifier numeric DEFAULT 0,
  loyal_fan_modifier numeric DEFAULT 0,
  corporate_modifier numeric DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

INSERT INTO arena_audience_modifiers (team_id)
SELECT id FROM teams WHERE id NOT IN ('ALL','RVS','ROO','SOP')
ON CONFLICT (team_id) DO NOTHING;

-- Shadow "_preteste" table so RESET_PRE_TESTE.sql / ATUALIZAR_PONTO_ORIGEM.sql
-- can back up and restore this value, same as every other mutable config
-- table (season_config, franchise_config, draft_config, etc).
CREATE TABLE IF NOT EXISTS arena_audience_modifiers_preteste (LIKE arena_audience_modifiers INCLUDING ALL);
INSERT INTO arena_audience_modifiers_preteste SELECT * FROM arena_audience_modifiers ON CONFLICT (team_id) DO NOTHING;

SELECT * FROM arena_audience_modifiers LIMIT 5;
