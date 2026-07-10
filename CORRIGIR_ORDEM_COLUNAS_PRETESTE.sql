-- ============================================
-- CORRIGIR ORDEM DAS COLUNAS EM games_preteste e coaches_preteste
-- Cola no Supabase SQL Editor e corre (substitui a correção anterior)
--
-- O ficheiro ADICIONAR_COLUNAS_PRETESTE_EM_FALTA.sql adicionou as colunas
-- em falta com ALTER TABLE ADD COLUMN — mas isso põe sempre a coluna nova
-- no FIM da tabela, e não necessariamente na mesma posição relativa que
-- a tabela real (games/coaches). O "INSERT INTO x SELECT * FROM y" do
-- Postgres liga colunas pela POSIÇÃO, não pelo nome, por isso a ordem
-- tem de ser idêntica dos dois lados — daí o erro
-- "column referee_rating is of type numeric but expression is of type date".
--
-- A correção: recriar as duas tabelas _preteste com a MESMA estrutura
-- exata (incluindo a ordem das colunas) das tabelas reais, usando
-- "LIKE ... INCLUDING ALL". Os dados antigos destas duas tabelas não
-- importam — vão ser substituídos por uma fotografia fresca já a seguir,
-- pelo ATUALIZAR_PONTO_ORIGEM.sql.
-- ============================================

DROP TABLE IF EXISTS games_preteste CASCADE;
CREATE TABLE games_preteste (LIKE games INCLUDING ALL);

DROP TABLE IF EXISTS coaches_preteste CASCADE;
CREATE TABLE coaches_preteste (LIKE coaches INCLUDING ALL);

SELECT 'games_preteste e coaches_preteste recriadas com a ordem de colunas correta! Corre agora o ATUALIZAR_PONTO_ORIGEM.sql para tirar a fotografia fresca.' as resultado;
