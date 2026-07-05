-- ============================================
-- POOL DE ARBITROS REAIS DA NBA
-- Cola no Supabase SQL Editor e corre (uma vez só)
--
-- 40 arbitros reais da NBA, cada um com 4 caracteristicas que afetam a
-- simulacao a serio (nao e so um nome bonito no ecra):
--   foul_rate            -> marca muitas ou poucas faltas (mais/menos
--                           lances livres no jogo)
--   crowd_error_rate      -> propenso a erro/apito mais nervoso quando a
--                           arena esta cheia (liga-se ao attRate real)
--   technical_impatience  -> impaciente com jogadores que reclamam ->
--                           mais faltas tecnicas
--   home_bias             -> 50 = neutro; acima favorece ligeiramente a
--                           equipa da casa nas faltas assinaladas
--
-- Cada jogo real (época regular + playoffs) e atribuido a um destes com
-- ANTECEDENCIA (aparece no calendario antes de ser jogado) — nunca dois
-- jogos no mesmo dia com o mesmo arbitro. Pré-época e Summer League
-- continuam sem arbitro atribuido. Inclui o gémeo _preteste.
-- ============================================

CREATE TABLE IF NOT EXISTS referees (
  id text primary key,
  name text not null,
  photo_url text,
  foul_rate int not null,
  crowd_error_rate int not null,
  technical_impatience int not null,
  home_bias int not null,
  created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS referees_preteste (LIKE referees INCLUDING ALL);

ALTER TABLE games ADD COLUMN IF NOT EXISTS referee_id text;
ALTER TABLE games_preteste ADD COLUMN IF NOT EXISTS referee_id text;

INSERT INTO referees (id, name, foul_rate, crowd_error_rate, technical_impatience, home_bias) VALUES
  ('REF01', 'Scott Foster',           82, 30, 75, 55),
  ('REF02', 'Tony Brothers',          70, 35, 70, 50),
  ('REF03', 'Ed Malloy',              55, 20, 40, 50),
  ('REF04', 'Marc Davis',             60, 40, 55, 52),
  ('REF05', 'James Capers',           68, 45, 65, 58),
  ('REF06', 'Kane Fitzgerald',        45, 25, 35, 48),
  ('REF07', 'Curtis Blair',           50, 50, 45, 50),
  ('REF08', 'Sean Wright',            58, 48, 50, 53),
  ('REF09', 'Josh Tiven',             65, 42, 60, 55),
  ('REF10', 'Zach Zarba',             48, 22, 38, 50),
  ('REF11', 'Eric Lewis',             72, 55, 72, 60),
  ('REF12', 'John Goble',             52, 30, 42, 49),
  ('REF13', 'Ben Taylor',             40, 18, 30, 47),
  ('REF14', 'Justin Van Duyne',       62, 44, 58, 54),
  ('REF15', 'Rodney Mott',            75, 52, 68, 57),
  ('REF16', 'Tre Maddox',             38, 15, 28, 46),
  ('REF17', 'David Guthrie',          55, 46, 48, 51),
  ('REF18', 'JT Orr',                 63, 41, 56, 53),
  ('REF19', 'Pat Fraher',             57, 47, 50, 50),
  ('REF20', 'Matt Boland',            35, 12, 25, 45),
  ('REF21', 'Simone Jelks',           50, 28, 40, 50),
  ('REF22', 'CJ Washington',          66, 50, 62, 56),
  ('REF23', 'Michael Smith',          42, 20, 32, 48),
  ('REF24', 'Nick Buchert',           59, 45, 52, 52),
  ('REF25', 'Brian Forte',            77, 58, 74, 59),
  ('REF26', 'Dedric Taylor',          46, 24, 36, 47),
  ('REF27', 'Kevin Cutler',           53, 43, 46, 50),
  ('REF28', 'Mark Lindsay',           61, 42, 54, 54),
  ('REF29', 'Karl Lane',              33, 10, 22, 44),
  ('REF30', 'Sean Corbin',            69, 53, 66, 57),
  ('REF31', 'Bill Kennedy',           44, 21, 34, 48),
  ('REF32', 'Mike Callahan',          56, 44, 49, 50),
  ('REF33', 'Courtney Kirkland',      71, 56, 70, 58),
  ('REF34', 'Derek Richardson',       49, 27, 39, 49),
  ('REF35', 'Tyler Ford',             37, 13, 26, 46),
  ('REF36', 'Suyash Mehta',           54, 45, 44, 50),
  ('REF37', 'Ashley Moyer-Gleich',    47, 26, 37, 48),
  ('REF38', 'Natalie Sago',           41, 19, 31, 47),
  ('REF39', 'Gediminas Petraitis',    64, 48, 59, 55),
  ('REF40', 'Pat O''Connell',         51, 46, 43, 50)
ON CONFLICT (id) DO NOTHING;

INSERT INTO referees_preteste SELECT * FROM referees;

SELECT 'Pool de arbitros criada!' as resultado;
