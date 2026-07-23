-- ============================================
-- CATEGORIA (Jogador vs Staff) NA FEED DE TRANSAÇÕES
-- Cola no Supabase SQL Editor e corre (uma vez só)
-- Todas as transações já existentes (trocas, contratos, waivers, lesões,
-- suspensões) são sempre de jogadores, por isso o valor por omissão
-- 'player' já as classifica corretamente sem precisar de um backfill.
-- ============================================

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'player';
ALTER TABLE transactions_preteste ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'player';

SELECT 'Coluna category adicionada a transactions!' as resultado;
