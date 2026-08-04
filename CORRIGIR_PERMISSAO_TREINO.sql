-- ============================================
-- CORRIGIR PERMISSAO DE TREINO (RLS em players)
-- Cola no Supabase SQL Editor e corre
-- ============================================
-- A regra de seguranca da tabela `players` so deixava escrever quem
-- estivesse marcado como "commissioner" na tabela `profiles` -- mas essa
-- tabela ficou vazia ha muito tempo (a app usa `gm_profiles` desde entao).
-- Resultado: NINGUEM conseguia gravar um atributo treinado, nunca, sem
-- nenhum erro visivel (o Postgres so ignora silenciosamente as linhas que
-- a regra nao deixa mexer).
--
-- A regra nova verifica `gm_profiles` (a tabela real) e permite tanto o
-- comissario como o GM dono da equipa desse jogador -- o treino e uma
-- ferramenta normal de qualquer GM, nao so do comissario.

DROP POLICY IF EXISTS "Commissioner manages players" ON players;

CREATE POLICY "Commissioner and own-team GM manage players" ON players
  FOR UPDATE
  USING (
    auth.uid() IN (SELECT id FROM gm_profiles WHERE role = 'commissioner')
    OR auth.uid() IN (SELECT id FROM gm_profiles WHERE team_id = players.team_id)
  );

SELECT 'Permissao de treino corrigida!' AS resultado;
