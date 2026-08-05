-- ============================================
-- CORRIGIR PERMISSOES: coaches, allstar_votes, prospects
-- Cola no Supabase SQL Editor e corre
-- ============================================
-- Auditoria mais alargada (pedida pelo Bruno) -- estas 3 tabelas tinham
-- policies com nomes que sugeriam restricao ("Service manage coaches",
-- "Commissioner update prospects") mas cujo qual real era `true`, ou seja
-- SEM restricao nenhuma. Confirmado que todas as 3 sao escritas a partir
-- do browser (nao so do servidor), por isso o nome da policy nunca foi a
-- seguranca real -- qualquer GM autenticado podia, em principio, editar
-- staff de outra equipa, votar em nome de outra equipa, ou editar
-- atributos escondidos de prospects do draft.

-- coaches: so a foto e escrita a partir do browser (staff/[id]/CoachPhotoUpload).
-- INSERT/DELETE ja so acontecem no servidor (contratacao/despedimento via
-- resolve-staff-offers-core.ts, que usa a service key e ignora RLS de
-- qualquer forma) -- por isso so precisa de policy de UPDATE.
DROP POLICY IF EXISTS "Service manage coaches" ON coaches;
CREATE POLICY "Commissioner and own-team GM update coaches" ON coaches
  FOR UPDATE
  USING (
    auth.uid() IN (SELECT id FROM gm_profiles WHERE role = 'commissioner')
    OR auth.uid() IN (SELECT id FROM gm_profiles WHERE team_id = coaches.team_id)
  );

-- allstar_votes: cada GM so pode gravar o voto da sua propria equipa
-- (gm_team_id), nunca em nome de outra.
DROP POLICY IF EXISTS "Upsert allstar_votes" ON allstar_votes;
DROP POLICY IF EXISTS "Insert allstar_votes" ON allstar_votes;
CREATE POLICY "Commissioner and own-team GM update allstar_votes" ON allstar_votes
  FOR UPDATE
  USING (
    auth.uid() IN (SELECT id FROM gm_profiles WHERE role = 'commissioner')
    OR auth.uid() IN (SELECT id FROM gm_profiles WHERE team_id = allstar_votes.gm_team_id)
  );
CREATE POLICY "Commissioner and own-team GM insert allstar_votes" ON allstar_votes
  FOR INSERT
  WITH CHECK (
    auth.uid() IN (SELECT id FROM gm_profiles WHERE role = 'commissioner')
    OR auth.uid() IN (SELECT id FROM gm_profiles WHERE team_id = allstar_votes.gm_team_id)
  );

-- prospects: ainda nao pertencem a nenhuma equipa (sao do draft), por isso
-- so o Comissario deve poder editar (a app ja restringe isto no ecra --
-- ProspectPhotoUpload.tsx -- mas isso e so cosmetico, nao seguranca real;
-- sem esta regra, qualquer GM autenticado podia editar atributos escondidos
-- de um prospect via um pedido direto, contornando o ecra).
DROP POLICY IF EXISTS "Commissioner update prospects" ON prospects;
DROP POLICY IF EXISTS "Commissioner insert prospects" ON prospects;
CREATE POLICY "Commissioner manages prospects" ON prospects
  FOR UPDATE
  USING (auth.uid() IN (SELECT id FROM gm_profiles WHERE role = 'commissioner'));
CREATE POLICY "Commissioner inserts prospects" ON prospects
  FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT id FROM gm_profiles WHERE role = 'commissioner'));

SELECT 'Permissoes de coaches/votos de All-Star/prospects corrigidas!' AS resultado;
