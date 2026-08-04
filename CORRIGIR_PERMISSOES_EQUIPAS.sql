-- ============================================
-- CORRIGIR PERMISSOES: teams, training_slots, preseason_games
-- Cola no Supabase SQL Editor e corre
-- ============================================
-- Estas 3 tabelas tinham policies "qualquer utilizador autenticado pode
-- editar QUALQUER linha" (qual=true, sem restricao nenhuma) -- um GM
-- conseguia, em principio, editar os dados de OUTRA equipa (ex: mudar o
-- cap_used ou os creditos de treino do adversario). Corrigido para o mesmo
-- padrao ja usado em players/gm_orders: cada GM so mexe na sua propria
-- equipa; o Comissario continua a poder tudo.

DROP POLICY IF EXISTS "Anyone can update teams" ON teams;
DROP POLICY IF EXISTS "Anyone can insert teams" ON teams;

CREATE POLICY "Commissioner and own-team GM manage teams" ON teams
  FOR UPDATE
  USING (
    auth.uid() IN (SELECT id FROM gm_profiles WHERE role = 'commissioner')
    OR auth.uid() IN (SELECT id FROM gm_profiles WHERE team_id = teams.id)
  );

-- Creating a new team row is a Commissioner-only action (league setup),
-- never something an individual GM does.
CREATE POLICY "Commissioner inserts teams" ON teams
  FOR INSERT
  WITH CHECK (
    auth.uid() IN (SELECT id FROM gm_profiles WHERE role = 'commissioner')
  );

DROP POLICY IF EXISTS "Auth update training_slots" ON training_slots;

CREATE POLICY "Commissioner and own-team GM manage training_slots" ON training_slots
  FOR UPDATE
  USING (
    auth.uid() IN (SELECT id FROM gm_profiles WHERE role = 'commissioner')
    OR auth.uid() IN (SELECT id FROM gm_profiles WHERE team_id = training_slots.team_id)
  );

-- A friendly involves two teams (home_team/away_team) -- either side's real
-- GM can update it (accept/decline/reschedule), not just one. World Team
-- opponents have no real GM row to match, so that side simply never grants
-- access on its own -- the real team's own GM (or the Commissioner) still can.
DROP POLICY IF EXISTS "Auth update preseason_games" ON preseason_games;
DROP POLICY IF EXISTS "Auth insert preseason_games" ON preseason_games;

CREATE POLICY "Commissioner and involved GM manage preseason_games" ON preseason_games
  FOR UPDATE
  USING (
    auth.uid() IN (SELECT id FROM gm_profiles WHERE role = 'commissioner')
    OR auth.uid() IN (SELECT id FROM gm_profiles WHERE team_id = preseason_games.home_team)
    OR auth.uid() IN (SELECT id FROM gm_profiles WHERE team_id = preseason_games.away_team)
  );

CREATE POLICY "Commissioner and involved GM insert preseason_games" ON preseason_games
  FOR INSERT
  WITH CHECK (
    auth.uid() IN (SELECT id FROM gm_profiles WHERE role = 'commissioner')
    OR auth.uid() IN (SELECT id FROM gm_profiles WHERE team_id = preseason_games.home_team)
    OR auth.uid() IN (SELECT id FROM gm_profiles WHERE team_id = preseason_games.away_team)
  );

SELECT 'Permissoes de equipas/treino/amigaveis corrigidas!' AS resultado;
