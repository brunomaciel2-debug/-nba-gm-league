-- ============================================
-- CORRIGE O CARGO (role) DOS TREINADORES
-- Cola no Supabase SQL Editor e corre (uma vez só)
--
-- Todos os treinadores tinham role='coach' (genérico), em vez de
-- 'head_coach' ou 'assistant_coach'. Por isso apareciam todos
-- só como "Coach" nas páginas de equipa. O cargo correto já
-- existia no campo "natural_role" — só não estava a ser copiado
-- para o campo "role", que é o que realmente aparece no ecrã.
-- ============================================

UPDATE coaches SET role = natural_role WHERE role = 'coach';
UPDATE coaches_preteste SET role = natural_role WHERE role = 'coach';

SELECT 'Cargos dos treinadores corrigidos!' as resultado;
