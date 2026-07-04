-- ============================================
-- CORRIGIR DESENCONTROS ENTRE TABELAS "AO VIVO" E AS SUAS CÓPIAS "_preteste"
-- Cola no Supabase SQL Editor e corre (uma vez só)
-- ============================================

-- preseason_games_preteste estava sem a coluna game_id (adicionada
-- à tabela ao vivo mais cedo hoje, mas esquecida na cópia de segurança)
ALTER TABLE preseason_games_preteste ADD COLUMN IF NOT EXISTS game_id uuid;

-- injuries_preteste é uma sobra da tabela "injuries" que já apagámos
-- (nada a referencia, é seguro remover)
DROP TABLE IF EXISTS injuries_preteste;

SELECT 'Tabelas _preteste corrigidas!' as resultado;
