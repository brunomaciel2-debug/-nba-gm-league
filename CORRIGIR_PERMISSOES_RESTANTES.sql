-- ============================================
-- CORRIGIR PERMISSOES RESTANTES: psychology_slots, friendly_requests,
-- inbox_messages, job_applications, draft_orders
-- Cola no Supabase SQL Editor e corre
-- ============================================

-- psychology_slots: nao tinha NENHUMA regra de seguranca (RLS nem sequer
-- estava ligado) -- qualquer pedido direto lia/escrevia dados de psicologia
-- de qualquer equipa. Leitura fica publica (como o resto da app), escrita
-- fica restrita a equipa propria ou Comissario.
ALTER TABLE psychology_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read psychology_slots" ON psychology_slots
  FOR SELECT USING (true);
CREATE POLICY "Commissioner and own-team GM manage psychology_slots" ON psychology_slots
  FOR ALL
  USING (
    auth.uid() IN (SELECT id FROM gm_profiles WHERE role = 'commissioner')
    OR auth.uid() IN (SELECT id FROM gm_profiles WHERE team_id = psychology_slots.team_id)
  );

-- friendly_requests: a regra "Service manage friendlies" (sem restricao)
-- coexistia com outras mais apertadas -- mas no Postgres RLS basta UMA
-- regra permitir para o pedido passar, por isso a aberta anulava as outras
-- na pratica. Um amigavel e sempre entre uma equipa NBA real (nba_team_id)
-- e uma equipa fantasma sem GM (world_team_id), por isso so a equipa NBA
-- proponente (ou o Comissario) precisa de poder editar.
DROP POLICY IF EXISTS "Service manage friendlies" ON friendly_requests;
DROP POLICY IF EXISTS "Auth update friendlies" ON friendly_requests;
DROP POLICY IF EXISTS "Auth insert friendlies" ON friendly_requests;
CREATE POLICY "Commissioner and own-team GM update friendlies" ON friendly_requests
  FOR UPDATE
  USING (
    auth.uid() IN (SELECT id FROM gm_profiles WHERE role = 'commissioner')
    OR auth.uid() IN (SELECT id FROM gm_profiles WHERE team_id = friendly_requests.nba_team_id)
  );
CREATE POLICY "Commissioner and own-team GM insert friendlies" ON friendly_requests
  FOR INSERT
  WITH CHECK (
    auth.uid() IN (SELECT id FROM gm_profiles WHERE role = 'commissioner')
    OR auth.uid() IN (SELECT id FROM gm_profiles WHERE team_id = friendly_requests.nba_team_id)
  );

-- inbox_messages: apagar/editar sem restricao nenhuma deixava qualquer GM
-- apagar ou reescrever mensagens de OUTRA equipa. A insercao fica aberta de
-- propósito -- muitas notificacoes legitimas sao escritas para a caixa de
-- OUTRA equipa (ex: aceitar um amigavel avisa o adversario, aprovar uma
-- candidatura avisa 'commissioner') -- so editar/apagar precisa de ficar
-- restrito a quem realmente é dono da mensagem.
DROP POLICY IF EXISTS "Auth update inbox" ON inbox_messages;
DROP POLICY IF EXISTS "Auth delete inbox" ON inbox_messages;
CREATE POLICY "Own team or Commissioner update inbox" ON inbox_messages
  FOR UPDATE
  USING (
    auth.uid() IN (SELECT id FROM gm_profiles WHERE role = 'commissioner')
    OR auth.uid() IN (SELECT id FROM gm_profiles WHERE team_id = inbox_messages.to_team_id)
  );
CREATE POLICY "Own team or Commissioner delete inbox" ON inbox_messages
  FOR DELETE
  USING (
    auth.uid() IN (SELECT id FROM gm_profiles WHERE role = 'commissioner')
    OR auth.uid() IN (SELECT id FROM gm_profiles WHERE team_id = inbox_messages.to_team_id)
  );

-- job_applications: a leitura estava aberta a qualquer pessoa autenticada,
-- expondo nome/email/idade de candidatos a GM. So o Comissario deve poder
-- ler ou decidir (aprovar/rejeitar); candidatar-se continua aberto a
-- qualquer pessoa (mesmo sem login), como e suposto ser um formulario
-- publico de candidatura.
DROP POLICY IF EXISTS "Commissioner reads applications" ON job_applications;
DROP POLICY IF EXISTS "Commissioner updates applications" ON job_applications;
CREATE POLICY "Commissioner reads applications" ON job_applications
  FOR SELECT
  USING (auth.uid() IN (SELECT id FROM gm_profiles WHERE role = 'commissioner'));
CREATE POLICY "Commissioner updates applications" ON job_applications
  FOR UPDATE
  USING (auth.uid() IN (SELECT id FROM gm_profiles WHERE role = 'commissioner'));

-- draft_orders: editar sem restricao nenhuma podia deixar reescrever a
-- ordem de escolha do draft de qualquer equipa. Nao ha nenhum sitio na app
-- que escreva aqui a partir do browser hoje (so o resolver do servidor,
-- que ignora RLS) -- apertado por precaucao, sem impacto em nada que
-- funcione atualmente.
DROP POLICY IF EXISTS "Auth update draft_orders" ON draft_orders;
DROP POLICY IF EXISTS "Auth insert draft_orders" ON draft_orders;
CREATE POLICY "Commissioner manages draft_orders" ON draft_orders
  FOR UPDATE
  USING (auth.uid() IN (SELECT id FROM gm_profiles WHERE role = 'commissioner'));
CREATE POLICY "Commissioner inserts draft_orders" ON draft_orders
  FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT id FROM gm_profiles WHERE role = 'commissioner'));

SELECT 'Permissoes restantes corrigidas!' AS resultado;
