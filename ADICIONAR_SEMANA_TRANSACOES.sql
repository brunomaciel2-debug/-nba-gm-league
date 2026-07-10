-- ============================================
-- ADICIONAR week_number À TABELA transactions
-- Cola no Supabase SQL Editor e corre (só precisas de correr isto uma vez)
--
-- CAUSA: a página /transactions mostrava a data/hora REAL (do computador)
-- em que a ação foi feita, não a data do simulador (semana da época). Isto
-- adiciona a coluna que falta para guardar em que semana da época cada
-- transação aconteceu, para a página poder mostrar a data certa.
-- ============================================

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS week_number int;
ALTER TABLE transactions_preteste ADD COLUMN IF NOT EXISTS week_number int;

SELECT 'Coluna week_number adicionada a transactions e transactions_preteste!' as resultado;
