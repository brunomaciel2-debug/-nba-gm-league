-- ============================================
-- ADICIONA A COLUNA "popularity" ÀS EQUIPAS
-- Cola no Supabase SQL Editor e corre (uma vez só)
--
-- Necessário para a Free Agency (semana de negociação real):
-- 15% da decisão do jogador depende de quão "popular"/conhecida
-- é a franquia (mercados grandes como Lakers/Knicks/Warriors
-- pesam mais do que mercados pequenos). Valores de 1-100,
-- baseados em dimensão real do mercado/história da equipa —
-- podes ajustar mais tarde à vontade.
-- ============================================

ALTER TABLE teams ADD COLUMN IF NOT EXISTS popularity int DEFAULT 50;
ALTER TABLE teams_preteste ADD COLUMN IF NOT EXISTS popularity int DEFAULT 50;

UPDATE teams SET popularity = CASE id
  WHEN 'LAL' THEN 98
  WHEN 'NYK' THEN 95
  WHEN 'GSW' THEN 94
  WHEN 'BOS' THEN 92
  WHEN 'CHI' THEN 90
  WHEN 'MIA' THEN 85
  WHEN 'PHI' THEN 80
  WHEN 'DAL' THEN 78
  WHEN 'HOU' THEN 77
  WHEN 'BKN' THEN 76
  WHEN 'LAC' THEN 75
  WHEN 'TOR' THEN 72
  WHEN 'DEN' THEN 70
  WHEN 'PHX' THEN 68
  WHEN 'CLE' THEN 67
  WHEN 'MIL' THEN 66
  WHEN 'ATL' THEN 65
  WHEN 'OKC' THEN 65
  WHEN 'SAS' THEN 63
  WHEN 'MIN' THEN 60
  WHEN 'POR' THEN 60
  WHEN 'SAC' THEN 58
  WHEN 'IND' THEN 58
  WHEN 'ORL' THEN 57
  WHEN 'DET' THEN 57
  WHEN 'NOP' THEN 55
  WHEN 'WAS' THEN 55
  WHEN 'UTA' THEN 50
  WHEN 'CHA' THEN 48
  WHEN 'MEM' THEN 48
  ELSE popularity
END;

UPDATE teams_preteste SET popularity = CASE id
  WHEN 'LAL' THEN 98
  WHEN 'NYK' THEN 95
  WHEN 'GSW' THEN 94
  WHEN 'BOS' THEN 92
  WHEN 'CHI' THEN 90
  WHEN 'MIA' THEN 85
  WHEN 'PHI' THEN 80
  WHEN 'DAL' THEN 78
  WHEN 'HOU' THEN 77
  WHEN 'BKN' THEN 76
  WHEN 'LAC' THEN 75
  WHEN 'TOR' THEN 72
  WHEN 'DEN' THEN 70
  WHEN 'PHX' THEN 68
  WHEN 'CLE' THEN 67
  WHEN 'MIL' THEN 66
  WHEN 'ATL' THEN 65
  WHEN 'OKC' THEN 65
  WHEN 'SAS' THEN 63
  WHEN 'MIN' THEN 60
  WHEN 'POR' THEN 60
  WHEN 'SAC' THEN 58
  WHEN 'IND' THEN 58
  WHEN 'ORL' THEN 57
  WHEN 'DET' THEN 57
  WHEN 'NOP' THEN 55
  WHEN 'WAS' THEN 55
  WHEN 'UTA' THEN 50
  WHEN 'CHA' THEN 48
  WHEN 'MEM' THEN 48
  ELSE popularity
END;

SELECT 'Popularidade das equipas adicionada!' as resultado;
