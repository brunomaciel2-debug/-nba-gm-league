-- ============================================
-- CORRIGIR sponsor_objectives_preteste: id/created_at sem valor por omissão
-- Cola no Supabase SQL Editor e corre (uma vez só)
-- Ao contrário da tabela principal "sponsor_objectives", a cópia "_preteste"
-- não gerava automaticamente um id nem um created_at — uma inserção manual
-- sem indicar esses valores ficava com id NULL, o que faria o próximo
-- RESET_PRE_TESTE.sql falhar (a tabela principal exige id preenchido).
-- Já corrigi as 2 linhas que tinham ficado com id NULL; isto só acrescenta
-- os valores por omissão para o problema não voltar a acontecer.
-- ============================================

ALTER TABLE sponsor_objectives_preteste ALTER COLUMN id SET DEFAULT extensions.uuid_generate_v4();
ALTER TABLE sponsor_objectives_preteste ALTER COLUMN created_at SET DEFAULT now();

SELECT 'Defaults de sponsor_objectives_preteste corrigidos!' as resultado;
