-- ============================================
-- PICO DE VENDAS APÓS AQUISIÇÃO DE JOGADOR
-- Cola no Supabase SQL Editor e corre (uma vez só)
-- jersey_sales_reports não tem cópia de segurança "_preteste" (fica sempre
-- vazia no RESET, por desenho) — só precisa desta coluna nova.
-- ============================================

ALTER TABLE jersey_sales_reports ADD COLUMN IF NOT EXISTS acquisition_note text;

SELECT 'Coluna acquisition_note adicionada a jersey_sales_reports!' as resultado;
