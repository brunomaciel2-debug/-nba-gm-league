-- ============================================
-- ADICIONAR box_score À TABELA preseason_games
-- Cola no Supabase SQL Editor e corre (só precisas de correr isto uma vez)
--
-- CAUSA: nos jogos amigáveis contra uma equipa "Rest of the World" (sem
-- plantel próprio na base de dados), o simulador já calculava estatísticas
-- realistas por jogador da equipa NBA (pts, reb, ast, minutos...) mas nunca
-- as guardava em lado nenhum — não é possível criar uma linha em `games`
-- para estes jogos (o id de uma equipa mundial violaria a chave estrangeira
-- de games.home_team/away_team, que só aceita equipas reais da NBA), por
-- isso as estatísticas calculadas eram sempre descartadas. Esta coluna
-- guarda-as diretamente na própria linha do jogo amigável.
-- ============================================

ALTER TABLE preseason_games ADD COLUMN IF NOT EXISTS box_score jsonb;
ALTER TABLE preseason_games_preteste ADD COLUMN IF NOT EXISTS box_score jsonb;

SELECT 'Coluna box_score adicionada!' as resultado;
