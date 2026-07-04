-- ============================================
-- CORRIGE draft_orders.pick_number (era obrigatório sem necessidade)
-- Cola no Supabase SQL Editor e corre (uma vez só)
--
-- Encontrado durante o teste ao vivo: esta coluna era uma sobra de um
-- desenho antigo (uma linha por escolha individual). No desenho actual
-- (uma lista combinada de prioridades por equipa/ronda) não é usada,
-- mas continuava a bloquear qualquer tentativa de gravar uma lista.
-- ============================================

ALTER TABLE draft_orders ALTER COLUMN pick_number DROP NOT NULL;

SELECT 'draft_orders.pick_number corrigida!' as resultado;
