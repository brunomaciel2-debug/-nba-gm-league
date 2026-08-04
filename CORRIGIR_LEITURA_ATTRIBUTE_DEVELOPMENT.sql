-- ============================================
-- PERMITIR AO GM LER O SEU PROPRIO attribute_development
-- Cola no Supabase SQL Editor e corre
-- ============================================
-- attribute_development so podia ser lido pelo Comissario ("Commissioner
-- reads development"). Isso bloqueava silenciosamente o novo relatorio
-- mensal de evolucao de atletas para qualquer GM normal -- o link no email
-- abriria uma pagina sempre vazia. A regra nova deixa cada GM ler o
-- historico dos SEUS proprios jogadores; o Comissario continua a poder ler
-- tudo.

DROP POLICY IF EXISTS "Commissioner reads development" ON attribute_development;

CREATE POLICY "Commissioner and own-team GM read development" ON attribute_development
  FOR SELECT
  USING (
    auth.uid() IN (SELECT id FROM gm_profiles WHERE role = 'commissioner')
    OR EXISTS (
      SELECT 1 FROM players
      WHERE players.id = attribute_development.player_id
      AND players.team_id IN (SELECT team_id FROM gm_profiles WHERE id = auth.uid())
    )
  );

SELECT 'Leitura de attribute_development corrigida!' AS resultado;
