-- Concurso de Triplos do All-Star Weekend — 8 participantes escolhidos pelos
-- triplos convertidos na época até à data do anúncio dos All-Stars (ver
-- resolveAllStarWeekend em src/lib/allstar-resolver.ts), vencedor decidido
-- por um sorteio pesado pela qualidade de lançamento (ver
-- simulateThreePointContest em src/lib/allstar-events-simulator.ts).

CREATE TABLE IF NOT EXISTS three_point_contest (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season text NOT NULL,
  player_id integer NOT NULL REFERENCES players(id),
  season_makes integer NOT NULL DEFAULT 0,
  is_winner boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE (season, player_id)
);

ALTER TABLE allstar_config ADD COLUMN IF NOT EXISTS three_point_contest_played boolean NOT NULL DEFAULT false;
