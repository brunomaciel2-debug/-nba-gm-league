-- ============================================
-- ADICIONAR DATA REAL AOS JOGOS
-- Cola no Supabase SQL Editor e corre (só precisas de correr isto uma vez)
-- Dá a cada jogo (games) uma data fictícia real dentro da sua semana, para
-- que o calendário deixe de mostrar "TBD" e a Noite de Abertura/datas
-- marcantes só assinalem o jogo certo, não a semana toda.
-- ============================================

ALTER TABLE games ADD COLUMN IF NOT EXISTS scheduled_date date;

SELECT 'Coluna scheduled_date adicionada a games!' as resultado;
