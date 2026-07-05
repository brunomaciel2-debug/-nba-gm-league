-- ============================================
-- ADICIONAR MENTAL COACH (novo cargo no staff técnico)
-- Cola no Supabase SQL Editor e corre (só precisas de correr isto uma vez)
-- 3 atributos novos, cada um com efeito real no jogo/época:
--   morale_management     -> acelera/desbloqueia a recuperação de moral
--   team_cohesion         -> mais assistências e menos perdas de bola reais
--   composure_coaching    -> menos quebra de rendimento em jogos decisivos/clutch
-- ============================================

ALTER TABLE coaches ADD COLUMN IF NOT EXISTS morale_management int DEFAULT 60;
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS team_cohesion int DEFAULT 60;
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS composure_coaching int DEFAULT 60;

SELECT 'Colunas do Mental Coach adicionadas a coaches!' as resultado;
