-- ============================================
-- RIVALIDADES REAIS: Major vs Minor
-- Substitui o antigo "rival_team_id" (um único rival, sem impacto real
-- diferenciado) por duas listas por equipa, pesquisadas uma a uma na
-- internet (rivalidades históricas, geográficas, ou de playoffs recentes).
-- Major = rivalidade forte (mais impacto na assistência e na satisfação
-- dos adeptos ao ganhar). Minor = rivalidade real mas mais ligeira.
-- Cola no Supabase SQL Editor e corre.
-- ============================================

ALTER TABLE teams ADD COLUMN IF NOT EXISTS major_rival_team_ids text[] DEFAULT '{}';
ALTER TABLE teams ADD COLUMN IF NOT EXISTS minor_rival_team_ids text[] DEFAULT '{}';
ALTER TABLE teams_preteste ADD COLUMN IF NOT EXISTS major_rival_team_ids text[] DEFAULT '{}';
ALTER TABLE teams_preteste ADD COLUMN IF NOT EXISTS minor_rival_team_ids text[] DEFAULT '{}';

UPDATE teams SET major_rival_team_ids = '{BOS}',           minor_rival_team_ids = '{ORL,WAS}'     WHERE id = 'ATL';
UPDATE teams SET major_rival_team_ids = '{LAL,PHI}',       minor_rival_team_ids = '{NYK}'         WHERE id = 'BOS';
UPDATE teams SET major_rival_team_ids = '{NYK}',           minor_rival_team_ids = '{}'            WHERE id = 'BKN';
UPDATE teams SET major_rival_team_ids = '{}',              minor_rival_team_ids = '{MIA,WAS,ATL}' WHERE id = 'CHA';
UPDATE teams SET major_rival_team_ids = '{DET,NYK}',       minor_rival_team_ids = '{MIL}'         WHERE id = 'CHI';
UPDATE teams SET major_rival_team_ids = '{GSW}',           minor_rival_team_ids = '{CHI,WAS}'     WHERE id = 'CLE';
UPDATE teams SET major_rival_team_ids = '{SAS}',           minor_rival_team_ids = '{HOU}'         WHERE id = 'DAL';
UPDATE teams SET major_rival_team_ids = '{OKC}',           minor_rival_team_ids = '{UTA,MIN}'     WHERE id = 'DEN';
UPDATE teams SET major_rival_team_ids = '{CHI}',           minor_rival_team_ids = '{LAL}'         WHERE id = 'DET';
UPDATE teams SET major_rival_team_ids = '{CLE}',           minor_rival_team_ids = '{LAL}'         WHERE id = 'GSW';
UPDATE teams SET major_rival_team_ids = '{}',              minor_rival_team_ids = '{DAL,SAS}'     WHERE id = 'HOU';
UPDATE teams SET major_rival_team_ids = '{NYK}',           minor_rival_team_ids = '{MIL}'         WHERE id = 'IND';
UPDATE teams SET major_rival_team_ids = '{LAL}',           minor_rival_team_ids = '{}'            WHERE id = 'LAC';
UPDATE teams SET major_rival_team_ids = '{BOS,LAC}',       minor_rival_team_ids = '{SAC}'         WHERE id = 'LAL';
UPDATE teams SET major_rival_team_ids = '{OKC}',           minor_rival_team_ids = '{NOP}'         WHERE id = 'MEM';
UPDATE teams SET major_rival_team_ids = '{ORL}',           minor_rival_team_ids = '{NYK,CHA}'     WHERE id = 'MIA';
UPDATE teams SET major_rival_team_ids = '{}',              minor_rival_team_ids = '{CHI,IND}'     WHERE id = 'MIL';
UPDATE teams SET major_rival_team_ids = '{OKC}',           minor_rival_team_ids = '{DEN}'         WHERE id = 'MIN';
UPDATE teams SET major_rival_team_ids = '{}',              minor_rival_team_ids = '{MEM}'         WHERE id = 'NOP';
UPDATE teams SET major_rival_team_ids = '{BOS,CHI,BKN}',   minor_rival_team_ids = '{}'            WHERE id = 'NYK';
UPDATE teams SET major_rival_team_ids = '{DEN,MEM,MIN}',   minor_rival_team_ids = '{}'            WHERE id = 'OKC';
UPDATE teams SET major_rival_team_ids = '{MIA}',           minor_rival_team_ids = '{ATL}'         WHERE id = 'ORL';
UPDATE teams SET major_rival_team_ids = '{BOS}',           minor_rival_team_ids = '{TOR}'         WHERE id = 'PHI';
UPDATE teams SET major_rival_team_ids = '{}',              minor_rival_team_ids = '{LAL,SAS}'     WHERE id = 'PHX';
UPDATE teams SET major_rival_team_ids = '{}',              minor_rival_team_ids = '{LAL,UTA,DEN}' WHERE id = 'POR';
UPDATE teams SET major_rival_team_ids = '{}',              minor_rival_team_ids = '{LAL}'         WHERE id = 'SAC';
UPDATE teams SET major_rival_team_ids = '{DAL}',           minor_rival_team_ids = '{HOU,PHX}'     WHERE id = 'SAS';
UPDATE teams SET major_rival_team_ids = '{}',              minor_rival_team_ids = '{PHI,WAS}'     WHERE id = 'TOR';
UPDATE teams SET major_rival_team_ids = '{}',              minor_rival_team_ids = '{DEN,POR}'     WHERE id = 'UTA';
UPDATE teams SET major_rival_team_ids = '{}',              minor_rival_team_ids = '{CLE,BOS,TOR}' WHERE id = 'WAS';

ALTER TABLE teams DROP COLUMN IF EXISTS rival_team_id;
ALTER TABLE teams_preteste DROP COLUMN IF EXISTS rival_team_id;

SELECT 'Rivalidades Major/Minor atualizadas!' AS resultado;
