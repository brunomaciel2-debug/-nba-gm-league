-- ============================================
-- CORRIGIR MERCHANDISING (fama escondida + campanhas de anúncio, não de fama)
-- Cola no Supabase SQL Editor e corre (só precisas de correr isto uma vez)
-- A campanha de marketing passa a ser um anúncio que vende mais jerseys
-- durante um mês, e não uma forma de comprar fama diretamente.
-- ============================================

ALTER TABLE marketing_campaigns RENAME COLUMN fame_boost_target TO sales_boost_pct;
ALTER TABLE jersey_sales_reports ADD COLUMN IF NOT EXISTS campaign_note text;

SELECT 'Merchandising corrigido — campanhas agora sao sobre vendas, nao fama!' as resultado;
