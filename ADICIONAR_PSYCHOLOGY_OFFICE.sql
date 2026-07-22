-- Psychology Office — 3 per-team slots where a GM assigns a player to
-- private sessions with the Mental Coach, accelerating their morale
-- recovery toward 60 (or 75 with Extra Hours) at a weekly cost deducted
-- from the team's balance. See src/lib/psychology-office-resolver.ts.
CREATE TABLE IF NOT EXISTS psychology_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id text NOT NULL,
  slot_number int NOT NULL CHECK (slot_number IN (1,2,3)),
  player_id bigint,
  extra_hours boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, slot_number)
);

CREATE TABLE IF NOT EXISTS psychology_slots_preteste (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id text NOT NULL,
  slot_number int NOT NULL CHECK (slot_number IN (1,2,3)),
  player_id bigint,
  extra_hours boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, slot_number)
);
